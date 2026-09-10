/**
 * Reachability and Health Validator for Regional Package Repositories / Mirrors
 * Strict English Only - Zero Cyrillic
 */

/**
 * Normalizes and checks reachability of a single mirror URL.
 * 
 * @param {string} rawUrl - Target package mirror URL
 * @param {number} timeoutMs - Timeout in milliseconds (default: 6000ms)
 * @returns {Promise<{ ok: boolean, status?: number, latencyMs: number, error?: string, url: string }>}
 */
export async function checkMirrorReachability(rawUrl, timeoutMs = 6000) {
  const startTime = Date.now();
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { ok: false, error: 'Mirror URL is empty', latencyMs: 0, url: '' };
  }

  let cleanUrl = rawUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return {
      ok: false,
      error: 'URL must begin with http:// or https://',
      latencyMs: 0,
      url: cleanUrl,
    };
  }

  // Strip Arch Linux or dynamic repository placeholder variables for connectivity testing
  let testUrl = cleanUrl;
  if (testUrl.includes('$repo') || testUrl.includes('$arch')) {
    testUrl = testUrl.split('$')[0].replace(/\/+$/, '') + '/';
  }

  try {
    // Attempt HTTP HEAD first for minimal network payload
    let response;
    try {
      response = await fetch(testUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': 'PUQcloud-PVE-OS-Builder/1.0',
        },
        redirect: 'follow',
      });
    } catch (headErr) {
      // If HEAD threw a network error (not abort timeout), we'll let it rethrow below
      if (headErr.name === 'TimeoutError') throw headErr;
      response = null;
    }

    // Some CDN/mirror servers reject HEAD with 405 Method Not Allowed or 403 Forbidden
    if (!response || response.status === 405 || response.status === 403) {
      response = await fetch(testUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': 'PUQcloud-PVE-OS-Builder/1.0',
          'Range': 'bytes=0-1024',
        },
        redirect: 'follow',
      });
    }

    const latencyMs = Date.now() - startTime;

    if (response.status >= 200 && response.status < 400) {
      return {
        ok: true,
        status: response.status,
        latencyMs,
        url: cleanUrl,
      };
    } else {
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status} ${response.statusText || 'Error'}`.trim(),
        latencyMs,
        url: cleanUrl,
      };
    }
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    let errorMessage = err.message || 'Connection failed';
    if (err.name === 'TimeoutError') {
      errorMessage = `Connection timed out after ${timeoutMs / 1000}s`;
    } else if (err.cause?.code) {
      errorMessage = `${err.cause.code} (${err.message})`;
    }

    return {
      ok: false,
      error: errorMessage,
      latencyMs,
      url: cleanUrl,
    };
  }
}

/**
 * Concurrently checks reachability of all configured mirrors in a package_mirrors map.
 * 
 * @param {Record<string, string>} mirrorsMap - Map of distro to mirror URL
 * @param {number} timeoutMs - Timeout per request in ms
 * @returns {Promise<Record<string, { ok: boolean, status?: number, latencyMs: number, error?: string, url: string }>>}
 */
export async function checkDistroMirrors(mirrorsMap = {}, timeoutMs = 6000) {
  const results = {};
  if (!mirrorsMap || typeof mirrorsMap !== 'object') {
    return results;
  }

  const entries = Object.entries(mirrorsMap).filter(([_, url]) => url && typeof url === 'string' && url.trim().length > 0);
  if (entries.length === 0) {
    return results;
  }

  const checkPromises = entries.map(async ([distro, url]) => {
    const res = await checkMirrorReachability(url, timeoutMs);
    return { distro, res };
  });

  const settled = await Promise.allSettled(checkPromises);
  for (const item of settled) {
    if (item.status === 'fulfilled') {
      results[item.value.distro] = item.value.res;
    }
  }

  return results;
}
