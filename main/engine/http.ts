import { performance } from 'perf_hooks';
import { ApiRequest } from '../types/db';
import { addHistory } from '../db/queries/history';
import { getCookiesForUrl, parseAndSaveSetCookie, Cookie } from '../db/queries/cookies';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export interface ExecuteResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  contentType: string;
  durationMs: number;
  sizeBytes: number;
  cookies?: Cookie[];
  error?: string;
}

export async function executeHttpRequest(request: ApiRequest): Promise<ExecuteResponse> {
  const startTime = performance.now();
  let url = request.url.trim();

  // If protocol doesn't have http/https, default to https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  // 1. Process query parameters into URL
  try {
    const parsedUrl = new URL(url);
    const enabledParams = (request.params || []).filter((p) => p.enabled && p.key.trim() !== '');
    for (const p of enabledParams) {
      parsedUrl.searchParams.append(p.key.trim(), p.value);
    }
    url = parsedUrl.toString();
  } catch (err: any) {
    return {
      status: 0,
      statusText: 'Invalid URL',
      headers: {},
      body: null,
      contentType: '',
      durationMs: 0,
      sizeBytes: 0,
      error: `Invalid URL format: ${err.message}`,
    };
  }

  // 2. Prepare headers
  const headers: Record<string, string> = {};
  for (const h of request.headers || []) {
    if (h.enabled && h.key.trim() !== '') {
      headers[h.key.trim()] = h.value;
    }
  }

  // 2.5 Attach Cookies from local Cookie Store if not manually overridden and not disabled
  const disableCookies = Boolean((request.settings as any)?.disableCookies);
  if (!disableCookies && !headers['Cookie'] && !headers['cookie']) {
    const storedCookies = getCookiesForUrl(url);
    if (storedCookies) {
      headers['Cookie'] = storedCookies;
    }
  }

  // 3. Process Authentication
  if (request.auth) {
    if (request.auth.type === 'bearer' && request.auth.bearer?.token) {
      headers['Authorization'] = `Bearer ${request.auth.bearer.token.trim()}`;
    } else if (request.auth.type === 'basic' && request.auth.basic?.username) {
      const credentials = `${request.auth.basic.username}:${request.auth.basic.password || ''}`;
      const encoded = Buffer.from(credentials).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    } else if (request.auth.type === 'apiKey' && request.auth.apiKey?.key) {
      const { key, value, addTo } = request.auth.apiKey;
      if (addTo === 'query') {
        const parsed = new URL(url);
        parsed.searchParams.append(key, value);
        url = parsed.toString();
      } else {
        headers[key] = value;
      }
    }
  }

  // 4. Process Request Body
  let bodyPayload: any = undefined;
  const method = request.method.toUpperCase();
  const allowsBody = !['GET', 'HEAD'].includes(method);

  if (allowsBody && request.body) {
    if (request.protocol === 'GRAPHQL') {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      let variables = {};
      if (request.body.graphql?.variables) {
        try {
          variables = JSON.parse(request.body.graphql.variables);
        } catch {
          variables = {};
        }
      }
      bodyPayload = JSON.stringify({
        query: request.body.graphql?.query || request.body.raw || '',
        variables,
      });
    } else if (request.protocol === 'SOAP' || request.body.type === 'xml') {
      if (!headers['Content-Type']) headers['Content-Type'] = 'text/xml; charset=utf-8';
      bodyPayload = request.body.raw || '';
    } else if (request.body.type === 'json') {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      bodyPayload = request.body.raw || '';
    } else if (request.body.type === 'javascript') {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/javascript';
      bodyPayload = request.body.raw || '';
    } else if (request.body.type === 'x-www-form-urlencoded') {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
      const encoded = (request.body.urlEncoded || [])
        .filter((item) => item.enabled && item.key)
        .map((item) => `${encodeURIComponent(item.key)}=${encodeURIComponent(item.value)}`)
        .join('&');
      bodyPayload = encoded;
    } else if (request.body.type === 'formData') {
      const fs = await import('fs');
      const path = await import('path');
      const nodeFormData = new FormData();

      for (const item of request.body.formData || []) {
        if (!item.enabled || !item.key.trim()) continue;

        if (item.type === 'file' && item.value) {
          try {
            if (fs.existsSync(item.value)) {
              const buffer = fs.readFileSync(item.value);
              const fileName = item.fileName || path.basename(item.value);
              const blob = new Blob([buffer]);
              nodeFormData.append(item.key.trim(), blob, fileName);
            } else {
              nodeFormData.append(item.key.trim(), item.value);
            }
          } catch (fileErr) {
            console.warn(`[HTTP] Failed to read file for form data ${item.key}:`, fileErr);
            nodeFormData.append(item.key.trim(), item.value);
          }
        } else {
          nodeFormData.append(item.key.trim(), item.value || '');
        }
      }

      bodyPayload = nodeFormData;
      // Do not manually set Content-Type for multipart/form-data, fetch sets boundary
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === 'content-type') {
          delete headers[k];
        }
      }
    } else if (request.body.type === 'raw') {
      bodyPayload = request.body.raw || '';
    }
  }

  // 5. Execute CORS-free Fetch
  const controller = new AbortController();
  const timeoutMs = request.settings?.timeout && request.settings.timeout > 0 ? request.settings.timeout : 30000;
  const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchResponse = await fetch(url, {
      method,
      headers,
      body: bodyPayload,
      signal: controller.signal,
      redirect: request.settings?.followRedirects === false ? 'manual' : 'follow',
    });

    clearTimeout(timeoutTimer);
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    fetchResponse.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    // 5.5 Extract and Store Set-Cookie Headers
    const receivedCookies: Cookie[] = [];
    if (!disableCookies) {
      const setCookieHeaders: string[] =
        typeof (fetchResponse.headers as any).getSetCookie === 'function'
          ? (fetchResponse.headers as any).getSetCookie()
          : responseHeaders['set-cookie']
          ? [responseHeaders['set-cookie']]
          : [];

      for (const sc of setCookieHeaders) {
        const parsedCookie = parseAndSaveSetCookie(sc, url);
        if (parsedCookie) {
          receivedCookies.push(parsedCookie);
        }
      }
    }

    const contentType = responseHeaders['content-type'] || '';
    const rawText = await fetchResponse.text();
    const sizeBytes = Buffer.byteLength(rawText, 'utf-8');

    // Check Max Response Size setting
    const maxMb = (request.settings as any)?.maxResponseSizeMb || 0;
    if (maxMb > 0 && sizeBytes > maxMb * 1024 * 1024) {
      return {
        status: fetchResponse.status,
        statusText: fetchResponse.statusText || 'Response Too Large',
        headers: responseHeaders,
        body: `Response payload (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeded maximum allowed limit of ${maxMb} MB.`,
        contentType: 'text/plain',
        durationMs,
        sizeBytes,
        error: `Response size exceeded maximum allowed limit of ${maxMb} MB.`,
        cookies: receivedCookies,
      };
    }

    let parsedBody: any = rawText;

    // Parse JSON if applicable or forced
    const forceJson = (request.settings as any)?.responseFormatDetection === 'json';
    if (contentType.includes('application/json') || forceJson) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = rawText;
      }
    } else if (contentType.includes('xml') || request.protocol === 'SOAP') {
      // Format XML cleanly if possible
      try {
        const parser = new XMLParser({ ignoreAttributes: false });
        const obj = parser.parse(rawText);
        const builder = new XMLBuilder({ format: true, ignoreAttributes: false });
        parsedBody = builder.build(obj);
      } catch {
        parsedBody = rawText;
      }
    }

    const result: ExecuteResponse = {
      status: fetchResponse.status,
      statusText: fetchResponse.statusText || (fetchResponse.ok ? 'OK' : 'Error'),
      headers: responseHeaders,
      body: parsedBody,
      contentType,
      durationMs,
      sizeBytes,
      cookies: receivedCookies,
    };

    // Auto-save to SQLite history
    try {
      addHistory({
        request_id: request.id,
        method: request.method,
        protocol: request.protocol,
        url,
        status: result.status,
        status_text: result.statusText,
        duration_ms: result.durationMs,
        size_bytes: result.sizeBytes,
        request_snapshot: {
          method: request.method,
          url,
          headers,
          body: bodyPayload,
        },
        response_snapshot: {
          status: result.status,
          statusText: result.statusText,
          headers: result.headers,
          body: parsedBody,
          contentType,
        },
      });
    } catch (historyErr) {
      console.error('[History] Failed to record execution history:', historyErr);
    }

    return result;
  } catch (err: any) {
    clearTimeout(timeoutTimer);
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);

    const errorMessage =
      err.name === 'AbortError'
        ? `Request timed out after ${timeoutMs}ms`
        : err.message || 'Network request failed';

    const errorResult: ExecuteResponse = {
      status: 0,
      statusText: 'Network Error',
      headers: {},
      body: null,
      contentType: '',
      durationMs,
      sizeBytes: 0,
      error: errorMessage,
    };

    // Record error in history
    try {
      addHistory({
        request_id: request.id,
        method: request.method,
        protocol: request.protocol,
        url,
        status: 0,
        status_text: 'Error',
        duration_ms: durationMs,
        size_bytes: 0,
        request_snapshot: { method: request.method, url, headers },
        response_snapshot: { status: 0, statusText: errorMessage, error: errorMessage },
      });
    } catch (historyErr) {
      console.error('[History] Failed to record history error:', historyErr);
    }

    return errorResult;
  }
}
