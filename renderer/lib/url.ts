import { KeyValueItem } from '@/types/db';
import { v4 as uuidv4 } from 'uuid';

export function buildUrlWithParams(baseUrl: string, params: KeyValueItem[]): string {
  if (!baseUrl) return '';

  try {
    // Separate base URL from existing query string if any
    const [pathPart] = baseUrl.split('?');
    const enabledParams = params.filter((p) => p.enabled && p.key.trim() !== '');

    if (enabledParams.length === 0) {
      return pathPart;
    }

    const queryParts = enabledParams.map(
      (p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`
    );

    return `${pathPart}?${queryParts.join('&')}`;
  } catch {
    return baseUrl;
  }
}

export function parseParamsFromUrl(fullUrl: string): { basePath: string; params: KeyValueItem[] } {
  if (!fullUrl) return { basePath: '', params: [] };

  const qIndex = fullUrl.indexOf('?');
  if (qIndex === -1) {
    return { basePath: fullUrl, params: [] };
  }

  const basePath = fullUrl.slice(0, qIndex);
  const queryString = fullUrl.slice(qIndex + 1);

  if (!queryString.trim()) {
    return { basePath, params: [] };
  }

  const pairs = queryString.split('&');
  const params: KeyValueItem[] = [];

  for (const pair of pairs) {
    if (!pair) continue;
    const [rawKey, rawVal] = pair.split('=');
    try {
      params.push({
        id: uuidv4(),
        key: decodeURIComponent(rawKey || ''),
        value: decodeURIComponent(rawVal || ''),
        enabled: true,
      });
    } catch {
      params.push({
        id: uuidv4(),
        key: rawKey || '',
        value: rawVal || '',
        enabled: true,
      });
    }
  }

  return { basePath, params };
}
