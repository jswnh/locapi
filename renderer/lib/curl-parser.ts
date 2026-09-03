import { HttpMethod, KeyValueItem, FormDataItem, RequestAuth } from '@/types/db';
import { v4 as uuidv4 } from 'uuid';
import { parseParamsFromUrl } from './url';

export interface ParsedCurlResult {
  url: string;
  method: HttpMethod;
  headers: KeyValueItem[];
  params: KeyValueItem[];
  body: {
    type: 'none' | 'json' | 'text' | 'javascript' | 'xml' | 'html' | 'raw' | 'formData' | 'x-www-form-urlencoded' | 'graphql';
    raw?: string;
    formData?: FormDataItem[];
    urlEncoded?: KeyValueItem[];
  };
  auth: RequestAuth;
}

export function isCurlCommand(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return trimmed.startsWith('curl ') || trimmed.startsWith('curl\n') || trimmed.startsWith('curl\r\n');
}

export function parseCurlCommand(command: string): ParsedCurlResult | null {
  if (!isCurlCommand(command)) return null;

  // Clean line continuations (\ at end of line) and normalize newlines
  const normalized = command
    .replace(/\\\r?\n/g, ' ')
    .replace(/\\\n/g, ' ')
    .trim();

  // Tokenize preserving quoted strings
  const tokens = tokenizeArgs(normalized);
  if (tokens.length === 0 || tokens[0] !== 'curl') {
    return null;
  }

  let method: HttpMethod = 'GET';
  let url = '';
  const headers: KeyValueItem[] = [];
  let rawBodyParts: string[] = [];
  const formParts: FormDataItem[] = [];
  const urlEncodedParts: KeyValueItem[] = [];
  let hasExplicitMethod = false;
  let auth: RequestAuth = { type: 'none' };

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    // Method
    if (token === '-X' || token === '--request') {
      const next = tokens[++i];
      if (next) {
        method = next.toUpperCase() as HttpMethod;
        hasExplicitMethod = true;
      }
      continue;
    }

    // Headers
    if (token === '-H' || token === '--header') {
      const next = tokens[++i];
      if (next) {
        const colonIdx = next.indexOf(':');
        if (colonIdx !== -1) {
          const key = next.slice(0, colonIdx).trim();
          const value = next.slice(colonIdx + 1).trim();
          // Check for Authorization header
          if (key.toLowerCase() === 'authorization') {
            if (value.toLowerCase().startsWith('bearer ')) {
              auth = {
                type: 'bearer',
                bearer: { token: value.slice(7).trim() },
              };
            } else if (value.toLowerCase().startsWith('basic ')) {
              try {
                const decoded = atob(value.slice(6).trim());
                const [u, p] = decoded.split(':');
                auth = {
                  type: 'basic',
                  basic: { username: u || '', password: p || '' },
                };
              } catch {
                // Keep as regular header if cannot decode
              }
            }
          }
          headers.push({
            id: uuidv4(),
            key,
            value,
            enabled: true,
          });
        }
      }
      continue;
    }

    // Basic Auth (-u / --user)
    if (token === '-u' || token === '--user') {
      const next = tokens[++i];
      if (next) {
        const colonIdx = next.indexOf(':');
        const username = colonIdx !== -1 ? next.slice(0, colonIdx) : next;
        const password = colonIdx !== -1 ? next.slice(colonIdx + 1) : '';
        auth = {
          type: 'basic',
          basic: { username, password },
        };
      }
      continue;
    }

    // Body Data (-d, --data, --data-raw, --data-binary, --data-ascii)
    if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary' ||
      token === '--data-ascii'
    ) {
      const next = tokens[++i];
      if (next !== undefined) {
        rawBodyParts.push(next);
        if (!hasExplicitMethod) {
          method = 'POST';
        }
      }
      continue;
    }

    // URL-encoded data (--data-urlencode)
    if (token === '--data-urlencode') {
      const next = tokens[++i];
      if (next) {
        const eqIdx = next.indexOf('=');
        if (eqIdx !== -1) {
          urlEncodedParts.push({
            id: uuidv4(),
            key: next.slice(0, eqIdx),
            value: next.slice(eqIdx + 1),
            enabled: true,
          });
        } else {
          rawBodyParts.push(next);
        }
        if (!hasExplicitMethod) {
          method = 'POST';
        }
      }
      continue;
    }

    // Form data (-F, --form)
    if (token === '-F' || token === '--form') {
      const next = tokens[++i];
      if (next) {
        const eqIdx = next.indexOf('=');
        if (eqIdx !== -1) {
          const key = next.slice(0, eqIdx).trim();
          const val = next.slice(eqIdx + 1).trim();
          if (val.startsWith('@')) {
            formParts.push({
              id: uuidv4(),
              key,
              value: val.slice(1),
              type: 'file',
              fileName: val.slice(1).split(/[/\\]/).pop(),
              enabled: true,
            });
          } else {
            formParts.push({
              id: uuidv4(),
              key,
              value: val,
              type: 'text',
              enabled: true,
            });
          }
        }
        if (!hasExplicitMethod) {
          method = 'POST';
        }
      }
      continue;
    }

    // URL (tokens that don't start with '-' and are not already consumed)
    if (!token.startsWith('-') && !url) {
      url = token.replace(/^['"]|['"]$/g, '');
      continue;
    }

    // Handle --url flag
    if (token === '--url') {
      const next = tokens[++i];
      if (next) {
        url = next.replace(/^['"]|['"]$/g, '');
      }
      continue;
    }
  }

  // Parse query params from URL
  const { params } = parseParamsFromUrl(url);

  // Determine body type
  const contentType = headers.find((h) => h.key.toLowerCase() === 'content-type')?.value.toLowerCase() || '';
  let bodyType: ParsedCurlResult['body']['type'] = 'none';
  let finalRaw = rawBodyParts.join('&');

  if (formParts.length > 0) {
    bodyType = 'formData';
  } else if (urlEncodedParts.length > 0 || contentType.includes('application/x-www-form-urlencoded')) {
    bodyType = 'x-www-form-urlencoded';
    if (urlEncodedParts.length === 0 && finalRaw) {
      // parse raw as key=val pairs
      finalRaw.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k) {
          urlEncodedParts.push({
            id: uuidv4(),
            key: decodeURIComponent(k),
            value: decodeURIComponent(v || ''),
            enabled: true,
          });
        }
      });
    }
  } else if (finalRaw) {
    if (contentType.includes('json') || isValidJson(finalRaw)) {
      bodyType = 'json';
      try {
        finalRaw = JSON.stringify(JSON.parse(finalRaw), null, 2);
      } catch {
        // keep as is
      }
    } else if (contentType.includes('xml') || finalRaw.trim().startsWith('<')) {
      bodyType = 'xml';
    } else {
      bodyType = 'raw';
    }
  }

  return {
    url,
    method,
    headers,
    params,
    body: {
      type: bodyType,
      raw: finalRaw || undefined,
      formData: formParts.length > 0 ? formParts : undefined,
      urlEncoded: urlEncodedParts.length > 0 ? urlEncodedParts : undefined,
    },
    auth,
  };
}

function isValidJson(str: string): boolean {
  try {
    const trimmed = str.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

// Tokenize command line string handling single and double quotes
function tokenizeArgs(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let isEscaped = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (isEscaped) {
      current += char;
      isEscaped = false;
      continue;
    }

    if (char === '\\' && !inSingleQuote) {
      isEscaped = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}
