import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import dns from 'dns';
import db from '../db/index.js';
import { DOWNLOADS_DIR } from '../config.js';

// Enforce IPv4 resolution priority to eliminate dual-stack IPv6 socket timeouts
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 10000; // 10 seconds delay before auto-retrying failed images
const CONNECT_TIMEOUT_MS = 30000; // 30s connection timeout
const STALL_TIMEOUT_MS = 45000; // 45s inactivity watchdog on stream chunks

class DownloaderService {
  constructor() {
    this.activeDownload = null; // { imageId, controller, currentRequest, currentResponse, fileStream, stallTimer, progress, downloadedBytes, totalBytes, speed, startTime }
    this.subscribers = new Set();
    this.retryTimer = null;

    // Automatically detect and recover any downloads interrupted by a server restart
    this._recoverInterruptedDownloads();

    // Automatically check and process any remaining queued downloads on startup
    setTimeout(() => this._processQueue(), 1500);
  }

  _clearRetryTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  _recoverInterruptedDownloads() {
    try {
      try {
        const cols = db.prepare('PRAGMA table_info(base_images)').all().map((c) => c.name);
        if (!cols.includes('retry_count')) {
          db.prepare('ALTER TABLE base_images ADD COLUMN retry_count INTEGER DEFAULT 0').run();
        }
      } catch (_) {}

      const interrupted = db.prepare(`
        SELECT * FROM base_images 
        WHERE status IN ('downloading', 'queued')
      `).all();

      if (interrupted.length > 0) {
        console.log(`[Downloader] Found ${interrupted.length} download(s) interrupted by server restart. Cleaning up...`);
        for (const img of interrupted) {
          const tempPath = path.join(DOWNLOADS_DIR, `${img.filename}.downloading`);
          if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch (_) {}
          }
          const reason = img.status === 'queued'
            ? 'Queued download cancelled due to server restart. Click Download to restart.'
            : 'Download interrupted by server restart or shutdown. Click Retry Download to resume.';
          db.prepare(`
            UPDATE base_images 
            SET status = 'error', 
                download_progress = 0, 
                error_message = ?,
                retry_count = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(reason, img.id);
        }
      }
    } catch (err) {
      console.error('[Downloader] Error recovering interrupted downloads:', err.message);
    }
  }

  subscribe(res) {
    this.subscribers.add(res);
    res.on('close', () => this.subscribers.delete(res));
  }

  broadcast(event, data) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.subscribers) {
      try {
        client.write(message);
      } catch (_) {}
    }
  }

  getActiveStatus(imageId) {
    if (this.activeDownload && this.activeDownload.imageId === imageId) {
      return this.activeDownload;
    }
    return null;
  }

  getImage(idOrKey) {
    if (typeof idOrKey === 'number' || /^\d+$/.test(String(idOrKey))) {
      return db.prepare('SELECT * FROM base_images WHERE id = ?').get(parseInt(idOrKey, 10));
    }
    return db.prepare('SELECT * FROM base_images WHERE key = ?').get(String(idOrKey));
  }

  startDownload(idOrKey) {
    const image = this.getImage(idOrKey);
    if (!image) throw new Error('Image not found');
    const imageId = image.id;

    if (this.activeDownload && this.activeDownload.imageId === imageId) {
      return { message: 'Download already in progress', imageId, status: 'downloading' };
    }
    if (image.status === 'queued') {
      return { message: 'Download already queued in pipeline', imageId, status: 'queued' };
    }

    // Manual download request resets error retry count
    this._clearRetryTimer();

    // If another download is currently active, place this image into the sequential queue
    if (this.activeDownload !== null) {
      db.prepare(`
        UPDATE base_images 
        SET status = 'queued', download_progress = 0, error_message = NULL, retry_count = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(imageId);

      this.broadcast('progress', {
        id: imageId,
        progress: 0,
        status: 'queued',
        speed: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        retryCount: 0,
      });

      console.log(`[Downloader] Queued download for ${image.name} (sequential pipeline)`);
      return { message: 'Download queued in sequential pipeline', imageId, key: image.key, status: 'queued' };
    }

    // No active download, start immediately
    db.prepare(`
      UPDATE base_images 
      SET retry_count = 0, error_message = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(imageId);

    this._startImageDownload(image);
    return { message: 'Download started', imageId, key: image.key, status: 'downloading' };
  }

  startDownloadAll(osFamily = null) {
    this._clearRetryTimer();

    let query = `
      SELECT * FROM base_images 
      WHERE status IN ('not_downloaded', 'error')
    `;
    const params = [];
    if (osFamily && osFamily !== 'all') {
      query += ` AND LOWER(os) = LOWER(?)`;
      params.push(osFamily);
    }
    query += ` ORDER BY id ASC`;

    const pendingImages = db.prepare(query).all(...params);
    if (pendingImages.length === 0) {
      return { message: 'No images pending download', queuedCount: 0 };
    }

    let startedImmediately = 0;
    for (const image of pendingImages) {
      if (this.activeDownload === null && startedImmediately === 0) {
        db.prepare(`
          UPDATE base_images 
          SET retry_count = 0, error_message = NULL, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(image.id);

        this._startImageDownload(image);
        startedImmediately++;
      } else {
        db.prepare(`
          UPDATE base_images 
          SET status = 'queued', download_progress = 0, error_message = NULL, retry_count = 0, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(image.id);

        this.broadcast('progress', {
          id: image.id,
          progress: 0,
          status: 'queued',
          speed: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          retryCount: 0,
        });
      }
    }

    console.log(`[Downloader] Queued ${pendingImages.length} images for sequential download`);
    return {
      message: `Queued ${pendingImages.length} image(s) for sequential download`,
      queuedCount: pendingImages.length,
      startedImmediately,
    };
  }

  _startImageDownload(image) {
    if (this.activeDownload !== null) {
      console.warn(`[Downloader] Sequential worker busy with #${this.activeDownload.imageId}. Rejecting concurrent start of #${image.id}`);
      return;
    }

    this._clearRetryTimer();

    const imageId = image.id;
    const targetPath = path.join(DOWNLOADS_DIR, image.filename);
    const tempPath = `${targetPath}.downloading`;

    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }

    const controller = new AbortController();
    this.activeDownload = {
      imageId,
      controller,
      currentRequest: null,
      currentResponse: null,
      fileStream: null,
      stallTimer: null,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      startTime: Date.now(),
      lastTime: Date.now(),
      lastBytes: 0,
    };

    db.prepare(`
      UPDATE base_images 
      SET status = 'downloading', download_progress = 0, error_message = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(imageId);

    this.broadcast('progress', {
      id: imageId,
      progress: 0,
      status: 'downloading',
      speed: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      retryCount: image.retry_count || 0,
    });

    console.log(`[Downloader] Starting sequential download for ${image.name} (${image.url}) -> ${tempPath}`);
    this._downloadFile(image.url, tempPath, targetPath, imageId, controller.signal, 0);
  }

  _processQueue() {
    if (this.activeDownload !== null) {
      return; // Currently downloading an image, wait for it to complete
    }

    this._clearRetryTimer();

    // Priority 1: Check for regular queued images
    const nextImage = db.prepare(`
      SELECT * FROM base_images 
      WHERE status = 'queued' 
      ORDER BY updated_at ASC, id ASC 
      LIMIT 1
    `).get();

    if (nextImage) {
      console.log(`[Downloader] Advancing pipeline to queued image: ${nextImage.name} (#${nextImage.id})`);
      this._startImageDownload(nextImage);
      return;
    }

    // Priority 2: If no queued images remain, check for errored images eligible for auto-retry
    const retryCandidate = db.prepare(`
      SELECT * FROM base_images 
      WHERE status = 'error' AND retry_count < ? 
      ORDER BY updated_at ASC, id ASC 
      LIMIT 1
    `).get(MAX_RETRIES);

    if (retryCandidate) {
      const attemptNumber = (retryCandidate.retry_count || 0) + 1;
      console.log(
        `[Downloader] Pipeline idle. Scheduling auto-retry for failed image '${retryCandidate.name}' (attempt ${attemptNumber}/${MAX_RETRIES}) in ${RETRY_INTERVAL_MS / 1000}s...`
      );

      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (this.activeDownload !== null) return;

        const fresh = this.getImage(retryCandidate.id);
        if (fresh && fresh.status === 'error' && (fresh.retry_count || 0) < MAX_RETRIES) {
          console.log(`[Downloader] Executing auto-retry for '${fresh.name}' (#${fresh.id})...`);
          this._startImageDownload(fresh);
        } else {
          this._processQueue();
        }
      }, RETRY_INTERVAL_MS);
    }
  }

  cancelDownload(idOrKey) {
    const image = this.getImage(idOrKey);
    const imageId = image ? image.id : parseInt(idOrKey, 10);

    this._clearRetryTimer();

    const wasActive = this.activeDownload && this.activeDownload.imageId === imageId;
    if (wasActive) {
      try {
        if (this.activeDownload.stallTimer) clearTimeout(this.activeDownload.stallTimer);
        this.activeDownload.controller.abort();
        if (this.activeDownload.currentRequest) {
          this.activeDownload.currentRequest.removeAllListeners();
          this.activeDownload.currentRequest.destroy();
        }
        if (this.activeDownload.fileStream) {
          this.activeDownload.fileStream.destroy();
        }
      } catch (_) {}
      this.activeDownload = null;
    }

    if (image) {
      const tempPath = path.join(DOWNLOADS_DIR, `${image.filename}.downloading`);
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (_) {}
      }
    }

    db.prepare(`
      UPDATE base_images 
      SET status = 'not_downloaded', download_progress = 0, error_message = NULL, retry_count = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(imageId);

    this.broadcast('progress', { id: imageId, progress: 0, status: 'not_downloaded', retryCount: 0 });

    if (wasActive) {
      setTimeout(() => this._processQueue(), 500);
    }

    return { message: 'Download cancelled and reset' };
  }

  _downloadFile(url, tempPath, finalPath, imageId, signal, redirects = 0) {
    if (redirects > 10) {
      this._handleError(imageId, new Error('Too many HTTP redirects (exceeded 10 redirects)'), tempPath);
      return;
    }

    if (signal?.aborted) return;

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      this._handleError(imageId, new Error(`Invalid URL '${url}': ${e.message}`), tempPath);
      return;
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      signal,
      family: 4,
      autoSelectFamily: false,
      timeout: CONNECT_TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
      },
    };

    const request = client.get(url, options, (res) => {
      // Store current active response
      if (this.activeDownload && this.activeDownload.imageId === imageId) {
        this.activeDownload.currentResponse = res;
      }

      // Handle HTTP redirects (301, 302, 303, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Free and drain previous response socket to prevent connection leaks
        res.resume();
        request.removeAllListeners();
        request.destroy();

        const redirectUrl = new URL(res.headers.location, url).href;
        console.log(`[Downloader] Following HTTP ${res.statusCode} redirect to: ${redirectUrl}`);
        return this._downloadFile(redirectUrl, tempPath, finalPath, imageId, signal, redirects + 1);
      }

      if (res.statusCode !== 200) {
        res.resume();
        let reason = res.statusMessage || '';
        if (res.statusCode === 404) reason = 'File not found on upstream server (404 Not Found)';
        else if (res.statusCode === 403) reason = 'Access forbidden by upstream server (403 Forbidden)';
        else if (res.statusCode === 500) reason = 'Internal server error from upstream host (500)';
        else if (res.statusCode === 502 || res.statusCode === 503 || res.statusCode === 504) reason = `Upstream server gateway unavailable (${res.statusCode})`;
        else if (!reason) reason = `Unexpected HTTP response status ${res.statusCode}`;

        this._handleError(imageId, new Error(`HTTP Error ${res.statusCode}: ${reason}`), tempPath);
        return;
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      let lastProgress = -1;
      let lastTime = Date.now();
      let lastBytes = 0;
      let speed = 0;

      if (this.activeDownload && this.activeDownload.imageId === imageId) {
        this.activeDownload.totalBytes = totalBytes;
      }

      const fileStream = fs.createWriteStream(tempPath);
      if (this.activeDownload && this.activeDownload.imageId === imageId) {
        this.activeDownload.fileStream = fileStream;
      }

      // Inactivity stall watchdog: trigger abort if no stream data chunks arrive within STALL_TIMEOUT_MS
      const resetStallWatchdog = () => {
        if (this.activeDownload && this.activeDownload.imageId === imageId) {
          if (this.activeDownload.stallTimer) clearTimeout(this.activeDownload.stallTimer);
          this.activeDownload.stallTimer = setTimeout(() => {
            console.error(`[Downloader] Stream stalled for image #${imageId}: No data chunks received for ${STALL_TIMEOUT_MS / 1000}s`);
            try {
              res.destroy(new Error(`Download stream stalled: No incoming data for ${STALL_TIMEOUT_MS / 1000} seconds`));
            } catch (_) {}
          }, STALL_TIMEOUT_MS);
        }
      };

      resetStallWatchdog();

      res.on('data', (chunk) => {
        resetStallWatchdog();

        downloadedBytes += chunk.length;
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;

        // Calculate speed every 0.5s
        if (timeDiff >= 0.5) {
          speed = Math.round((downloadedBytes - lastBytes) / timeDiff);
          lastBytes = downloadedBytes;
          lastTime = now;
        }

        const progress = totalBytes > 0 ? Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100)) : 0;

        if (this.activeDownload && this.activeDownload.imageId === imageId) {
          this.activeDownload.downloadedBytes = downloadedBytes;
          this.activeDownload.progress = progress;
          this.activeDownload.speed = speed;
        }

        if (progress !== lastProgress || timeDiff >= 1) {
          lastProgress = progress;
          db.prepare('UPDATE base_images SET download_progress = ? WHERE id = ?').run(progress, imageId);
          this.broadcast('progress', {
            id: imageId,
            progress,
            downloadedBytes,
            totalBytes,
            speed,
            status: 'downloading',
          });
        }
      });

      res.on('error', (err) => {
        if (this.activeDownload?.stallTimer) clearTimeout(this.activeDownload.stallTimer);
        if (err.name === 'AbortError' || signal?.aborted) return;
        this._handleError(imageId, new Error(`Stream transmission error: ${err.message}`), tempPath);
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        if (this.activeDownload?.stallTimer) clearTimeout(this.activeDownload.stallTimer);
        if (signal?.aborted) return;

        fileStream.close(() => {
          if (signal?.aborted || !fs.existsSync(tempPath)) return;

          try {
            if (fs.existsSync(finalPath)) {
              try { fs.unlinkSync(finalPath); } catch (_) {}
            }
            fs.renameSync(tempPath, finalPath);

            const stats = fs.statSync(finalPath);
            db.prepare(`
              UPDATE base_images 
              SET status = 'ready', download_progress = 100, file_path = ?, file_size = ?, error_message = NULL, retry_count = 0, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(finalPath, stats.size, imageId);

            if (this.activeDownload && this.activeDownload.imageId === imageId) {
              this.activeDownload = null;
            }

            this.broadcast('progress', {
              id: imageId,
              progress: 100,
              status: 'ready',
              fileSize: stats.size,
              retryCount: 0,
            });
            console.log(`[Downloader] Download completed successfully: ${finalPath} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);

            // Process next image in queue sequentially
            setTimeout(() => this._processQueue(), 500);
          } catch (err) {
            console.error(`[Downloader] Error finalizing download for #${imageId}:`, err.message);
          }
        });
      });

      fileStream.on('error', (err) => {
        if (this.activeDownload?.stallTimer) clearTimeout(this.activeDownload.stallTimer);
        if (signal?.aborted) return;
        let detailedMsg = err.message;
        if (err.code === 'ENOSPC') {
          detailedMsg = 'No space left on device in downloads directory';
        }
        this._handleError(imageId, new Error(`File write error: ${detailedMsg}`), tempPath);
      });
    });

    if (this.activeDownload && this.activeDownload.imageId === imageId) {
      this.activeDownload.currentRequest = request;
    }

    request.on('timeout', () => {
      request.destroy(new Error(`Connection timed out after 30s while reaching ${parsedUrl.host}`));
    });

    request.on('error', (err) => {
      if (err.name === 'AbortError' || signal?.aborted) return;
      let detailedMsg = err.message;
      if (err.code === 'ENOTFOUND') {
        detailedMsg = `DNS resolution failed: Host '${parsedUrl.hostname}' could not be reached`;
      } else if (err.code === 'ECONNREFUSED') {
        detailedMsg = `Connection refused by remote host ${parsedUrl.host}`;
      } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
        detailedMsg = `Network connection timed out reaching ${parsedUrl.host}`;
      } else if (err.code === 'CERT_HAS_EXPIRED') {
        detailedMsg = `SSL certificate expired on host ${parsedUrl.host}`;
      }
      this._handleError(imageId, new Error(detailedMsg), tempPath);
    });
  }

  _handleError(imageId, err, tempPath) {
    const errorMsg = (typeof err === 'string' ? err : err?.message) || 'Unknown download error occurred';
    console.error(`[Downloader Error] Image #${imageId}:`, errorMsg);

    if (this.activeDownload && this.activeDownload.imageId === imageId) {
      if (this.activeDownload.stallTimer) {
        clearTimeout(this.activeDownload.stallTimer);
      }
      try {
        if (this.activeDownload.currentRequest) {
          this.activeDownload.currentRequest.removeAllListeners();
          this.activeDownload.currentRequest.destroy();
        }
      } catch (_) {}
      try {
        if (this.activeDownload.fileStream) {
          this.activeDownload.fileStream.destroy();
        }
      } catch (_) {}
      this.activeDownload = null;
    }

    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }

    const currentImg = this.getImage(imageId);
    const newRetryCount = ((currentImg?.retry_count || 0) + 1);

    db.prepare(`
      UPDATE base_images 
      SET status = 'error', 
          download_progress = 0,
          error_message = ?, 
          retry_count = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(errorMsg, newRetryCount, imageId);

    this.broadcast('progress', {
      id: imageId,
      status: 'error',
      progress: 0,
      error: errorMsg,
      retryCount: newRetryCount,
      maxRetries: MAX_RETRIES,
    });

    // Continue processing the remaining queued images in the pipeline immediately
    setTimeout(() => this._processQueue(), 500);
  }
}

export const downloaderService = new DownloaderService();
