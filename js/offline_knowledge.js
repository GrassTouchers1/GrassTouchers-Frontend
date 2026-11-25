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
 * NORTHSTAR CITIZEN - Offline Knowledge Engine (Phase 10 / CIT-11)
 * Truy vấn kho tri thức sinh tồn thiên tai cục bộ (KHÔNG phải LLM offline).
 */
(function (global) {
  'use strict';

  let cachedKnowledge = null;
  let loadError = null;

  function normalizeText(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isValidEntry(entry) {
    return Boolean(
      entry &&
      typeof entry === 'object' &&
      entry.id &&
      entry.topic &&
      typeof entry.answer === 'string' &&
      entry.answer.trim().length > 0 &&
      entry.source &&
      entry.reviewed_at
    );
  }

  async function loadKnowledgeBase(customEntries = null) {
    loadError = null;
    if (Array.isArray(customEntries)) {
      const valid = customEntries.filter(isValidEntry);
      cachedKnowledge = valid;
      return valid;
    }
    if (Array.isArray(cachedKnowledge) && cachedKnowledge.length > 0) {
      return cachedKnowledge;
    }

    try {
      const resp = await fetch('./data/offline_knowledge_vi.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (!json || !Array.isArray(json.entries)) {
        throw new Error('Dữ liệu kho tri thức sai cấu trúc (thiếu mảng entries).');
      }
      const valid = json.entries.filter(isValidEntry);
      cachedKnowledge = valid;

      if (global.OfflineDB && typeof global.OfflineDB.saveKnowledge === 'function' && valid.length > 0) {
        global.OfflineDB.saveKnowledge(
          valid.map((e) => ({
            id: e.id,
            title: e.title,
            category: e.topic,
            keywords: [...(e.keywords || []), ...(e.synonyms || [])],
            content: e.answer,
            source: e.source,
            reviewed_at: e.reviewed_at,
            version: e.version
          }))
        ).catch(() => {});
      }
      return valid;
    } catch (err) {
      loadError = err && err.message ? err.message : 'Không thể nạp kho tri thức ngoại tuyến.';
      // Fallback to IndexedDB knowledge_cache if previously stored
      try {
        if (global.OfflineDB && typeof global.OfflineDB.getAllKnowledge === 'function') {
          const idbList = await global.OfflineDB.getAllKnowledge();
          if (Array.isArray(idbList) && idbList.length > 0) {
            cachedKnowledge = idbList.map((k) => ({
              id: k.id,
              topic: k.category || 'general',
              title: k.title || '',
              keywords: k.keywords || [],
              synonyms: [],
              answer: k.content || '',
              source: k.source || 'IndexedDB Knowledge Cache',
              reviewed_at: k.reviewed_at || 'N/A',
              version: k.version || '1.0'
            })).filter(isValidEntry);
            return cachedKnowledge;
          }
        }
      } catch (_) {}
      cachedKnowledge = [];
      return [];
    }
  }

  function search(query, entries) {
    const qNorm = normalizeText(query);
    if (!qNorm || !Array.isArray(entries) || entries.length === 0) return [];
    const qWords = qNorm.split(' ').filter((t) => t.length >= 2);
    const qWordSet = new Set(qWords);
    const qPadded = ` ${qNorm} `;

    const scored = [];
    for (const entry of entries) {
      let score = 0;
      const titleNorm = normalizeText(entry.title);
      const titleWords = new Set(titleNorm.split(' ').filter(Boolean));
      const kwList = [...(entry.keywords || []), ...(entry.synonyms || [])].map(normalizeText);

      for (const kw of kwList) {
        if (!kw) continue;
        if (kw.includes(' ')) {
          if (qPadded.includes(` ${kw} `)) score += 10;
        } else if (qWordSet.has(kw) && !(kw === 'bao' && qWordSet.has('nhieu'))) {
          score += 6;
        }
      }
      for (const tok of qWords) {
        if (tok.length < 3 || (tok === 'bao' && qWordSet.has('nhieu'))) continue;
        if (titleWords.has(tok)) score += 2.5;
        if (kwList.some((k) => k.split(' ').includes(tok))) score += 2;
      }

      if (score >= 4) {
        scored.push({ entry, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map((s) => s.entry);
  }

  function isRealtimeQuestion(query) {
    const qNorm = normalizeText(query);
    return (
      qNorm.includes('thoi tiet hien tai') ||
      qNorm.includes('nhiet do bay gio') ||
      qNorm.includes('duong nao an toan') ||
      qNorm.includes('muc nuoc hien tai') ||
      qNorm.includes('mua bay gio')
    );
  }

  async function answer(query, options = {}) {
    const entries = await loadKnowledgeBase(options.customEntries || null);

    if (loadError && entries.length === 0) {
      return {
        found: false,
        mode: 'offline_knowledge',
        provider_used: 'Trợ lý tri thức Offline (Kho dữ liệu cục bộ)',
        reply: '⚠️ Kho tri thức ngoại tuyến hiện bị lỗi hoặc chưa được tải trước. Nếu đang gặp nguy hiểm, vui lòng gọi ngay 112 / 114 / 115.',
        source: 'NORTHSTAR Offline Knowledge',
        is_fallback: true
      };
    }

    if (isRealtimeQuestion(query)) {
      return {
        found: false,
        mode: 'offline_knowledge',
        provider_used: 'Trợ lý tri thức Offline (Kho dữ liệu cục bộ)',
        reply: '⚠️ Đang ở chế độ ngoại tuyến hoặc không thể xác minh dữ liệu thời gian thực (thời tiết hiện tại, mực nước hay tuyến đường an toàn). Vui lòng kiểm tra dữ liệu cache kèm thời điểm cập nhật ở tab Thời Tiết / Lộ Trình hoặc gọi 112 / 114 khi khẩn cấp.',
        source: 'NORTHSTAR Safety Policy',
        is_fallback: true
      };
    }

    const matches = search(query, entries);
    if (matches.length === 0) {
      return {
        found: false,
        mode: 'offline_knowledge',
        provider_used: 'Trợ lý tri thức Offline (Kho dữ liệu cục bộ)',
        reply: 'Chưa có dữ liệu hướng dẫn phù hợp trong kho tri thức ngoại tuyến cho câu hỏi này. Hệ thống không tự suy diễn hướng dẫn sinh tồn. Vui lòng liên hệ tổng đài khẩn cấp 112 (Cứu nạn), 114 (Cứu hỏa) hoặc 115 (Y tế) khi cần hỗ trợ.',
        source: 'NORTHSTAR Offline Knowledge',
        is_fallback: true
      };
    }

    const best = matches[0];
    return {
      found: true,
      mode: 'offline_knowledge',
      provider_used: `Trợ lý tri thức Offline (${best.source})`,
      reply: `**[${best.title}]**\n${best.answer}`,
      source: best.source,
      reviewed_at: best.reviewed_at,
      version: best.version,
      entry_id: best.id,
      is_fallback: true
    };
  }

  const OfflineKnowledgeEngine = {
    normalizeText,
    loadKnowledgeBase,
    search,
    answer,
    isRealtimeQuestion,
    resetCacheForTest() {
      cachedKnowledge = null;
      loadError = null;
    }
  };

  global.OfflineKnowledgeEngine = OfflineKnowledgeEngine;
})(typeof window !== 'undefined' ? window : globalThis);
