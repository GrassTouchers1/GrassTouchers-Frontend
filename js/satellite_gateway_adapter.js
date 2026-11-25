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
 * NORTHSTAR CITIZEN - Satellite Gateway Adapter (Phase 11 / CIT-12)
 * Lớp trừu tượng kết nối Gateway vệ tinh phần cứng.
 * Tuyệt đối không giả lập trạng thái CONNECTED hoặc ACKNOWLEDGED khi chưa có thiết bị/SDK thực tế.
 */
(function (global) {
  'use strict';

  const GATEWAY_STATES = Object.freeze({
    NOT_CONFIGURED: 'NOT_CONFIGURED',
    DISCONNECTED: 'DISCONNECTED',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    TRANSMITTING: 'TRANSMITTING',
    ACKNOWLEDGED: 'ACKNOWLEDGED',
    FAILED: 'FAILED'
  });

  let currentState = GATEWAY_STATES.NOT_CONFIGURED;
  let gatewayConfig = null;
  const technicalLogs = [];

  function addLog(level, code, detail) {
    technicalLogs.push({
      at: new Date().toISOString(),
      level,
      code,
      detail: String(detail || '').slice(0, 180)
    });
    if (technicalLogs.length > 50) technicalLogs.shift();
  }

  const SatelliteGatewayAdapter = {
    STATES: GATEWAY_STATES,

    getStatus() {
      return {
        state: currentState,
        configured: Boolean(gatewayConfig && gatewayConfig.endpoint),
        provider: gatewayConfig ? gatewayConfig.provider : null,
        logs: [...technicalLogs]
      };
    },

    configure(config) {
      if (!config || !config.endpoint || !config.provider) {
        currentState = GATEWAY_STATES.NOT_CONFIGURED;
        gatewayConfig = null;
        addLog('WARN', 'GATEWAY_NOT_CONFIGURED', 'Chưa cấu hình endpoint hoặc SDK Gateway vệ tinh.');
        return this.getStatus();
      }
      gatewayConfig = {
        provider: String(config.provider),
        endpoint: String(config.endpoint),
        transport: config.transport || null
      };
      currentState = GATEWAY_STATES.DISCONNECTED;
      addLog('INFO', 'GATEWAY_CONFIGURED', `Configured ${gatewayConfig.provider}`);
      return this.getStatus();
    },

    async connect() {
      if (!gatewayConfig || !gatewayConfig.endpoint) {
        currentState = GATEWAY_STATES.NOT_CONFIGURED;
        addLog('WARN', 'NO_HARDWARE_GATEWAY', 'Không có thiết bị Gateway vệ tinh được cấu hình.');
        return { ok: false, state: currentState, message: 'Chưa có thiết bị/dịch vụ Gateway vệ tinh.' };
      }

      currentState = GATEWAY_STATES.CONNECTING;
      try {
        if (typeof gatewayConfig.transport !== 'function') {
          throw new Error('Không có driver/SDK phần cứng vệ tinh khả dụng trên trình duyệt.');
        }
        const handshake = await gatewayConfig.transport('PING', {});
        if (!handshake || handshake.connected !== true) {
          throw new Error('Gateway không xác nhận kết nối.');
        }
        currentState = GATEWAY_STATES.CONNECTED;
        addLog('INFO', 'GATEWAY_CONNECTED', gatewayConfig.provider);
        return { ok: true, state: currentState };
      } catch (err) {
        currentState = GATEWAY_STATES.FAILED;
        addLog('ERROR', 'CONNECT_FAILED', err && err.message ? err.message : 'Gateway error');
        return { ok: false, state: currentState, message: err && err.message ? err.message : 'Kết nối Gateway thất bại.' };
      }
    },

    async sendSOS(relayPacket) {
      if (currentState !== GATEWAY_STATES.CONNECTED) {
        const failState = currentState === GATEWAY_STATES.NOT_CONFIGURED
          ? GATEWAY_STATES.NOT_CONFIGURED
          : GATEWAY_STATES.FAILED;
        addLog('ERROR', 'SEND_WITHOUT_GATEWAY', `Rejected send in state ${currentState}`);
        return {
          ok: false,
          state: failState,
          message: 'Không có Gateway vệ tinh đang kết nối. Không thể truyền qua vệ tinh.'
        };
      }

      currentState = GATEWAY_STATES.TRANSMITTING;
      try {
        const ack = await gatewayConfig.transport('SEND_SOS', {
          message_id: relayPacket.message_id,
          client_event_id: relayPacket.client_event_id,
          hop_count: relayPacket.hop_count
        });
        if (!ack || ack.acknowledged !== true || !ack.gateway_ref) {
          throw new Error('Gateway không trả về xác nhận ACKNOWLEDGED hợp lệ.');
        }
        currentState = GATEWAY_STATES.ACKNOWLEDGED;
        addLog('INFO', 'GATEWAY_ACK', `ref=${ack.gateway_ref}`);
        return { ok: true, state: currentState, gateway_ref: ack.gateway_ref };
      } catch (err) {
        currentState = GATEWAY_STATES.FAILED;
        addLog('ERROR', 'TRANSMIT_FAILED', err && err.message ? err.message : 'Transmit failed');
        return { ok: false, state: currentState, message: err && err.message ? err.message : 'Truyền qua vệ tinh thất bại.' };
      }
    },

    encodeCompactFrame(sosInput) {
      const base = (sosInput && sosInput.payload) ? sosInput.payload : (sosInput || {});
      const rawJson = JSON.stringify(sosInput || {});
      const originalBytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(rawJson).length : rawJson.length;
      const latNum = Number(base.lat ?? sosInput?.location?.lat);
      const lngNum = Number(base.lng ?? sosInput?.location?.lng);
      const coordStr = (Number.isFinite(latNum) && Number.isFinite(lngNum))
        ? `${latNum.toFixed(4)},${lngNum.toFixed(4)}`
        : 'NOGPS';
      const ppl = Math.max(1, Number(base.people_count) || 1);
      const depth = Math.max(0, Math.round(Number(base.water_level_cm) || 0));
      const prioMap = { critical: 'C', high: 'H', medium: 'M', low: 'L' };
      const prio = prioMap[String(base.priority || 'high').toLowerCase()] || 'H';
      const shortId = String(sosInput?.client_event_id || base.client_event_id || Date.now()).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
      const body = `NS1|${coordStr}|${ppl}|${depth}|${prio}|${shortId}`;
      let crc = 0;
      for (let i = 0; i < body.length; i++) {
        crc = (crc ^ body.charCodeAt(i)) & 0xff;
      }
      const checksum = crc.toString(16).toUpperCase().padStart(2, '0');
      let frame = `${body}|${checksum}`;
      if (frame.length > 120) {
        frame = frame.slice(0, 117) + checksum;
      }
      const frameBytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(frame).length : frame.length;
      return { frame, frameBytes, originalBytes, checksum };
    },

    resetForTest() {
      currentState = GATEWAY_STATES.NOT_CONFIGURED;
      gatewayConfig = null;
      technicalLogs.length = 0;
    }
  };

  global.SatelliteGatewayAdapter = SatelliteGatewayAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
