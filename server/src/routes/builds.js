import express from 'express';
import db from '../db/index.js';
import { builderService } from '../services/builder.js';

const router = express.Router();

// SSE endpoint for live build log streaming
router.get('/:id/events', (req, res) => {
  const buildId = parseInt(req.params.id, 10);
  const build = db.prepare('SELECT id, status, log FROM builds WHERE id = ?').get(buildId);
  if (!build) return res.status(404).json({ error: 'Build not found' });

  // Critical headers for reverse proxies (Nginx, OpenResty, Cloudflare, Caddy)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send an immediate connection confirmation event so proxies flush headers immediately
  res.write(`: connected\n\n`);

  // Send initial existing log if any
  if (build.log) {
    res.write(`data: ${JSON.stringify({ type: 'initial_log', text: build.log })}\n\n`);
  }

  // Periodic heartbeat comment to prevent proxy idle timeouts (every 15 seconds)
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

  builderService.subscribe(buildId, res);
});

// List all builds
router.get('/', (req, res) => {
  try {
    const builds = db.prepare(`
      SELECT b.*,
             bi.name as base_image_name, bi.filename as base_image_filename,
             p.name as profile_name,
             g.name as group_name
      FROM builds b
      LEFT JOIN base_images bi ON b.base_image_id = bi.id
      LEFT JOIN profiles p ON b.profile_id = p.id
      LEFT JOIN groups g ON b.group_id = g.id
      ORDER BY b.id DESC
    `).all();
    res.json(builds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single build details
router.get('/:id', (req, res) => {
  try {
    const build = db.prepare(`
      SELECT b.*,
             bi.name as base_image_name,
             p.name as profile_name,
             g.name as group_name
      FROM builds b
      LEFT JOIN base_images bi ON b.base_image_id = bi.id
      LEFT JOIN profiles p ON b.profile_id = p.id
      LEFT JOIN groups g ON b.group_id = g.id
      WHERE b.id = ?
    `).get(req.params.id);

    if (!build) return res.status(404).json({ error: 'Build not found' });
    res.json(build);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start new single build
router.post('/', async (req, res) => {
  const { template_name, vmid, base_image_id, profile_id, group_id } = req.body;

  if (!template_name) {
    return res.status(400).json({ error: 'Template name is required' });
  }
  if (!base_image_id || !profile_id || !group_id) {
    return res.status(400).json({ error: 'Base image, profile, and group must be selected' });
  }

  try {
    const result = await builderService.startBuild({
      template_name,
      vmid: parseInt(vmid || '9000', 10),
      base_image_id: parseInt(base_image_id, 10),
      profile_id: parseInt(profile_id, 10),
      group_id: parseInt(group_id, 10),
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start batch / matrix build
router.post('/batch', async (req, res) => {
  const { jobs } = req.body;
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({ error: 'Array of build jobs is required' });
  }

  try {
    const result = await builderService.startBatch(jobs);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel a running or queued build
router.post('/:id/cancel', (req, res) => {
  try {
    const result = builderService.cancelBuild(parseInt(req.params.id, 10));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Clear failed / error build history records
router.delete(['/clear-failed', '/clear/failed', '/clear-errors'], (req, res) => {
  try {
    const result = db.prepare("DELETE FROM builds WHERE status = 'failed'").run();
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear completed build history records
router.delete(['/clear-completed', '/clear/completed'], (req, res) => {
  try {
    const result = db.prepare("DELETE FROM builds WHERE status = 'completed'").run();
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all build history records
router.delete(['/clear-all', '/clear/all'], (req, res) => {
  try {
    const result = db.prepare("DELETE FROM builds").run();
    try {
      db.prepare("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'builds'").run();
    } catch (_) {}
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retry all failed builds in batch
router.post('/retry-failed', async (req, res) => {
  try {
    const result = await builderService.retryFailedBuilds();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retry / restart an existing or failed build
router.post('/:id/retry', async (req, res) => {
  const paramId = parseInt(req.params.id, 10);
  if (isNaN(paramId)) {
    return res.status(400).json({ error: 'Invalid build ID' });
  }

  try {
    const result = await builderService.retryBuild(paramId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete build history record
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM builds WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
