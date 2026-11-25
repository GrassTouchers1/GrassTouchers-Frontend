/**
 * Copyright (C) 2026 NORTHSTAR Contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at:
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * =========================================================================
 * NORTHSTAR CITIZEN - IndexedDB Offline-First Storage Engine (CIT-04)
 * Database: northstar_citizen_db (7 Object Stores)
 * Lưu ý: IndexedDB không tự mã hóa dữ liệu; không lưu thông tin bí mật tại đây.
 * =========================================================================
 */

(function (globalScope) {
  'use strict';

  const DB_NAME = 'northstar_citizen_db';
  const DB_VERSION = 1;
  const MAX_REPORT_BLOB_BYTES = 5 * 1024 * 1024; // Giới hạn ảnh Blob 5MB

  const STORES = {
    SOS_QUEUE: 'sos_queue',
    FLOOD_REPORTS: 'flood_reports',
    WEATHER_CACHE: 'weather_cache',
    DISASTER_CACHE: 'disaster_cache',
    SHELTERS_CACHE: 'shelters_cache',
    KNOWLEDGE_CACHE: 'knowledge_cache',
    SYNC_METADATA: 'sync_metadata'
  };

  class OfflineDBError extends Error {
    constructor(message, { type = 'DB_ERROR', cause = null } = {}) {
      super(message);
      this.name = 'OfflineDBError';
      this.type = type; // NOT_SUPPORTED | QUOTA_EXCEEDED | BLOCKED | VERSION_ERROR | VALIDATION | DB_ERROR
      this.cause = cause;
    }
  }

  let dbInstance = null;
  let openPromise = null;

  function isSupported() {
    return typeof globalScope !== 'undefined' && typeof globalScope.indexedDB !== 'undefined';
  }

  function classifyIDBError(err, fallbackMsg = 'Lỗi thao tác cơ sở dữ liệu ngoại tuyến.') {
    if (err instanceof OfflineDBError) return err;
    const name = err && err.name ? String(err.name) : '';
    const msg = err && err.message ? String(err.message) : '';
    if (name === 'QuotaExceededError' || /quota/i.test(msg)) {
      return new OfflineDBError('Bộ nhớ thiết bị đã đầy (QuotaExceededError). Dữ liệu SOS đang chờ vẫn được ưu tiên bảo toàn.', {
        type: 'QUOTA_EXCEEDED',
        cause: err
      });
    }
    if (name === 'SecurityError' || name === 'InvalidStateError') {
      return new OfflineDBError('Trình duyệt đang chặn IndexedDB (có thể do chế độ ẩn danh).', {
        type: 'NOT_SUPPORTED',
        cause: err
      });
    }
    return new OfflineDBError(fallbackMsg, { type: 'DB_ERROR', cause: err });
  }

  function ensureSchema(db, oldVersion) {
    if (oldVersion < 1) {
      if (!db.objectStoreNames.contains(STORES.SOS_QUEUE)) {
        const sosStore = db.createObjectStore(STORES.SOS_QUEUE, { keyPath: 'local_id' });
        sosStore.createIndex('sync_status', 'sync_status', { unique: false });
        sosStore.createIndex('created_at', 'created_at', { unique: false });
        sosStore.createIndex('client_event_id', 'client_event_id', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.FLOOD_REPORTS)) {
        const repStore = db.createObjectStore(STORES.FLOOD_REPORTS, { keyPath: 'local_id' });
        repStore.createIndex('sync_status', 'sync_status', { unique: false });
        repStore.createIndex('created_at', 'created_at', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.WEATHER_CACHE)) {
        const wStore = db.createObjectStore(STORES.WEATHER_CACHE, { keyPath: 'cache_key' });
        wStore.createIndex('expires_at', 'expires_at', { unique: false });
        wStore.createIndex('fetched_at', 'fetched_at', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.DISASTER_CACHE)) {
        const dStore = db.createObjectStore(STORES.DISASTER_CACHE, { keyPath: 'id' });
        dStore.createIndex('issued_at', 'issued_at', { unique: false });
        dStore.createIndex('expires_at', 'expires_at', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SHELTERS_CACHE)) {
        const sStore = db.createObjectStore(STORES.SHELTERS_CACHE, { keyPath: 'id' });
        sStore.createIndex('status', 'status', { unique: false });
        sStore.createIndex('updated_at', 'updated_at', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.KNOWLEDGE_CACHE)) {
        const kStore = db.createObjectStore(STORES.KNOWLEDGE_CACHE, { keyPath: 'id' });
        kStore.createIndex('topic', 'topic', { unique: false });
        kStore.createIndex('verified', 'verified', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_METADATA)) {
        db.createObjectStore(STORES.SYNC_METADATA, { keyPath: 'key' });
      }
    }
  }

  function openDatabase() {
    if (!isSupported()) {
      return Promise.reject(new OfflineDBError('Trình duyệt không hỗ trợ IndexedDB.', { type: 'NOT_SUPPORTED' }));
    }
    if (dbInstance) {
      return Promise.resolve(dbInstance);
    }
    if (openPromise) {
      return openPromise;
    }

    openPromise = new Promise((resolve, reject) => {
      let req;
      try {
        req = globalScope.indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        openPromise = null;
        reject(classifyIDBError(err, 'Không thể mở IndexedDB.'));
        return;
      }

      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        ensureSchema(db, event.oldVersion || 0);
      };

      req.onblocked = () => {
        console.warn('[OfflineDB] Kết nối IndexedDB đang bị chặn bởi tab khác.');
      };

      req.onerror = (event) => {
        openPromise = null;
        reject(classifyIDBError(event.target.error, 'Lỗi mở IndexedDB northstar_citizen_db.'));
      };

      req.onsuccess = (event) => {
        const db = event.target.result;
        dbInstance = db;
        openPromise = null;

        db.onversionchange = () => {
          console.warn('[OfflineDB] Phát hiện thay đổi phiên bản DB từ tab khác, đóng kết nối an toàn.');
          closeDatabase();
          if (typeof globalScope.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            globalScope.dispatchEvent(new CustomEvent('northstar:db_versionchange'));
          }
        };

        db.onclose = () => {
          dbInstance = null;
        };

        resolve(db);
      };
    });

    return openPromise;
  }

  function closeDatabase() {
    if (dbInstance) {
      try {
        dbInstance.close();
      } catch (e) {}
      dbInstance = null;
    }
    openPromise = null;
  }

  function deleteDatabase() {
    closeDatabase();
    if (!isSupported()) {
      return Promise.reject(new OfflineDBError('IndexedDB không được hỗ trợ.', { type: 'NOT_SUPPORTED' }));
    }
    return new Promise((resolve, reject) => {
      const req = globalScope.indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve(true);
      req.onblocked = () => reject(new OfflineDBError('Không thể xóa database vì đang bị tab khác giữ kết nối.', { type: 'BLOCKED' }));
      req.onerror = (e) => reject(classifyIDBError(e.target.error, 'Lỗi xóa database.'));
    });
  }

  async function getDatabaseVersion() {
    const db = await openDatabase();
    return db.version;
  }

  async function getStorageEstimate() {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
      try {
        const est = await navigator.storage.estimate();
        return {
          supported: true,
          usage: est.usage || 0,
          quota: est.quota || 0,
          usagePercent: est.quota ? Number(((est.usage / est.quota) * 100).toFixed(2)) : 0
        };
      } catch (e) {
        return { supported: false, usage: 0, quota: 0, usagePercent: 0 };
      }
    }
    return { supported: false, usage: 0, quota: 0, usagePercent: 0 };
  }

  async function requestPersistence() {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      try {
        const persisted = await navigator.storage.persist();
        return { supported: true, persisted: !!persisted };
      } catch (e) {
        return { supported: false, persisted: false };
      }
    }
    return { supported: false, persisted: false };
  }

  async function runTx(storeNames, mode, fn) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(storeNames, mode);
      } catch (err) {
        reject(classifyIDBError(err, 'Không thể khởi tạo transaction IndexedDB.'));
        return;
      }

      let result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = (e) => reject(classifyIDBError(tx.error || e.target.error, 'Transaction IndexedDB bị hủy.'));
      tx.onerror = (e) => reject(classifyIDBError(tx.error || e.target.error, 'Lỗi transaction IndexedDB.'));

      try {
        result = fn(tx, (r) => { result = r; });
      } catch (syncErr) {
        try { tx.abort(); } catch (_) {}
        reject(classifyIDBError(syncErr, 'Lỗi thực thi thao tác IndexedDB.'));
      }
    });
  }

  function reqToPromise(idbReq) {
    return new Promise((resolve, reject) => {
      idbReq.onsuccess = () => resolve(idbReq.result);
      idbReq.onerror = () => reject(classifyIDBError(idbReq.error));
    });
  }

  // =========================================================================
  // SOS QUEUE API
  // =========================================================================
  async function saveSOS(record) {
    if (!record || typeof record !== 'object') {
      throw new OfflineDBError('Bản ghi SOS không hợp lệ.', { type: 'VALIDATION' });
    }
    const nowIso = new Date().toISOString();
    const localId = record.local_id || record.id || `SOS-LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const item = {
      local_id: String(localId),
      client_event_id: record.client_event_id || null, // Không tự tạo mới nếu không có (GĐ4 phụ trách)
      payload: record.payload || record,
      created_at: record.created_at || nowIso,
      updated_at: nowIso,
      sync_status: record.sync_status || 'PENDING_OFFLINE',
      retry_count: Number.isFinite(record.retry_count) ? record.retry_count : 0,
      last_error: record.last_error || null,
      server_id: (record.server_id !== undefined && record.server_id !== null) ? record.server_id : null
    };
    await runTx(STORES.SOS_QUEUE, 'readwrite', (tx) => {
      tx.objectStore(STORES.SOS_QUEUE).put(item);
    });
    return item;
  }

  async function getSOS(localId) {
    const db = await openDatabase();
    const tx = db.transaction(STORES.SOS_QUEUE, 'readonly');
    return reqToPromise(tx.objectStore(STORES.SOS_QUEUE).get(String(localId)));
  }

  async function getAllSOS() {
    const db = await openDatabase();
    const tx = db.transaction(STORES.SOS_QUEUE, 'readonly');
    return reqToPromise(tx.objectStore(STORES.SOS_QUEUE).getAll());
  }

  async function updateSOS(localId, patch) {
    const existing = await getSOS(localId);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...patch,
      local_id: existing.local_id,
      updated_at: new Date().toISOString()
    };
    await runTx(STORES.SOS_QUEUE, 'readwrite', (tx) => {
      tx.objectStore(STORES.SOS_QUEUE).put(updated);
    });
    return updated;
  }

  async function deleteSOS(localId) {
    await runTx(STORES.SOS_QUEUE, 'readwrite', (tx) => {
      tx.objectStore(STORES.SOS_QUEUE).delete(String(localId));
    });
    return true;
  }

  async function countPendingSOS() {
    const all = await getAllSOS();
    return all.filter((item) => item.sync_status !== 'SERVER_RECEIVED' && item.sync_status !== 'SYNCED').length;
  }

  // =========================================================================
  // FLOOD REPORTS API
  // =========================================================================
  async function saveFloodReport(record) {
    if (!record || typeof record !== 'object') {
      throw new OfflineDBError('Báo cáo ngập không hợp lệ.', { type: 'VALIDATION' });
    }
    if (record.photo_blob && record.photo_blob.size > MAX_REPORT_BLOB_BYTES) {
      throw new OfflineDBError('Ảnh đính kèm vượt quá giới hạn 5MB.', { type: 'QUOTA_EXCEEDED' });
    }
    const nowIso = new Date().toISOString();
    const localId = record.local_id || `REP-LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const item = {
      local_id: String(localId),
      client_event_id: record.client_event_id || (record.payload && record.payload.client_event_id) || null,
      payload: record.payload || record,
      location: record.location || null,
      description: record.description || '',
      photo_blob: record.photo_blob || null,
      created_at: record.created_at || nowIso,
      sync_status: record.sync_status || 'PENDING_OFFLINE',
      retry_count: Number.isFinite(record.retry_count) ? record.retry_count : 0,
      last_error: record.last_error || null,
      server_id: (record.server_id !== undefined && record.server_id !== null) ? record.server_id : null
    };
    await runTx(STORES.FLOOD_REPORTS, 'readwrite', (tx) => {
      tx.objectStore(STORES.FLOOD_REPORTS).put(item);
    });
    return item;
  }

  async function getFloodReport(localId) {
    const db = await openDatabase();
    const tx = db.transaction(STORES.FLOOD_REPORTS, 'readonly');
    return reqToPromise(tx.objectStore(STORES.FLOOD_REPORTS).get(String(localId)));
  }

  async function getAllFloodReports() {
    const db = await openDatabase();
    const tx = db.transaction(STORES.FLOOD_REPORTS, 'readonly');
    return reqToPromise(tx.objectStore(STORES.FLOOD_REPORTS).getAll());
  }

  async function updateFloodReport(localId, patch) {
    const existing = await getFloodReport(localId);
    if (!existing) return null;
    const updated = { ...existing, ...patch, local_id: existing.local_id };
    await runTx(STORES.FLOOD_REPORTS, 'readwrite', (tx) => {
      tx.objectStore(STORES.FLOOD_REPORTS).put(updated);
    });
    return updated;
  }

  async function deleteFloodReport(localId) {
    await runTx(STORES.FLOOD_REPORTS, 'readwrite', (tx) => {
      tx.objectStore(STORES.FLOOD_REPORTS).delete(String(localId));
    });
    return true;
  }

  // =========================================================================
  // WEATHER CACHE API
  // =========================================================================
  async function saveWeatherCache(record) {
    if (!record || !record.data || record.is_sample === true) {
      throw new OfflineDBError('Không lưu dữ liệu thời tiết mẫu giả vào weather_cache.', { type: 'VALIDATION' });
    }
    const nowMs = Date.now();
    const ttlMs = Number.isFinite(record.ttl_ms) ? record.ttl_ms : 60 * 60 * 1000;
    const item = {
      cache_key: record.cache_key || 'default',
      data: record.data,
      source: record.source || 'Open-Meteo Weather API (CC-BY 4.0)',
      region: record.region || 'Không rõ khu vực',
      coordinates: record.coordinates || null,
      data_updated_at: record.data_updated_at || null,
      fetched_at: record.fetched_at || new Date(nowMs).toISOString(),
      expires_at: Number.isFinite(record.expires_at) ? record.expires_at : (nowMs + ttlMs)
    };
    await runTx(STORES.WEATHER_CACHE, 'readwrite', (tx) => {
      tx.objectStore(STORES.WEATHER_CACHE).put(item);
    });
    return item;
  }

  async function getWeatherCache(cacheKey = 'default') {
    const db = await openDatabase();
    const tx = db.transaction(STORES.WEATHER_CACHE, 'readonly');
    return reqToPromise(tx.objectStore(STORES.WEATHER_CACHE).get(String(cacheKey)));
  }

  async function getAllWeatherCache() {
    const db = await openDatabase();
    const tx = db.transaction(STORES.WEATHER_CACHE, 'readonly');
    return reqToPromise(tx.objectStore(STORES.WEATHER_CACHE).getAll());
  }

  async function clearExpiredWeatherCache(nowMs = Date.now()) {
    const db = await openDatabase();
    const tx = db.transaction(STORES.WEATHER_CACHE, 'readonly');
    const all = await reqToPromise(tx.objectStore(STORES.WEATHER_CACHE).getAll());
    const expiredKeys = all.filter((w) => Number.isFinite(w.expires_at) && w.expires_at <= nowMs).map((w) => w.cache_key);
    if (expiredKeys.length > 0) {
      await runTx(STORES.WEATHER_CACHE, 'readwrite', (wtx) => {
        const store = wtx.objectStore(STORES.WEATHER_CACHE);
        expiredKeys.forEach((k) => store.delete(k));
      });
    }
    return expiredKeys.length;
  }

  // =========================================================================
  // DISASTER CACHE API
  // =========================================================================
  async function saveDisasterCache(recordOrList) {
    const list = Array.isArray(recordOrList) ? recordOrList : [recordOrList];
    const nowIso = new Date().toISOString();
    const normalized = list
      .filter((r) => r && r.id !== undefined && r.id !== null)
      .map((r) => ({
        id: String(r.id),
        title: r.title || '',
        content: r.content || r.description || '',
        region: r.region || r.location_name || '',
        hazard_type: r.hazard_type || 'flood',
        severity: r.severity || 'warning',
        status: r.status || 'active',
        radius_m: r.radius_m ?? null,
        coordinates: r.coordinates || null,
        source: r.source || 'NORTHSTAR Backend (/api/disasters)',
        issued_at: r.issued_at || r.start_time || r.created_at || null, // Không tự tạo timestamp mới cho dữ liệu cũ
        start_time: r.start_time || null,
        end_time: r.end_time || null,
        expires_at: r.expires_at || r.end_time || null,
        fetched_at: r.fetched_at || nowIso,
        cache_expires_at: Number.isFinite(r.cache_expires_at) ? r.cache_expires_at : (Date.now() + 60 * 60 * 1000),
        verified: r.verified !== false
      }));

    if (!normalized.length) return [];
    await runTx(STORES.DISASTER_CACHE, 'readwrite', (tx) => {
      const store = tx.objectStore(STORES.DISASTER_CACHE);
      normalized.forEach((item) => store.put(item));
    });
    return normalized;
  }

  async function getDisasterCache(id) {
    const db = await openDatabase();
    const tx = db.transaction(STORES.DISASTER_CACHE, 'readonly');
    return reqToPromise(tx.objectStore(STORES.DISASTER_CACHE).get(String(id)));
  }

  async function getAllDisasterCache() {
    const db = await openDatabase();
    const tx = db.transaction(STORES.DISASTER_CACHE, 'readonly');
    return reqToPromise(tx.objectStore(STORES.DISASTER_CACHE).getAll());
  }

  // =========================================================================
  // SHELTERS CACHE API
  // =========================================================================
  async function saveShelterCache(recordOrList) {
    const list = Array.isArray(recordOrList) ? recordOrList : [recordOrList];
    const nowIso = new Date().toISOString();
    const normalized = list
      .filter((s) => s && s.id !== undefined && s.id !== null)
      .map((s) => ({
        id: String(s.id),
        name: s.name || '',
        address: s.address || '',
        coordinates: s.coordinates || null,
        capacity: (s.capacity !== undefined && s.capacity !== null) ? Number(s.capacity) : null,
        current_occupancy: (s.current_occupancy !== undefined && s.current_occupancy !== null) ? Number(s.current_occupancy) : null,
        status: s.status || 'unknown', // Không mặc định tất cả đều đang hoạt động
        updated_at: s.updated_at || nowIso,
        source: s.source || 'NORTHSTAR Backend',
        verified: s.verified !== false
      }));

    if (!normalized.length) return [];
    await runTx(STORES.SHELTERS_CACHE, 'readwrite', (tx) => {
      const store = tx.objectStore(STORES.SHELTERS_CACHE);
      normalized.forEach((item) => store.put(item));
    });
    return normalized;
  }

  async function getShelterCache(id) {
    const db = await openDatabase();
    const tx = db.transaction(STORES.SHELTERS_CACHE, 'readonly');
    return reqToPromise(tx.objectStore(STORES.SHELTERS_CACHE).get(String(id)));
  }

  async function getAllShelterCache() {
    const db = await openDatabase();
    const tx = db.transaction(STORES.SHELTERS_CACHE, 'readonly');
    return reqToPromise(tx.objectStore(STORES.SHELTERS_CACHE).getAll());
  }

  // =========================================================================
  // KNOWLEDGE CACHE API
  // =========================================================================
  function normalizeVi(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  async function saveKnowledge(recordOrList) {
    const list = Array.isArray(recordOrList) ? recordOrList : [recordOrList];
    const nowIso = new Date().toISOString();
    const approved = list
      .filter((k) => k && k.id && k.content && k.moderation_status !== 'rejected' && k.verified !== false)
      .map((k) => ({
        id: String(k.id),
        topic: k.topic || 'general',
        title: k.title || '',
        content: k.content,
        keywords: Array.isArray(k.keywords) ? k.keywords : [],
        source: k.source || 'NORTHSTAR Survival Guide',
        version: k.version || '1.0',
        updated_at: k.updated_at || nowIso,
        moderation_status: k.moderation_status || 'approved',
        verified: true
      }));

    if (!approved.length) return [];
    await runTx(STORES.KNOWLEDGE_CACHE, 'readwrite', (tx) => {
      const store = tx.objectStore(STORES.KNOWLEDGE_CACHE);
      approved.forEach((item) => store.put(item));
    });
    return approved;
  }

  async function getAllKnowledge() {
    const db = await openDatabase();
    const tx = db.transaction(STORES.KNOWLEDGE_CACHE, 'readonly');
    return reqToPromise(tx.objectStore(STORES.KNOWLEDGE_CACHE).getAll());
  }

  async function searchKnowledge(query) {
    const q = normalizeVi(query);
    const all = await getAllKnowledge();
    if (!q) return all.filter((k) => k.verified === true);
    const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
    return all
      .filter((k) => k.verified === true && k.moderation_status === 'approved')
      .filter((k) => {
        const haystack = normalizeVi(`${k.title} ${k.topic} ${k.content} ${(k.keywords || []).join(' ')}`);
        if (haystack.includes(q)) return true;
        return tokens.some((t) => haystack.includes(t));
      });
  }

  // =========================================================================
  // SYNC METADATA API (Không lưu thông tin nhạy cảm)
  // =========================================================================
  async function saveMetadata(key, value) {
    const item = {
      key: String(key),
      value,
      updated_at: new Date().toISOString()
    };
    await runTx(STORES.SYNC_METADATA, 'readwrite', (tx) => {
      tx.objectStore(STORES.SYNC_METADATA).put(item);
    });
    return item;
  }

  async function getMetadata(key) {
    const db = await openDatabase();
    const tx = db.transaction(STORES.SYNC_METADATA, 'readonly');
    const row = await reqToPromise(tx.objectStore(STORES.SYNC_METADATA).get(String(key)));
    return row ? row.value : null;
  }

  // =========================================================================
  // MIGRATION AN TOÀN TỪ LOCALSTORAGE SANG INDEXEDDB
  // =========================================================================
  async function migrateFromLocalStorage(options = {}) {
    const { force = false } = options;
    const report = {
      migration_version: 1,
      status: 'STARTED',
      total_found: 0,
      valid_count: 0,
      migrated_count: 0,
      error_count: 0,
      skipped_count: 0,
      invalid_reasons: [],
      started_at: new Date().toISOString(),
      completed_at: null
    };

    if (!force) {
      const prevMeta = await getMetadata('localstorage_migration_v1');
      if (prevMeta && prevMeta.status === 'COMPLETED') {
        return { ...prevMeta, skipped_already_completed: true };
      }
    }

    if (typeof globalScope.localStorage === 'undefined') {
      report.status = 'SKIPPED_NO_LOCALSTORAGE';
      report.completed_at = new Date().toISOString();
      await saveMetadata('localstorage_migration_v1', report);
      return report;
    }

    const sosItemsToWrite = [];
    const reportItemsToWrite = [];
    const seenSosKeys = new Set();

    function parseJsonArray(raw, keyName) {
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          report.error_count++;
          report.invalid_reasons.push(`${keyName}: dữ liệu không phải mảng JSON`);
          return [];
        }
        return parsed;
      } catch (e) {
        report.error_count++;
        report.invalid_reasons.push(`${keyName}: lỗi phân tích JSON`);
        return [];
      }
    }

    // 1. Quét northstar_sos_drafts
    const rawDrafts = globalScope.localStorage.getItem('northstar_sos_drafts');
    const drafts = parseJsonArray(rawDrafts, 'northstar_sos_drafts');
    drafts.forEach((d, idx) => {
      report.total_found++;
      if (!d || typeof d !== 'object' || !d.payload || typeof d.payload !== 'object') {
        report.error_count++;
        report.invalid_reasons.push(`northstar_sos_drafts[${idx}]: thiếu payload hợp lệ`);
        return;
      }
      const localId = String(d.id || `SOS-MIG-${idx}-${Date.parse(d.queued_at || '') || Date.now()}`);
      if (seenSosKeys.has(localId)) {
        report.skipped_count++;
        return;
      }
      seenSosKeys.add(localId);
      report.valid_count++;
      sosItemsToWrite.push({
        local_id: localId,
        client_event_id: d.payload.client_event_id || null,
        payload: d.payload,
        created_at: d.queued_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: d.synced ? 'SERVER_RECEIVED' : 'PENDING_OFFLINE',
        retry_count: 0,
        last_error: null,
        server_id: d.server_id || null
      });
    });

    // 2. Quét northstar_offline_outbox (chỉ lấy SOS chưa có trong drafts)
    const rawOutbox = globalScope.localStorage.getItem('northstar_offline_outbox');
    const outbox = parseJsonArray(rawOutbox, 'northstar_offline_outbox');
    outbox.forEach((o, idx) => {
      if (!o || o.action !== 'SOS_BEACON_DISPATCH') return;
      report.total_found++;
      if (!o.payload || typeof o.payload !== 'object') {
        report.error_count++;
        report.invalid_reasons.push(`northstar_offline_outbox[${idx}]: thiếu payload SOS`);
        return;
      }
      const localId = String(o.id || `SOS-OUTBOX-${idx}`);
      if (seenSosKeys.has(localId)) {
        report.skipped_count++;
        return;
      }
      seenSosKeys.add(localId);
      report.valid_count++;
      sosItemsToWrite.push({
        local_id: localId,
        client_event_id: o.payload.client_event_id || null,
        payload: o.payload,
        created_at: o.queued_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'PENDING_OFFLINE',
        retry_count: 0,
        last_error: null,
        server_id: null
      });
    });

    // 3. Quét offline_flood_reports
    const rawReports = globalScope.localStorage.getItem('offline_flood_reports');
    const floodReports = parseJsonArray(rawReports, 'offline_flood_reports');
    floodReports.forEach((r, idx) => {
      report.total_found++;
      if (!r || typeof r !== 'object' || (r.lat === undefined && r.lng === undefined && !r.location_name)) {
        report.error_count++;
        report.invalid_reasons.push(`offline_flood_reports[${idx}]: thiếu thông tin vị trí`);
        return;
      }
      report.valid_count++;
      const localId = String(r.local_id || `REP-MIG-${idx}-${Date.parse(r.created_at || '') || Date.now()}`);
      reportItemsToWrite.push({
        local_id: localId,
        payload: r,
        location: (r.lat !== undefined && r.lng !== undefined) ? { lat: r.lat, lng: r.lng } : null,
        description: r.notes || r.location_name || '',
        created_at: r.created_at || new Date().toISOString(),
        sync_status: r.status === 'SYNCED' ? 'SERVER_RECEIVED' : 'PENDING_OFFLINE',
        retry_count: 0,
        last_error: null,
        server_id: r.server_id || null
      });
    });

    // 4. Ghi vào IndexedDB trong 1 transaction nguyên tử (không ghi đè bản đã tồn tại để chống trùng)
    try {
      const existingSos = await getAllSOS();
      const existingSosMap = new Set(existingSos.map((x) => x.local_id));
      const existingRep = await getAllFloodReports();
      const existingRepMap = new Set(existingRep.map((x) => x.local_id));

      const finalSos = sosItemsToWrite.filter((x) => {
        if (existingSosMap.has(x.local_id)) {
          report.skipped_count++;
          return false;
        }
        return true;
      });
      const finalRep = reportItemsToWrite.filter((x) => {
        if (existingRepMap.has(x.local_id)) {
          report.skipped_count++;
          return false;
        }
        return true;
      });

      if (finalSos.length > 0 || finalRep.length > 0) {
        await runTx([STORES.SOS_QUEUE, STORES.FLOOD_REPORTS], 'readwrite', (tx) => {
          const sosStore = tx.objectStore(STORES.SOS_QUEUE);
          const repStore = tx.objectStore(STORES.FLOOD_REPORTS);
          finalSos.forEach((item) => sosStore.put(item));
          finalRep.forEach((item) => repStore.put(item));
        });
      }

      // 5. Đọc lại từ IndexedDB để xác minh 100% trước khi kết luận
      const verifiedSos = await getAllSOS();
      const verifiedSosIds = new Set(verifiedSos.map((x) => x.local_id));
      const verifiedRep = await getAllFloodReports();
      const verifiedRepIds = new Set(verifiedRep.map((x) => x.local_id));

      const allSosVerified = finalSos.every((x) => verifiedSosIds.has(x.local_id));
      const allRepVerified = finalRep.every((x) => verifiedRepIds.has(x.local_id));

      if (!allSosVerified || !allRepVerified) {
        throw new OfflineDBError('Xác minh sau migration không khớp dữ liệu đã ghi.', { type: 'DB_ERROR' });
      }

      report.migrated_count = finalSos.length + finalRep.length;
      report.status = report.error_count > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
      report.completed_at = new Date().toISOString();

      await saveMetadata('database_version', DB_VERSION);
      await saveMetadata('localstorage_migration_v1', report);
      // Quy tắc bảo toàn: KHÔNG xóa khóa localStorage cũ trong giai đoạn chuyển tiếp khi chưa tất cả module đều dùng IndexedDB
      return report;
    } catch (err) {
      report.status = 'FAILED';
      report.error_count++;
      report.invalid_reasons.push(err.message || 'Lỗi ghi IndexedDB khi migration');
      report.completed_at = new Date().toISOString();
      try {
        await saveMetadata('localstorage_migration_v1', report);
      } catch (_) {}
      return report;
    }
  }

  // Dọn dẹp chỉ những cache hết hạn không thiết yếu (tuyệt đối không xóa SOS hay Flood Reports)
  async function cleanupExpiredNonEssentialCache(nowMs = Date.now()) {
    const clearedWeather = await clearExpiredWeatherCache(nowMs);
    return { clearedWeather };
  }

  const OfflineDB = {
    DB_NAME,
    DB_VERSION,
    STORES,
    OfflineDBError,
    isSupported,
    openDatabase,
    closeDatabase,
    deleteDatabase,
    getDatabaseVersion,
    getStorageEstimate,
    requestPersistence,
    saveSOS,
    getSOS,
    getAllSOS,
    updateSOS,
    deleteSOS,
    countPendingSOS,
    saveFloodReport,
    getFloodReport,
    getAllFloodReports,
    updateFloodReport,
    deleteFloodReport,
    saveWeatherCache,
    getWeatherCache,
    getAllWeatherCache,
    clearExpiredWeatherCache,
    saveDisasterCache,
    getDisasterCache,
    getAllDisasterCache,
    saveShelterCache,
    getShelterCache,
    getAllShelterCache,
    saveKnowledge,
    searchKnowledge,
    getAllKnowledge,
    saveMetadata,
    getMetadata,
    migrateFromLocalStorage,
    cleanupExpiredNonEssentialCache
  };

  globalScope.OfflineDB = OfflineDB;
  globalScope.OfflineDBError = OfflineDBError;
})(typeof window !== 'undefined' ? window : globalThis);
