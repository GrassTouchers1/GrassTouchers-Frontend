/**
 * Copyright 2026 GrassTouchers Team
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
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NorthStar / GrassToucher Frontend - Cấu hình Endpoint Backend API, WebSocket & Helper Gọi API Thống Nhất.
 * Hỗ trợ môi trường Development, Production (same-origin/reverse proxy) và override an toàn.
 * 100% Mã nguồn mở (Apache-2.0 License).
 */
(function (globalScope) {
    'use strict';

    const DEFAULT_TIMEOUT_MS = 12000;
    const STORAGE_OVERRIDE_KEY = 'northstar_api_base_url';
    const DEV_FRONTEND_PORTS = new Set(['3000', '3001', '4173', '5173', '5500', '8080']);

    function normalizeBaseUrl(rawUrl) {
        if (rawUrl === null || rawUrl === undefined) return '';
        const trimmed = String(rawUrl).trim();
        if (!trimmed) return '';
        return trimmed.replace(/\/+$/, '');
    }

    function isValidBaseUrl(url) {
        if (url === '') return true; // Cho phép đường dẫn tương đối (same-origin / reverse proxy)
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    function detectEnvironment(loc) {
        const port = loc && loc.port ? String(loc.port) : '';
        const hostname = loc && loc.hostname ? String(loc.hostname) : '';
        const protocol = loc && loc.protocol ? String(loc.protocol) : 'http:';

        if (protocol === 'file:') return 'development';
        if (DEV_FRONTEND_PORTS.has(port)) return 'development';
        if ((hostname === 'localhost' || hostname === '127.0.0.1') && port !== '8000' && port !== '' && port !== '80' && port !== '443') {
            return 'development';
        }
        return 'production';
    }

    function resolveBaseUrl(loc) {
        // 1. Ưu tiên cấu hình inject lúc deploy hoặc test
        if (globalScope.__NORTHSTAR_ENV__ && typeof globalScope.__NORTHSTAR_ENV__.API_BASE_URL === 'string') {
            const envUrl = normalizeBaseUrl(globalScope.__NORTHSTAR_ENV__.API_BASE_URL);
            if (isValidBaseUrl(envUrl)) return envUrl;
        }

        // 2. Cho phép override cục bộ có kiểm tra hợp lệ (hữu ích khi test trên thiết bị LAN)
        try {
            if (globalScope.localStorage) {
                const stored = globalScope.localStorage.getItem(STORAGE_OVERRIDE_KEY);
                if (stored !== null) {
                    const cleanStored = normalizeBaseUrl(stored);
                    if (isValidBaseUrl(cleanStored)) return cleanStored;
                }
            }
        } catch (e) {
            // Bỏ qua nếu localStorage bị chặn
        }

        const port = loc && loc.port ? String(loc.port) : '';
        const hostname = loc && loc.hostname ? String(loc.hostname) : 'localhost';
        const protocol = loc && loc.protocol === 'https:' ? 'https:' : 'http:';

        // 3. Same-origin khi chạy trực tiếp từ backend (port 8000) hoặc reverse proxy production (80/443/"")
        if (port === '8000' || hostname === 'backend') {
            return '';
        }

        const env = detectEnvironment(loc);
        if (env === 'production') {
            return '';
        }

        // 4. Development frontend chạy cổng riêng (3000, 5173, ...) -> trỏ sang backend cổng 8000 cùng host
        const devHost = (!hostname || loc.protocol === 'file:') ? 'localhost' : hostname;
        return `${protocol}//${devHost}:8000`;
    }

    function resolveWsUrl(apiBaseUrl, loc, path = '/ws/navigation') {
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        if (apiBaseUrl) {
            try {
                const u = new URL(apiBaseUrl);
                const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
                return `${wsProto}//${u.host}${cleanPath}`;
            } catch (e) {
                // fallback bên dưới
            }
        }
        const host = (loc && loc.host) ? loc.host : 'localhost:8000';
        const wsProto = (loc && loc.protocol === 'https:') ? 'wss:' : 'ws:';
        return `${wsProto}//${host}${cleanPath}`;
    }

    const loc = globalScope.location || { protocol: 'http:', hostname: 'localhost', host: 'localhost:3000', port: '3000' };
    const envName = detectEnvironment(loc);
    const resolvedApiBase = resolveBaseUrl(loc);
    const resolvedWsUrl = resolveWsUrl(resolvedApiBase, loc, '/ws/navigation');

    const GRASSTOUCHER_CONFIG = {
        ENV: envName,
        API_BASE_URL: resolvedApiBase,
        WS_BASE_URL: resolvedWsUrl,
        DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,

        // Cấu hình bản đồ OpenStreetMap
        DEFAULT_CENTER: [21.0285, 105.8030],
        DEFAULT_ZOOM: 13,

        validateConfig() {
            const errors = [];
            if (!isValidBaseUrl(this.API_BASE_URL)) {
                errors.push('API_BASE_URL không hợp lệ.');
            }
            if (!Number.isFinite(this.DEFAULT_TIMEOUT_MS) || this.DEFAULT_TIMEOUT_MS < 1000) {
                errors.push('DEFAULT_TIMEOUT_MS phải >= 1000ms.');
            }
            return {
                valid: errors.length === 0,
                env: this.ENV,
                apiBaseUrl: this.API_BASE_URL || '(same-origin)',
                errors
            };
        },

        setApiBaseUrl(newUrl) {
            const clean = normalizeBaseUrl(newUrl);
            if (!isValidBaseUrl(clean)) {
                throw new Error('Base URL không hợp lệ (chỉ chấp nhận http://, https:// hoặc rỗng cho same-origin).');
            }
            this.API_BASE_URL = clean;
            this.WS_BASE_URL = resolveWsUrl(clean, globalScope.location || loc, '/ws/navigation');
            try {
                if (globalScope.localStorage) {
                    if (clean === '') globalScope.localStorage.removeItem(STORAGE_OVERRIDE_KEY);
                    else globalScope.localStorage.setItem(STORAGE_OVERRIDE_KEY, clean);
                }
            } catch (e) {}
            return this.API_BASE_URL;
        },

        getApiUrl(path) {
            if (!path || typeof path !== 'string') {
                throw new Error('Đường dẫn API không hợp lệ.');
            }
            if (/^https?:\/\//i.test(path)) {
                return path;
            }
            const base = isValidBaseUrl(this.API_BASE_URL) ? normalizeBaseUrl(this.API_BASE_URL) : '';
            const cleanPath = path.startsWith('/') ? path : '/' + path;
            return `${base}${cleanPath}`;
        },

        getWsUrl(path = '/ws/navigation') {
            return resolveWsUrl(this.API_BASE_URL, globalScope.location || loc, path);
        }
    };

    class NorthStarApiError extends Error {
        constructor(message, { type = 'UNKNOWN', status = 0, url = '', cause = null } = {}) {
            super(message);
            this.name = 'NorthStarApiError';
            this.type = type; // TIMEOUT | ABORTED | NETWORK | HTTP | JSON_PARSE | CONFIG
            this.status = status;
            this.url = url;
            this.cause = cause;
        }
    }

    function sanitizeForLog(value) {
        const sensitiveKeys = new Set(['phone', 'contact_name', 'password', 'api_key', 'token', 'secret', 'lat', 'lng']);
        if (!value || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map(sanitizeForLog);
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (sensitiveKeys.has(k.toLowerCase())) {
                out[k] = '[REDACTED]';
            } else if (v && typeof v === 'object') {
                out[k] = sanitizeForLog(v);
            } else {
                out[k] = v;
            }
        }
        return out;
    }

    async function fetchJson(path, options = {}) {
        const {
            timeoutMs = GRASSTOUCHER_CONFIG.DEFAULT_TIMEOUT_MS,
            signal: externalSignal = null,
            ...fetchOptions
        } = options;

        let url;
        try {
            url = GRASSTOUCHER_CONFIG.getApiUrl(path);
        } catch (cfgErr) {
            throw new NorthStarApiError('Cấu hình đường dẫn API không hợp lệ.', {
                type: 'CONFIG',
                cause: cfgErr
            });
        }

        const controller = new AbortController();
        let didTimeout = false;
        const onExternalAbort = () => controller.abort();

        if (externalSignal) {
            if (externalSignal.aborted) {
                controller.abort();
            } else {
                externalSignal.addEventListener('abort', onExternalAbort, { once: true });
            }
        }

        const timerId = setTimeout(() => {
            didTimeout = true;
            controller.abort();
        }, timeoutMs);

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal
            });

            if (!response.ok) {
                let serverMsg = '';
                try {
                    const errBody = await response.json();
                    serverMsg = errBody?.detail || errBody?.message || '';
                } catch (_) {
                    // Bỏ qua nếu body lỗi không phải JSON
                }
                const friendlyMsg = serverMsg
                    ? `Máy chủ phản hồi lỗi (${response.status}): ${serverMsg}`
                    : `Không thể xử lý yêu cầu từ máy chủ (HTTP ${response.status}).`;
                throw new NorthStarApiError(friendlyMsg, {
                    type: 'HTTP',
                    status: response.status,
                    url
                });
            }

            if (response.status === 204) return null;

            const rawText = await response.text();
            if (!rawText) return null;

            try {
                return JSON.parse(rawText);
            } catch (parseErr) {
                throw new NorthStarApiError('Dữ liệu phản hồi từ máy chủ không đúng định dạng JSON.', {
                    type: 'JSON_PARSE',
                    status: response.status,
                    url,
                    cause: parseErr
                });
            }
        } catch (err) {
            if (err instanceof NorthStarApiError) throw err;
            if (err && err.name === 'AbortError') {
                if (didTimeout) {
                    throw new NorthStarApiError(`Kết nối tới máy chủ quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`, {
                        type: 'TIMEOUT',
                        url,
                        cause: err
                    });
                }
                throw new NorthStarApiError('Yêu cầu kết nối đã bị hủy.', {
                    type: 'ABORTED',
                    url,
                    cause: err
                });
            }
            throw new NorthStarApiError('Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng.', {
                type: 'NETWORK',
                url,
                cause: err
            });
        } finally {
            clearTimeout(timerId);
            if (externalSignal) {
                externalSignal.removeEventListener('abort', onExternalAbort);
            }
        }
    }

    const NorthStarApi = {
        fetchJson,
        NorthStarApiError,
        sanitizeForLog,
        getConfig: () => GRASSTOUCHER_CONFIG
    };

    globalScope.GRASSTOUCHER_CONFIG = GRASSTOUCHER_CONFIG;
    globalScope.NORTHSTAR_CONFIG = GRASSTOUCHER_CONFIG;
    globalScope.NorthStarApi = NorthStarApi;
    globalScope.NorthStarApiError = NorthStarApiError;
    globalScope.getApiUrl = function (path) {
        return GRASSTOUCHER_CONFIG.getApiUrl(path);
    };
})(typeof window !== 'undefined' ? window : globalThis);
