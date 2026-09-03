import { getDb } from '../client';
import { v4 as uuidv4 } from 'uuid';

export interface Cookie {
  id: string;
  domain: string;
  path: string;
  name: string;
  value: string;
  expires: string | null;
  http_only: boolean;
  secure: boolean;
  created_at: string;
  updated_at: string;
}

export function listCookies(domain?: string): Cookie[] {
  const db = getDb();
  let rows: any[];

  if (domain) {
    rows = db
      .prepare('SELECT * FROM cookies WHERE domain = ? ORDER BY name ASC')
      .all(domain);
  } else {
    rows = db.prepare('SELECT * FROM cookies ORDER BY domain ASC, name ASC').all();
  }

  return rows.map((r) => ({
    ...r,
    http_only: Boolean(r.http_only),
    secure: Boolean(r.secure),
  }));
}

export function saveCookie(
  data: Omit<Cookie, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Cookie {
  const db = getDb();
  const now = new Date().toISOString();

  // Normalize domain (lowercase, strip port if any)
  const domain = (data.domain || 'localhost').toLowerCase().split(':')[0];
  const path = data.path || '/';
  const name = data.name.trim();
  const value = data.value;

  // Check if this cookie already exists for domain + path + name
  const existing = db
    .prepare('SELECT id FROM cookies WHERE domain = ? AND path = ? AND name = ?')
    .get(domain, path, name) as any;

  const id = data.id || existing?.id || uuidv4();

  db.prepare(`
    INSERT INTO cookies (id, domain, path, name, value, expires, http_only, secure, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      value = excluded.value,
      expires = excluded.expires,
      http_only = excluded.http_only,
      secure = excluded.secure,
      updated_at = excluded.updated_at
  `).run(
    id,
    domain,
    path,
    name,
    value,
    data.expires || null,
    data.http_only ? 1 : 0,
    data.secure ? 1 : 0,
    now,
    now
  );

  return {
    id,
    domain,
    path,
    name,
    value,
    expires: data.expires || null,
    http_only: Boolean(data.http_only),
    secure: Boolean(data.secure),
    created_at: now,
    updated_at: now,
  };
}

export function deleteCookie(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM cookies WHERE id = ?').run(id);
  return result.changes > 0;
}

export function clearCookies(domain?: string): boolean {
  const db = getDb();
  if (domain) {
    db.prepare('DELETE FROM cookies WHERE domain = ?').run(domain);
  } else {
    db.prepare('DELETE FROM cookies').run();
  }
  return true;
}

// Get matching cookies for an outgoing HTTP request URL
export function getCookiesForUrl(targetUrl: string): string {
  try {
    const urlObj = new URL(targetUrl);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname || '/';

    const db = getDb();
    const allCookies = db.prepare('SELECT * FROM cookies').all() as any[];

    const matching = allCookies.filter((c) => {
      const cookieDomain = (c.domain || '').toLowerCase();
      // Match domain (exact, or subdomain match if leading dot, e.g. .example.com)
      const domainMatches =
        cookieDomain === hostname ||
        (cookieDomain.startsWith('.') && hostname.endsWith(cookieDomain.substring(1))) ||
        (hostname.endsWith('.' + cookieDomain));

      if (!domainMatches) return false;

      // Match path (prefix match)
      const cookiePath = c.path || '/';
      if (!pathname.startsWith(cookiePath)) return false;

      // Check expiration if present
      if (c.expires) {
        const expTime = new Date(c.expires).getTime();
        if (!isNaN(expTime) && expTime < Date.now()) {
          // Expired
          return false;
        }
      }

      return true;
    });

    if (matching.length === 0) return '';

    return matching.map((c) => `${c.name}=${c.value}`).join('; ');
  } catch {
    return '';
  }
}

// Parse Set-Cookie header strings and persist them
export function parseAndSaveSetCookie(
  setCookieHeader: string,
  requestUrl: string
): Cookie | null {
  try {
    const urlObj = new URL(requestUrl);
    const defaultDomain = urlObj.hostname.toLowerCase();
    const defaultPath = '/';

    const parts = setCookieHeader.split(';').map((p) => p.trim());
    if (parts.length === 0 || !parts[0].includes('=')) return null;

    const firstEq = parts[0].indexOf('=');
    const name = parts[0].substring(0, firstEq).trim();
    const value = parts[0].substring(firstEq + 1).trim();

    let domain = defaultDomain;
    let path = defaultPath;
    let expires: string | null = null;
    let httpOnly = false;
    let secure = false;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const lower = part.toLowerCase();

      if (lower.startsWith('domain=')) {
        domain = part.substring(7).trim().toLowerCase().replace(/^\./, '');
      } else if (lower.startsWith('path=')) {
        path = part.substring(5).trim() || '/';
      } else if (lower.startsWith('expires=')) {
        const expStr = part.substring(8).trim();
        const expDate = new Date(expStr);
        if (!isNaN(expDate.getTime())) {
          expires = expDate.toISOString();
        }
      } else if (lower.startsWith('max-age=')) {
        const seconds = parseInt(part.substring(8).trim(), 10);
        if (!isNaN(seconds)) {
          expires = new Date(Date.now() + seconds * 1000).toISOString();
        }
      } else if (lower === 'httponly') {
        httpOnly = true;
      } else if (lower === 'secure') {
        secure = true;
      }
    }

    return saveCookie({
      domain,
      path,
      name,
      value,
      expires,
      http_only: httpOnly,
      secure,
    });
  } catch (err) {
    console.error('Failed to parse Set-Cookie:', err);
    return null;
  }
}
