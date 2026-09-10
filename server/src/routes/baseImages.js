import express from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db/index.js';
import { DOWNLOADS_DIR, CATALOG_CONFIG_PATH } from '../config.js';
import { downloaderService } from '../services/downloader.js';
import { syncCatalogWithDatabase, saveDatabaseCatalogToFile, mergeDefaultCatalog, sortImagesCanonical } from '../services/catalog.js';

const router = express.Router();

// SSE endpoint for real-time download progress
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  res.write(`: connected\n\n`);

  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (_) {
      clearInterval(heartbeatTimer);
    }
  }, 15000);

  res.on('close', () => {
    clearInterval(heartbeatTimer);
  });

  downloaderService.subscribe(res);
});

// List all base images
router.get('/', (req, res) => {
  try {
    const images = db.prepare('SELECT * FROM base_images').all();

    const enriched = images.map((img) => {
      let fileExists = false;
      const expectedPath = img.file_path || path.join(DOWNLOADS_DIR, img.filename);

      if (fs.existsSync(expectedPath)) {
        fileExists = true;
        if (img.status !== 'ready') {
          try {
            const stat = fs.statSync(expectedPath);
            db.prepare("UPDATE base_images SET status = 'ready', file_path = ?, file_size = ? WHERE id = ?").run(
              expectedPath,
              stat.size,
              img.id
            );
            img.status = 'ready';
            img.file_path = expectedPath;
            img.file_size = stat.size;
          } catch (_) {}
        }
      }

      const active = downloaderService.getActiveStatus(img.id);

      return {
        ...img,
        file_exists: fileExists,
        downloaded_bytes: active?.downloadedBytes || 0,
        total_bytes: active?.totalBytes || img.file_size || 0,
        speed: active?.speed || 0,
      };
    });

    sortImagesCanonical(enriched);

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get raw JSON catalog file content
router.get('/catalog-json', (req, res) => {
  try {
    if (fs.existsSync(CATALOG_CONFIG_PATH)) {
      const raw = fs.readFileSync(CATALOG_CONFIG_PATH, 'utf-8');
      res.json(JSON.parse(raw));
    } else {
      res.json([]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update entire JSON catalog file and re-sync database
router.put('/catalog-json', (req, res) => {
  try {
    const newCatalog = req.body;
    if (!Array.isArray(newCatalog)) {
      return res.status(400).json({ error: 'Catalog must be a JSON array' });
    }

    fs.writeFileSync(CATALOG_CONFIG_PATH, JSON.stringify(newCatalog, null, 2), 'utf-8');
    syncCatalogWithDatabase(db);
    res.json({ success: true, message: 'Catalog JSON updated and synchronized' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reload catalog from disk JSON file
router.post('/reload-catalog', (req, res) => {
  try {
    syncCatalogWithDatabase(db);
    res.json({ success: true, message: 'Catalog reloaded from images_catalog.json' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check and merge latest default base images
router.post('/sync-defaults', (req, res) => {
  try {
    const result = mergeDefaultCatalog(db);
    res.json({
      success: true,
      message: `Catalog synchronized. Added ${result.addedCount} new images, fixed ${result.updatedCount} URLs. Total: ${result.totalCount}`,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new custom base image
router.post('/', (req, res) => {
  const { name, os, version, arch, url, format, filename } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  const cleanFilename = filename || path.basename(new URL(url).pathname) || `${os || 'custom'}-${version || 'latest'}.qcow2`;
  const key = `${os || 'os'}-${version || 'v'}-${Date.now()}`;

  try {
    const insert = db.prepare(`
      INSERT INTO base_images (key, name, os, version, arch, url, format, filename, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'not_downloaded')
    `).run(key, name, os || 'other', version || '1', arch || 'amd64', url, format || 'qcow2', cleanFilename);

    saveDatabaseCatalogToFile(db);
    const newImage = db.prepare('SELECT * FROM base_images WHERE id = ?').get(insert.lastInsertRowid);
    res.status(201).json(newImage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit existing base image details (URL, name, version, filename, etc.)
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, os, version, arch, url, format, filename } = req.body;

  const image = db.prepare('SELECT * FROM base_images WHERE id = ?').get(id);
  if (!image) return res.status(404).json({ error: 'Image not found' });

  try {
    db.prepare(`
      UPDATE base_images SET
        name = ?,
        os = ?,
        version = ?,
        arch = ?,
        url = ?,
        format = ?,
        filename = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || image.name,
      os || image.os,
      version || image.version,
      arch || image.arch,
      url || image.url,
      format || image.format,
      filename || image.filename,
      id
    );

    saveDatabaseCatalogToFile(db);
    const updated = db.prepare('SELECT * FROM base_images WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger sequential download of all missing or error images
router.post('/download-all', (req, res) => {
  try {
    const result = downloaderService.startDownloadAll(req.body?.os);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Trigger download manually
router.post('/:id/download', (req, res) => {
  try {
    const result = downloaderService.startDownload(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel download
router.post('/:id/cancel', (req, res) => {
  try {
    const result = downloaderService.cancelDownload(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reset/delete downloaded base image file or clear error task
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const image = db.prepare('SELECT * FROM base_images WHERE id = ?').get(id);
  if (!image) return res.status(404).json({ error: 'Image not found' });

  // Delete file if on disk
  if (image.file_path && fs.existsSync(image.file_path)) {
    try { fs.unlinkSync(image.file_path); } catch (_) {}
  }
  const defaultPath = path.join(DOWNLOADS_DIR, image.filename);
  if (fs.existsSync(defaultPath)) {
    try { fs.unlinkSync(defaultPath); } catch (_) {}
  }
  const tempPath = path.join(DOWNLOADS_DIR, `${image.filename}.downloading`);
  if (fs.existsSync(tempPath)) {
    try { fs.unlinkSync(tempPath); } catch (_) {}
  }

  // Cancel any active or queued download
  try {
    downloaderService.cancelDownload(id);
  } catch (_) {}

  // If explicit purge requested (?purge=true), delete entry from catalog and DB
  if (req.query.purge === 'true') {
    db.prepare('DELETE FROM base_images WHERE id = ?').run(id);
    saveDatabaseCatalogToFile(db);
    return res.json({ success: true, message: 'Image removed from catalog' });
  }

  // Standard trash action: delete file/error task, but KEEP image in catalog list
  db.prepare(`
    UPDATE base_images 
    SET status = 'not_downloaded',
        download_progress = 0,
        file_path = NULL,
        file_size = 0,
        error_message = NULL,
        retry_count = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  res.json({ success: true, message: 'Downloaded image file removed from disk and status reset' });
});

export default router;
