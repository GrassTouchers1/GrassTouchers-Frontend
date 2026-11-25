/**
 * Copyright 2026 GrassTouchers Team - NORTHSTAR Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * NORTHSTAR CITIZEN - Offline Sync Manager (Phase 4 / CIT-05)
 * Unified Outbox backed by IndexedDB (OfflineDB) with:
 * - Stable client_event_id (generated once, never regenerated on retry)
 * - Exponential backoff + jitter + Retry-After support
 * - Stuck SENDING recovery on startup
 * - In-tab mutex + cross-tab localStorage timed lock
 * - Citizen UI sync status synchronization
 */
(function (global) {
  'use strict';

  const EVENT_TYPES = Object.freeze({
    SOS: 'SOS_BEACON_DISPATCH',
    FLOOD_REPORT: 'FLOOD_REPORT_SUBMIT'
  });

  const SYNC_STATUS = Object.freeze({
    PENDING_OFFLINE: 'PENDING_OFFLINE',
    SENDING: 'SENDING',
    ACKNOWLEDGED: 'ACKNOWLEDGED',
    FAILED: 'FAILED'
  });

  const LEGACY_QUEUE_STORAGE_KEY = 'northstar_offline_sync_queue';
  const TAB_LOCK_STORAGE_KEY = 'northstar_sync_tab_lock';
  const TAB_LOCK_TTL_MS = 20000;
  const DEFAULT_STUCK_SENDING_MS = 30000;
  const MAX_RETRIES = 5;
  const BACKOFF_SCHEDULE_MS = [2000, 5000, 15000, 30000, 60000];

  function generateClientEventId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      global.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function parseRetryAfterMs(retryAfterHeader) {
    if (!retryAfterHeader) return null;
    const raw = String(retryAfterHeader).trim();
    const sec = Number(raw);
    if (Number.isFinite(sec) && sec >= 0) {
      return Math.min(sec * 1000, 120000);
    }
    const targetMs = Date.parse(raw);
    if (!Number.isNaN(targetMs)) {
      const diff = targetMs - Date.now();
      return diff > 0 ? Math.min(diff, 120000) : 1000;
    }
    return null;
  }

  function classifySyncError(error) {
    const status = Number(error && error.status);
    const errType = error && error.type ? String(error.type) : '';

    if (Number.isFinite(status) && status > 0) {
      if (status === 408 || status === 429 || status >= 500) {
        return {
          retryable: true,
          status,
          code: status === 429 ? 'RATE_LIMITED' : `HTTP_${status}`,
          retryAfterMs: parseRetryAfterMs(error.retryAfter || error.retry_after)
        };
      }
      if (status >= 400 && status < 500) {
        return {
          retryable: false,
          status,
          code: `HTTP_${status}`,
          retryAfterMs: null
        };
      }
    }

    if (errType === 'CONFIG' || errType === 'JSON_PARSE') {
      return { retryable: false, status: status || 0, code: errType, retryAfterMs: null };
    }

    // NETWORK, TIMEOUT, ABORTED, or fetch TypeError -> transient
    return {
      retryable: true,
      status: status || 0,
      code: errType || 'NETWORK',
      retryAfterMs: null
    };
  }

  function computeBackoffDelayMs(retryCount, retryAfterMs) {
    if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
      return retryAfterMs;
    }
    const idx = Math.max(0, Math.min(retryCount - 1, BACKOFF_SCHEDULE_MS.length - 1));
    const base = BACKOFF_SCHEDULE_MS[idx];
    const jitter = Math.floor(Math.random() * Math.round(base * 0.2));
    return base + jitter;
  }

  function buildSOSPayload(record) {
    const base = record && record.payload && typeof record.payload === 'object'
      ? { ...record.payload }
      : { ...(record || {}) };

    const clientEventId = record.client_event_id || base.client_event_id;
    const payload = {
      contact_name: base.contact_name || 'Người dân',
      phone: base.phone || base.contact_phone || '0000000000',
      lng: base.lng !== undefined ? base.lng : null,
      lat: base.lat !== undefined ? base.lat : null,
      location_source: base.location_source || 'manual',
      location_accuracy_m: base.location_accuracy_m ?? null,
      location_captured_at: base.location_captured_at ?? null,
      location_confirmed: base.location_confirmed !== undefined ? Boolean(base.location_confirmed) : true,
      location_description: base.location_description ?? null,
      location_landmark: base.location_landmark ?? null,
      people_count: Number(base.people_count) || 1,
      has_elderly_or_children: Boolean(base.has_elderly_or_children),
      water_level_cm: Number.isFinite(Number(base.water_level_cm)) ? Number(base.water_level_cm) : 0,
      priority: base.priority || base.urgency_level || 'high',
      notes: base.notes !== undefined ? base.notes : (base.note || null),
      client_event_id: clientEventId
    };
    return payload;
  }

  function buildFloodReportPayload(record) {
    const base = record && record.payload && typeof record.payload === 'object'
      ? { ...record.payload }
      : { ...(record || {}) };
    const clientEventId = record.client_event_id || base.client_event_id;
    return {
      lat: Number(base.lat),
      lng: Number(base.lng),
      level: base.level || 'medium',
      photo_url: base.photo_url || null,
      user_id: base.user_id || null,
      client_event_id: clientEventId
    };
  }

  const OfflineSyncManager = {
    EVENT_TYPES,
    SYNC_STATUS,
    MAX_RETRIES,
    BACKOFF_SCHEDULE_MS,
    STUCK_SENDING_TIMEOUT_MS: DEFAULT_STUCK_SENDING_MS,
    TAB_LOCK_TTL_MS,

    _tabId: `tab-${generateClientEventId().slice(0, 8)}`,
    _initialized: false,
    _syncPromise: null,
    _retryTimerId: null,
    _listenersBound: false,

    generateClientEventId,
    classifySyncError,
    computeBackoffDelayMs,

    async init(options = {}) {
      if (Number.isFinite(options.stuckSendingTimeoutMs) && options.stuckSendingTimeoutMs > 0) {
        this.STUCK_SENDING_TIMEOUT_MS = options.stuckSendingTimeoutMs;
      }

      if (global.OfflineDB && typeof global.OfflineDB.init === 'function') {
        await global.OfflineDB.init();
      }
      if (global.OfflineDB && typeof global.OfflineDB.saveMetadata === 'function') {
        const apiBase = (global.GRASSTOUCHER_CONFIG && global.GRASSTOUCHER_CONFIG.API_BASE_URL)
          || (global.location ? global.location.origin : '');
        if (apiBase) {
          global.OfflineDB.saveMetadata('api_base_url', apiBase).catch(() => {});
        }
      }

      await this._migrateLegacyLocalStorageQueue();
      await this._ensureClientEventIds();
      await this.recoverStuckSending();

      this._bindGlobalListeners();
      this._initialized = true;
      await this.refreshSyncUI();

      if (this._isOnline()) {
        // Trigger non-blocking initial sync
        this.syncNow({ reason: 'startup' }).catch(() => {});
      }
    },

    _isOnline() {
      return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    },

    _bindGlobalListeners() {
      if (this._listenersBound || typeof global.addEventListener !== 'function') return;
      this._listenersBound = true;

      global.addEventListener('online', () => {
        this.refreshSyncUI().catch(() => {});
        this.syncNow({ reason: 'online' }).catch(() => {});
      });

      global.addEventListener('offline', () => {
        this._clearRetryTimer();
        this.refreshSyncUI().catch(() => {});
      });

      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && this._isOnline()) {
            this.syncNow({ reason: 'visibilitychange' }).catch(() => {});
          }
        });
      }
    },

    async _migrateLegacyLocalStorageQueue() {
      if (!global.localStorage || !global.OfflineDB) return;
      let raw = null;
      try {
        raw = global.localStorage.getItem(LEGACY_QUEUE_STORAGE_KEY);
      } catch (_) {
        return;
      }
      if (!raw) return;

      try {
        const items = JSON.parse(raw);
        if (Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            if (!item || !item.payload) continue;
            const status = item.status === 'SYNCED' ? SYNC_STATUS.ACKNOWLEDGED : SYNC_STATUS.PENDING_OFFLINE;
            if (item.event_type === EVENT_TYPES.FLOOD_REPORT || item.type === EVENT_TYPES.FLOOD_REPORT) {
              await this.enqueueFloodReport(item.payload, {
                client_event_id: item.client_event_id || item.payload.client_event_id,
                sync_status: status,
                triggerSync: false
              });
            } else {
              await this.enqueueSOS(item.payload, {
                client_event_id: item.client_event_id || item.payload.client_event_id,
                sync_status: status,
                triggerSync: false
              });
            }
          }
        }
        global.localStorage.removeItem(LEGACY_QUEUE_STORAGE_KEY);
      } catch (_) {
        // Ignore malformed legacy queue
      }
    },

    async _ensureClientEventIds() {
      if (!global.OfflineDB) return;
      const sosList = await global.OfflineDB.getAllSOS();
      for (const rec of sosList) {
        if (!rec.client_event_id) {
          const cid = (rec.payload && rec.payload.client_event_id) || generateClientEventId();
          await global.OfflineDB.updateSOS(rec.local_id, { client_event_id: cid });
        }
      }
      const reportList = await global.OfflineDB.getAllFloodReports();
      for (const rec of reportList) {
        if (!rec.client_event_id) {
          const cid = (rec.payload && rec.payload.client_event_id) || generateClientEventId();
          await global.OfflineDB.updateFloodReport(rec.local_id, { client_event_id: cid });
        }
      }
    },

    async recoverStuckSending(nowMs = Date.now()) {
      if (!global.OfflineDB) return 0;
      let recovered = 0;
      const threshold = this.STUCK_SENDING_TIMEOUT_MS;

      const sosList = await global.OfflineDB.getAllSOS();
      for (const rec of sosList) {
        if (rec.sync_status === SYNC_STATUS.SENDING) {
          const lastAttempt = rec.last_attempt_at ? Date.parse(rec.last_attempt_at) : 0;
          if (!lastAttempt || nowMs - lastAttempt >= threshold) {
            await global.OfflineDB.updateSOS(rec.local_id, {
              sync_status: SYNC_STATUS.PENDING_OFFLINE,
              last_error: 'Recovered interrupted SENDING state'
            });
            recovered += 1;
          }
        }
      }

      const reportList = await global.OfflineDB.getAllFloodReports();
      for (const rec of reportList) {
        if (rec.sync_status === SYNC_STATUS.SENDING) {
          const lastAttempt = rec.last_attempt_at ? Date.parse(rec.last_attempt_at) : 0;
          if (!lastAttempt || nowMs - lastAttempt >= threshold) {
            await global.OfflineDB.updateFloodReport(rec.local_id, {
              sync_status: SYNC_STATUS.PENDING_OFFLINE,
              last_error: 'Recovered interrupted SENDING state'
            });
            recovered += 1;
          }
        }
      }

      return recovered;
    },

    async enqueueSOS(payload, options = {}) {
      if (!global.OfflineDB) {
        throw new Error('OfflineDB is required for OfflineSyncManager');
      }
      const clientEventId = options.client_event_id || (payload && payload.client_event_id) || generateClientEventId();
      const existingList = await global.OfflineDB.getAllSOS();
      const existing = existingList.find((item) => item.client_event_id === clientEventId);

      const syncStatus = options.sync_status || SYNC_STATUS.PENDING_OFFLINE;
      const nowIso = new Date().toISOString();

      if (existing) {
        const updated = await global.OfflineDB.updateSOS(existing.local_id, {
          payload: { ...payload, client_event_id: clientEventId },
          sync_status: existing.sync_status === SYNC_STATUS.ACKNOWLEDGED ? SYNC_STATUS.ACKNOWLEDGED : syncStatus,
          server_id: options.server_id !== undefined ? options.server_id : existing.server_id,
          acknowledged_at: options.acknowledged_at || existing.acknowledged_at || null
        });
        await this.refreshSyncUI();
        return updated;
      }

      let saved = await global.OfflineDB.saveSOS({
        local_id: options.local_id || `SOS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        event_type: EVENT_TYPES.SOS,
        client_event_id: clientEventId,
        payload: { ...payload, client_event_id: clientEventId },
        sync_status: syncStatus,
        retry_count: Number(options.retry_count) || 0,
        last_attempt_at: options.last_attempt_at || null,
        next_retry_at: options.next_retry_at || null,
        server_id: options.server_id !== undefined ? options.server_id : null,
        acknowledged_at: options.acknowledged_at || null,
        last_error: options.last_error || null,
        created_at: options.created_at || nowIso
      });
      if (options.last_attempt_at || options.next_retry_at || options.acknowledged_at) {
        saved = await global.OfflineDB.updateSOS(saved.local_id, {
          last_attempt_at: options.last_attempt_at || null,
          next_retry_at: options.next_retry_at || null,
          acknowledged_at: options.acknowledged_at || null
        });
      }

      this._registerBackgroundSync();
      await this.refreshSyncUI();

      if (options.triggerSync !== false && syncStatus === SYNC_STATUS.PENDING_OFFLINE && this._isOnline()) {
        this.syncNow({ reason: 'enqueue_sos' }).catch(() => {});
      }
      return saved;
    },

    async enqueueSOSDraft(payload) {
      const saved = await this.enqueueSOS(payload, {
        client_event_id: payload && payload.client_event_id,
        sync_status: SYNC_STATUS.PENDING_OFFLINE,
        triggerSync: false
      });
      return { id: saved.local_id, ...saved };
    },

    async enqueueFloodReport(payload, options = {}) {
      if (!global.OfflineDB) {
        throw new Error('OfflineDB is required for OfflineSyncManager');
      }
      const clientEventId = options.client_event_id || (payload && payload.client_event_id) || generateClientEventId();
      const existingList = await global.OfflineDB.getAllFloodReports();
      const existing = existingList.find((item) => item.client_event_id === clientEventId);

      const syncStatus = options.sync_status || SYNC_STATUS.PENDING_OFFLINE;
      const nowIso = new Date().toISOString();

      if (existing) {
        const updated = await global.OfflineDB.updateFloodReport(existing.local_id, {
          payload: { ...payload, client_event_id: clientEventId },
          sync_status: existing.sync_status === SYNC_STATUS.ACKNOWLEDGED ? SYNC_STATUS.ACKNOWLEDGED : syncStatus,
          server_id: options.server_id !== undefined ? options.server_id : existing.server_id,
          acknowledged_at: options.acknowledged_at || existing.acknowledged_at || null
        });
        await this.refreshSyncUI();
        return updated;
      }

      let saved = await global.OfflineDB.saveFloodReport({
        local_id: options.local_id || `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        event_type: EVENT_TYPES.FLOOD_REPORT,
        client_event_id: clientEventId,
        payload: { ...payload, client_event_id: clientEventId },
        sync_status: syncStatus,
        retry_count: Number(options.retry_count) || 0,
        last_attempt_at: options.last_attempt_at || null,
        next_retry_at: options.next_retry_at || null,
        server_id: options.server_id !== undefined ? options.server_id : null,
        acknowledged_at: options.acknowledged_at || null,
        last_error: options.last_error || null,
        created_at: options.created_at || nowIso
      });
      if (options.last_attempt_at || options.next_retry_at || options.acknowledged_at) {
        saved = await global.OfflineDB.updateFloodReport(saved.local_id, {
          last_attempt_at: options.last_attempt_at || null,
          next_retry_at: options.next_retry_at || null,
          acknowledged_at: options.acknowledged_at || null
        });
      }

      this._registerBackgroundSync();
      await this.refreshSyncUI();

      if (options.triggerSync !== false && syncStatus === SYNC_STATUS.PENDING_OFFLINE && this._isOnline()) {
        this.syncNow({ reason: 'enqueue_flood_report' }).catch(() => {});
      }
      return saved;
    },

    async markAcknowledged(eventType, clientEventId, serverId, meta = {}) {
      if (!global.OfflineDB || !clientEventId) return null;
      const nowIso = new Date().toISOString();
      if (eventType === EVENT_TYPES.FLOOD_REPORT) {
        const list = await global.OfflineDB.getAllFloodReports();
        const found = list.find((r) => r.client_event_id === clientEventId);
        if (!found) return null;
        const updated = await global.OfflineDB.updateFloodReport(found.local_id, {
          sync_status: SYNC_STATUS.ACKNOWLEDGED,
          server_id: serverId,
          acknowledged_at: nowIso,
          idempotent_replay: Boolean(meta.idempotent_replay),
          last_error: null,
          next_retry_at: null
        });
        await this.refreshSyncUI();
        return updated;
      }

      const list = await global.OfflineDB.getAllSOS();
      const found = list.find((r) => r.client_event_id === clientEventId);
      if (!found) return null;
      const updated = await global.OfflineDB.updateSOS(found.local_id, {
        sync_status: SYNC_STATUS.ACKNOWLEDGED,
        server_id: serverId,
        acknowledged_at: nowIso,
        idempotent_replay: Boolean(meta.idempotent_replay),
        last_error: null,
        next_retry_at: null
      });
      await this.refreshSyncUI();
      return updated;
    },

    _acquireCrossTabLock() {
      if (!global.localStorage) return true;
      try {
        const now = Date.now();
        const raw = global.localStorage.getItem(TAB_LOCK_STORAGE_KEY);
        if (raw) {
          const lock = JSON.parse(raw);
          if (lock && lock.owner !== this._tabId && Number(lock.expiresAt) > now) {
            return false;
          }
        }
        const nextLock = {
          owner: this._tabId,
          acquiredAt: now,
          expiresAt: now + this.TAB_LOCK_TTL_MS
        };
        global.localStorage.setItem(TAB_LOCK_STORAGE_KEY, JSON.stringify(nextLock));
        const verify = JSON.parse(global.localStorage.getItem(TAB_LOCK_STORAGE_KEY) || '{}');
        return verify.owner === this._tabId;
      } catch (_) {
        return true;
      }
    },

    _releaseCrossTabLock() {
      if (!global.localStorage) return;
      try {
        const raw = global.localStorage.getItem(TAB_LOCK_STORAGE_KEY);
        if (!raw) return;
        const lock = JSON.parse(raw);
        if (lock && lock.owner === this._tabId) {
          global.localStorage.removeItem(TAB_LOCK_STORAGE_KEY);
        }
      } catch (_) {
        // Ignore storage errors
      }
    },

    _clearRetryTimer() {
      if (this._retryTimerId !== null) {
        clearTimeout(this._retryTimerId);
        this._retryTimerId = null;
      }
    },

    _scheduleNextRetry(nextRetryAtMs) {
      this._clearRetryTimer();
      if (!Number.isFinite(nextRetryAtMs) || !this._isOnline()) return;
      const delay = Math.max(250, nextRetryAtMs - Date.now());
      this._retryTimerId = setTimeout(() => {
        this._retryTimerId = null;
        this.syncNow({ reason: 'backoff_timer' }).catch(() => {});
      }, delay);
    },

    _registerBackgroundSync() {
      try {
        if (
          typeof navigator !== 'undefined' &&
          navigator.serviceWorker &&
          navigator.serviceWorker.ready &&
          typeof global.SyncManager !== 'undefined'
        ) {
          navigator.serviceWorker.ready
            .then((reg) => {
              if (reg && reg.sync && typeof reg.sync.register === 'function') {
                return reg.sync.register('northstar-offline-sync');
              }
              return null;
            })
            .catch(() => {});
        }
      } catch (_) {
        // Ignore unsupported Background Sync
      }
    },

    async syncNow(options = {}) {
      if (!global.OfflineDB) {
        return { skipped: true, reason: 'no_offline_db' };
      }

      if (!this._isOnline() && !options.ignoreOfflineCheck) {
        await this.refreshSyncUI();
        return { skipped: true, reason: 'offline' };
      }

      if (this._syncPromise) {
        return this._syncPromise;
      }

      if (!this._acquireCrossTabLock()) {
        return { skipped: true, reason: 'cross_tab_locked' };
      }

      this._syncPromise = (async () => {
        const result = {
          acknowledged: 0,
          retried: 0,
          failed: 0,
          skippedBackoff: 0,
          details: []
        };

        try {
          await this.recoverStuckSending();

          const nowMs = Date.now();
          const manual = Boolean(options.manual || options.force);

          const sosRecords = (await global.OfflineDB.getAllSOS()).map((r) => ({
            store: 'sos_queue',
            eventType: EVENT_TYPES.SOS,
            record: r
          }));
          const reportRecords = (await global.OfflineDB.getAllFloodReports()).map((r) => ({
            store: 'flood_reports',
            eventType: EVENT_TYPES.FLOOD_REPORT,
            record: r
          }));

          const outbox = [...sosRecords, ...reportRecords].filter(({ record }) => {
            if (!record) return false;
            if (record.sync_status === SYNC_STATUS.ACKNOWLEDGED) return false;
            if (record.sync_status === SYNC_STATUS.FAILED) {
              return Boolean(options.retryFailed);
            }
            return record.sync_status === SYNC_STATUS.PENDING_OFFLINE;
          });

          outbox.sort((a, b) => {
            const ta = Date.parse(a.record.created_at || 0) || 0;
            const tb = Date.parse(b.record.created_at || 0) || 0;
            return ta - tb;
          });

          let earliestNextRetryMs = null;

          for (const item of outbox) {
            const rec = item.record;
            const nextRetryMs = rec.next_retry_at ? Date.parse(rec.next_retry_at) : 0;
            if (!manual && nextRetryMs && nextRetryMs > nowMs) {
              result.skippedBackoff += 1;
              if (earliestNextRetryMs === null || nextRetryMs < earliestNextRetryMs) {
                earliestNextRetryMs = nextRetryMs;
              }
              continue;
            }

            if (!this._isOnline() && !options.ignoreOfflineCheck) {
              break;
            }

            const clientEventId = rec.client_event_id || generateClientEventId();
            const attemptAtIso = new Date().toISOString();

            await this._updateRecord(item.store, rec.local_id, {
              client_event_id: clientEventId,
              sync_status: SYNC_STATUS.SENDING,
              last_attempt_at: attemptAtIso
            });
            await this.refreshSyncUI();

            try {
              const response = await this._sendItem(item.eventType, {
                ...rec,
                client_event_id: clientEventId
              });

              const serverId = item.eventType === EVENT_TYPES.SOS
                ? (response?.properties?.id ?? response?.id)
                : response?.id;

              if (!Number.isFinite(Number(serverId))) {
                throw Object.assign(new Error('Server response missing valid numeric ID'), {
                  type: 'HTTP',
                  status: 502
                });
              }

              const idempotentReplay = Boolean(
                item.eventType === EVENT_TYPES.SOS
                  ? (response?.properties?.idempotent_replay ?? response?.idempotent_replay)
                  : response?.idempotent_replay
              );

              await this._updateRecord(item.store, rec.local_id, {
                sync_status: SYNC_STATUS.ACKNOWLEDGED,
                server_id: Number(serverId),
                acknowledged_at: new Date().toISOString(),
                idempotent_replay: idempotentReplay,
                last_error: null,
                next_retry_at: null
              });

              result.acknowledged += 1;
              result.details.push({
                local_id: rec.local_id,
                event_type: item.eventType,
                client_event_id: clientEventId,
                server_id: Number(serverId),
                status: SYNC_STATUS.ACKNOWLEDGED,
                idempotent_replay: idempotentReplay
              });
            } catch (err) {
              const info = classifySyncError(err);
              const nextRetryCount = (Number(rec.retry_count) || 0) + 1;
              const exhausted = nextRetryCount >= this.MAX_RETRIES;

              if (!info.retryable || exhausted) {
                await this._updateRecord(item.store, rec.local_id, {
                  sync_status: SYNC_STATUS.FAILED,
                  retry_count: nextRetryCount,
                  next_retry_at: null,
                  last_error: err && err.message ? String(err.message).slice(0, 200) : info.code
                });
                result.failed += 1;
                result.details.push({
                  local_id: rec.local_id,
                  event_type: item.eventType,
                  client_event_id: clientEventId,
                  status: SYNC_STATUS.FAILED,
                  error_code: info.code
                });
              } else {
                const delayMs = computeBackoffDelayMs(nextRetryCount, info.retryAfterMs);
                const nextAtMs = Date.now() + delayMs;
                await this._updateRecord(item.store, rec.local_id, {
                  sync_status: SYNC_STATUS.PENDING_OFFLINE,
                  retry_count: nextRetryCount,
                  next_retry_at: new Date(nextAtMs).toISOString(),
                  last_error: err && err.message ? String(err.message).slice(0, 200) : info.code
                });
                result.retried += 1;
                if (earliestNextRetryMs === null || nextAtMs < earliestNextRetryMs) {
                  earliestNextRetryMs = nextAtMs;
                }
                result.details.push({
                  local_id: rec.local_id,
                  event_type: item.eventType,
                  client_event_id: clientEventId,
                  status: SYNC_STATUS.PENDING_OFFLINE,
                  retry_count: nextRetryCount,
                  delay_ms: delayMs
                });
              }
            }
          }

          if (earliestNextRetryMs !== null) {
            this._scheduleNextRetry(earliestNextRetryMs);
          }

          await global.OfflineDB.saveMetadata('last_sync_summary', {
            ran_at: new Date().toISOString(),
            acknowledged: result.acknowledged,
            retried: result.retried,
            failed: result.failed
          });
        } finally {
          this._syncPromise = null;
          this._releaseCrossTabLock();
          await this.refreshSyncUI();
        }

        return result;
      })();

      return this._syncPromise;
    },

    async _updateRecord(store, localId, patch) {
      if (store === 'flood_reports') {
        return global.OfflineDB.updateFloodReport(localId, patch);
      }
      return global.OfflineDB.updateSOS(localId, patch);
    },

    async _sendItem(eventType, record) {
      const path = eventType === EVENT_TYPES.FLOOD_REPORT ? '/api/reports' : '/api/sos';
      const payload = eventType === EVENT_TYPES.FLOOD_REPORT
        ? buildFloodReportPayload(record)
        : buildSOSPayload(record);

      if (global.NorthStarApi && typeof global.NorthStarApi.fetchJson === 'function') {
        return global.NorthStarApi.fetchJson(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const baseUrl = (global.GRASSTOUCHER_CONFIG && global.GRASSTOUCHER_CONFIG.API_BASE_URL) || '';
      const url = `${String(baseUrl).replace(/\/$/, '')}${path}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = new Error(`HTTP ${resp.status}`);
        err.type = 'HTTP';
        err.status = resp.status;
        err.retryAfter = resp.headers ? resp.headers.get('Retry-After') : null;
        throw err;
      }
      return resp.json();
    },

    async getStatusSummary() {
      const summary = {
        online: this._isOnline(),
        pending: 0,
        sending: 0,
        acknowledged: 0,
        failed: 0,
        sos_pending: 0,
        reports_pending: 0,
        total_outbox: 0
      };
      if (!global.OfflineDB) return summary;

      try {
        const sosList = await global.OfflineDB.getAllSOS();
        const reportList = await global.OfflineDB.getAllFloodReports();

        for (const r of sosList) {
          summary.total_outbox += 1;
          if (r.sync_status === SYNC_STATUS.ACKNOWLEDGED) summary.acknowledged += 1;
          else if (r.sync_status === SYNC_STATUS.SENDING) {
            summary.sending += 1;
            summary.sos_pending += 1;
          } else if (r.sync_status === SYNC_STATUS.FAILED) summary.failed += 1;
          else {
            summary.pending += 1;
            summary.sos_pending += 1;
          }
        }

        for (const r of reportList) {
          summary.total_outbox += 1;
          if (r.sync_status === SYNC_STATUS.ACKNOWLEDGED) summary.acknowledged += 1;
          else if (r.sync_status === SYNC_STATUS.SENDING) {
            summary.sending += 1;
            summary.reports_pending += 1;
          } else if (r.sync_status === SYNC_STATUS.FAILED) summary.failed += 1;
          else {
            summary.pending += 1;
            summary.reports_pending += 1;
          }
        }
      } catch (_) {
        // Return partial summary if DB unavailable
      }
      return summary;
    },

    async refreshSyncUI() {
      const summary = await this.getStatusSummary();
      if (typeof document === 'undefined') return summary;

      const netPill = document.getElementById('citizen-network-status');
      const netDot = document.getElementById('citizen-network-dot');
      const netLabel = document.getElementById('citizen-network-label');

      if (netPill && netDot && netLabel) {
        if (!summary.online) {
          netPill.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold bg-amber-950/90 border border-amber-500/60 text-amber-300 shadow-sm';
          netDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400';
          netLabel.textContent = summary.pending > 0 ? `Ngoại tuyến (${summary.pending})` : 'Ngoại tuyến';
        } else if (summary.sending > 0) {
          netPill.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold bg-cyan-950/90 border border-cyan-500/60 text-cyan-300 shadow-sm';
          netDot.className = 'w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping';
          netLabel.textContent = `Đang đồng bộ (${summary.sending})`;
        } else if (summary.pending > 0) {
          netPill.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold bg-amber-950/90 border border-amber-500/60 text-amber-300 shadow-sm';
          netDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse';
          netLabel.textContent = `Chờ đồng bộ (${summary.pending})`;
        } else if (summary.failed > 0) {
          netPill.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold bg-red-950/90 border border-red-500/60 text-red-300 shadow-sm';
          netDot.className = 'w-2.5 h-2.5 rounded-full bg-red-400';
          netLabel.textContent = `Lỗi đồng bộ (${summary.failed})`;
        } else {
          netPill.className = 'hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 shadow-sm';
          netDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]';
          netLabel.textContent = 'Trực tuyến';
        }
      }

      const pendingBadge = document.getElementById('citizen-sync-pending-badge');
      const statusText = document.getElementById('citizen-sync-status-text');
      const manualBtn = document.getElementById('btn-citizen-manual-sync');
      const sosBadge = document.getElementById('citizen-sos-sync-badge');

      if (pendingBadge) {
        const activeCount = summary.pending + summary.sending;
        pendingBadge.textContent = String(activeCount);
        pendingBadge.classList.toggle('hidden', activeCount === 0);
      }

      if (statusText) {
        if (summary.sending > 0) {
          statusText.textContent = `Đang gửi ${summary.sending} bản ghi lên máy chủ...`;
        } else if (summary.pending > 0) {
          statusText.textContent = summary.online
            ? `Còn ${summary.pending} bản ghi chờ đồng bộ`
            : `Ngoại tuyến: ${summary.pending} bản ghi đã lưu an toàn trên thiết bị`;
        } else if (summary.failed > 0) {
          statusText.textContent = `${summary.failed} bản ghi lỗi vĩnh viễn (không thể đồng bộ)`;
        } else if (summary.acknowledged > 0) {
          statusText.textContent = `Đã đồng bộ ${summary.acknowledged} bản ghi với máy chủ`;
        } else {
          statusText.textContent = summary.online ? 'Sẵn sàng đồng bộ' : 'Chế độ ngoại tuyến';
        }
      }

      if (manualBtn) {
        const hasWork = summary.pending + summary.failed > 0;
        manualBtn.classList.toggle('hidden', !hasWork && summary.sending === 0);
        manualBtn.disabled = summary.sending > 0 || !summary.online;
      }

      if (sosBadge) {
        if (summary.sos_pending > 0) {
          sosBadge.textContent = `SOS chờ gửi: ${summary.sos_pending}`;
          sosBadge.classList.remove('hidden');
        } else {
          sosBadge.classList.add('hidden');
        }
      }

      if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
        global.dispatchEvent(new global.CustomEvent('northstar:sync-updated', { detail: summary }));
      }

      return summary;
    },

    async getQueueCount() {
      const s = await this.getStatusSummary();
      return s.pending + s.sending;
    }
  };

  global.OfflineSyncManager = OfflineSyncManager;
})(typeof window !== 'undefined' ? window : globalThis);
