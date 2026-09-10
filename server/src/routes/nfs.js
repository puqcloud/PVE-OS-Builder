import { Router } from 'express';
import { nfsService } from '../services/nfsService.js';

const router = Router();

/**
 * GET /api/nfs/status
 * Get current NFS service status, port info, detected IPs, and export stats
 */
router.get('/status', (req, res) => {
  try {
    const rawHost = req.headers.host || req.hostname || '';
    const hostWithoutPort = rawHost.split(':')[0];
    const status = nfsService.getStatus(hostWithoutPort);
    res.json(status);
  } catch (err) {
    console.error('[NFS Route] Error getting status:', err);
    res.status(500).json({ error: 'Failed to retrieve NFS service status' });
  }
});

/**
 * POST /api/nfs/restart
 * Restart the NFS-Ganesha service and ensure rpcbind is active
 */
router.post('/restart', (req, res) => {
  try {
    const result = nfsService.restartService();
    if (result.success) {
      const rawHost = req.headers.host || req.hostname || '';
      const hostWithoutPort = rawHost.split(':')[0];
      const status = nfsService.getStatus(hostWithoutPort);
      res.json({ success: true, message: result.message, status });
    } else {
      res.status(500).json({ error: result.error || 'Failed to restart NFS daemon' });
    }
  } catch (err) {
    console.error('[NFS Route] Error restarting NFS:', err);
    res.status(500).json({ error: err.message || 'Failed to restart NFS daemon' });
  }
});

/**
 * POST /api/nfs/config
 * Update allowed clients IP restriction and/or custom server host IP
 */
router.post('/config', (req, res) => {
  try {
    const { allowed_ips, server_host } = req.body;
    const result = nfsService.updateConfig(allowed_ips, server_host);

    if (result.success) {
      const rawHost = req.headers.host || req.hostname || '';
      const hostWithoutPort = rawHost.split(':')[0];
      const status = nfsService.getStatus(hostWithoutPort);
      res.json({ success: true, message: 'NFS configuration updated and service reloaded', status });
    } else {
      res.status(500).json({ error: result.error || 'Failed to reload NFS configuration' });
    }
  } catch (err) {
    console.error('[NFS Route] Error updating config:', err);
    res.status(500).json({ error: err.message || 'Failed to update NFS configuration' });
  }
});

export default router;
