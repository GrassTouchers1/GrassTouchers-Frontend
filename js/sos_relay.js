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
 * NORTHSTAR CITIZEN - SOS Relay & P2P Manual Transfer (Phase 11 / CIT-12)
 * Lưu ý kiến trúc: Đây là cơ chế chuyển tiếp thủ công (Copy / Web Share / QR / Text),
 * KHÔNG phải mạng mesh tự động.
 */
(function (global) {
  'use strict';

  const DEFAULT_MAX_HOPS = 3;
  const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 giờ
  const PREFIX = 'NORTHSTAR-RELAY-V1:';
  let cachedKeyPair = null;

  function randomId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function sha256Hex(text) {
    if (global.crypto && global.crypto.subtle && typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(text);
      const digest = await global.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    }
    throw new Error('WebCrypto SHA-256 unavailable');
  }

  async function getOrCreateSigningKeys() {
    if (cachedKeyPair) return cachedKeyPair;
    if (global.crypto && global.crypto.subtle && typeof global.crypto.subtle.generateKey === 'function') {
      const kp = await global.crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );
      const pubJwk = await global.crypto.subtle.exportKey('jwk', kp.publicKey);
      cachedKeyPair = { privateKey: kp.privateKey, publicKey: kp.publicKey, pubJwk };
      return cachedKeyPair;
    }
    return null;
  }

  function canonicalCore(pkt) {
    return JSON.stringify({
      message_id: pkt.message_id,
      client_event_id: pkt.client_event_id,
      origin_device_id: pkt.origin_device_id,
      created_at: pkt.created_at,
      expires_at: pkt.expires_at,
      location: pkt.location,
      location_source: pkt.location_source,
      payload: pkt.payload
    });
  }

  function maskPhone(phone) {
    const s = String(phone || '').trim();
    if (s.length <= 4) return '***';
    return `***${s.slice(-4)}`;
  }

  async function createRelayPacket(sosRecord, options = {}) {
    const nowMs = Date.now();
    const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : DEFAULT_TTL_MS;
    const base = (sosRecord && sosRecord.payload) ? sosRecord.payload : (sosRecord || {});
    const clientEventId = (sosRecord && sosRecord.client_event_id) || base.client_event_id || randomId();
    const originDeviceId = options.originDeviceId || `dev-${randomId().slice(0, 8)}`;

    const packet = {
      schema: 'northstar.sos.relay.v1',
      relay_mode: 'MANUAL_PWA_RELAY',
      message_id: randomId(),
      client_event_id: clientEventId,
      origin_device_id: originDeviceId,
      created_at: new Date(nowMs).toISOString(),
      expires_at: new Date(nowMs + ttlMs).toISOString(),
      location: {
        lat: base.lat ?? null,
        lng: base.lng ?? null,
        location_description: base.location_description || null,
        location_landmark: base.location_landmark || null
      },
      location_source: base.location_source || 'unknown',
      payload: {
        people_count: Number(base.people_count) || 1,
        has_elderly_or_children: Boolean(base.has_elderly_or_children),
        water_level_cm: Number(base.water_level_cm) || 0,
        priority: base.priority || 'high',
        notes: base.notes || null,
        contact_phone_masked: maskPhone(base.phone || base.contact_phone)
      },
      hop_count: 0,
      max_hops: Number.isFinite(options.maxHops) ? options.maxHops : DEFAULT_MAX_HOPS,
      relay_history: []
    };

    const coreStr = canonicalCore(packet);
    const contentHash = await sha256Hex(coreStr);
    packet.integrity_metadata = {
      algorithm: 'SHA-256',
      content_hash: contentHash
    };

    const keys = await getOrCreateSigningKeys();
    if (keys && global.crypto && global.crypto.subtle) {
      const sigBuf = await global.crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        keys.privateKey,
        new TextEncoder().encode(contentHash)
      );
      const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
      packet.authentication_metadata = {
        scheme: 'ECDSA-P256',
        public_key_jwk: keys.pubJwk,
        signature: sigB64
      };
    } else {
      packet.authentication_metadata = {
        scheme: 'UNAVAILABLE',
        signature: null
      };
    }

    return packet;
  }

  function encodeForShare(packet) {
    const json = JSON.stringify(packet);
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return PREFIX + btoa(bin);
  }

  function decodeFromShare(raw) {
    const text = String(raw || '').trim();
    if (text.startsWith(PREFIX)) {
      const b64 = text.slice(PREFIX.length);
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    }
    return JSON.parse(text);
  }

  async function verifyAndAcceptRelayPacket(rawOrPacket, relayerDeviceId = `relay-${randomId().slice(0, 8)}`) {
    let packet;
    try {
      packet = typeof rawOrPacket === 'string' ? decodeFromShare(rawOrPacket) : JSON.parse(JSON.stringify(rawOrPacket));
    } catch (_) {
      return { ok: false, reason: 'INVALID_FORMAT', message: 'Gói tin Relay không đúng định dạng.' };
    }

    const required = ['message_id', 'client_event_id', 'origin_device_id', 'created_at', 'expires_at', 'location', 'payload', 'integrity_metadata'];
    for (const k of required) {
      if (packet[k] === undefined || packet[k] === null) {
        return { ok: false, reason: 'MISSING_FIELD', message: `Thiếu trường bắt buộc: ${k}` };
      }
    }

    const expMs = Date.parse(packet.expires_at);
    if (Number.isNaN(expMs) || expMs <= Date.now()) {
      return { ok: false, reason: 'EXPIRED', message: 'Gói tin SOS Relay đã quá hạn hiệu lực.' };
    }

    const hop = Number(packet.hop_count || 0);
    const maxHops = Number(packet.max_hops || DEFAULT_MAX_HOPS);
    if (hop >= maxHops) {
      return { ok: false, reason: 'MAX_HOPS_EXCEEDED', message: `Gói tin đã đạt giới hạn chuyển tiếp (${hop}/${maxHops}).` };
    }

    const expectedHash = await sha256Hex(canonicalCore(packet));
    if (!packet.integrity_metadata || packet.integrity_metadata.content_hash !== expectedHash) {
      return { ok: false, reason: 'INTEGRITY_TAMPERED', message: 'Cảnh báo: Nội dung gói tin SOS đã bị thay đổi, không khớp mã băm toàn vẹn.' };
    }

    if (packet.authentication_metadata && packet.authentication_metadata.scheme === 'ECDSA-P256') {
      try {
        const pubKey = await global.crypto.subtle.importKey(
          'jwk',
          packet.authentication_metadata.public_key_jwk,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['verify']
        );
        const sigBytes = Uint8Array.from(atob(packet.authentication_metadata.signature), (c) => c.charCodeAt(0));
        const validSig = await global.crypto.subtle.verify(
          { name: 'ECDSA', hash: { name: 'SHA-256' } },
          pubKey,
          sigBytes,
          new TextEncoder().encode(expectedHash)
        );
        if (!validSig) {
          return { ok: false, reason: 'INVALID_SIGNATURE', message: 'Chữ ký xác thực nguồn gửi không hợp lệ.' };
        }
      } catch (_) {
        return { ok: false, reason: 'SIGNATURE_ERROR', message: 'Không thể xác minh chữ ký nguồn gửi.' };
      }
    }

    // Duplicate check against local IndexedDB
    if (global.OfflineDB && typeof global.OfflineDB.getAllSOS === 'function') {
      const existing = await global.OfflineDB.getAllSOS().catch(() => []);
      if (existing.some((r) => r.client_event_id === packet.client_event_id && r.sync_status === 'ACKNOWLEDGED')) {
        return { ok: false, reason: 'DUPLICATE_EVENT', message: 'Sự kiện SOS này đã được xác nhận trên máy chủ trước đó.' };
      }
    }

    const nextHop = hop + 1;
    const forwarded = {
      ...packet,
      hop_count: nextHop,
      relay_history: [
        ...(Array.isArray(packet.relay_history) ? packet.relay_history : []),
        { relayer_device_id: relayerDeviceId, received_at: new Date().toISOString(), hop: nextHop }
      ]
    };

    return { ok: true, packet: forwarded };
  }

  async function forwardRelayPacketToBackend(packet) {
    const check = await verifyAndAcceptRelayPacket(packet);
    if (!check.ok && check.reason !== 'DUPLICATE_EVENT') {
      throw new Error(check.message);
    }
    const verifiedPacket = check.ok ? check.packet : packet;
    const path = '/api/sos/relay';
    if (global.NorthStarApi && typeof global.NorthStarApi.fetchJson === 'function') {
      return global.NorthStarApi.fetchJson(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifiedPacket)
      });
    }
    const base = (global.GRASSTOUCHER_CONFIG && global.GRASSTOUCHER_CONFIG.API_BASE_URL) || '';
    const res = await fetch(`${String(base).replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifiedPacket)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function shareRelayPacket(packet) {
    const encoded = encodeForShare(packet);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({
        title: 'NORTHSTAR SOS Relay Packet',
        text: encoded
      });
      return { method: 'web_share', encoded };
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(encoded);
      return { method: 'clipboard', encoded };
    }
    return { method: 'text', encoded };
  }

  async function probeWebBluetooth() {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      return { supported: false, reason: 'BLUETOOTH_UNSUPPORTED', message: 'Trình duyệt hoặc thiết bị không hỗ trợ Web Bluetooth.' };
    }
    try {
      await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
      return { supported: true };
    } catch (err) {
      return {
        supported: true,
        granted: false,
        reason: err && err.name === 'NotAllowedError' ? 'PERMISSION_DENIED' : 'BLUETOOTH_ERROR',
        message: err && err.message ? err.message : 'Người dùng từ chối hoặc không tìm thấy thiết bị Bluetooth.'
      };
    }
  }

  global.SOSRelayManager = {
    DEFAULT_MAX_HOPS,
    createRelayPacket,
    encodeForShare,
    decodeFromShare,
    verifyAndAcceptRelayPacket,
    forwardRelayPacketToBackend,
    shareRelayPacket,
    probeWebBluetooth
  };
})(typeof window !== 'undefined' ? window : globalThis);
