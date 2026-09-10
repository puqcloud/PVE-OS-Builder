import express from 'express';
import os from 'os';
import { DATA_DIR, DB_PATH, DOWNLOADS_DIR, CONFIGS_DIR, OUTPUT_DIR, ADMIN_USER, PORT } from '../config.js';
import { builderService } from '../services/builder.js';

const router = express.Router();

router.get('/', (req, res) => {
  const tools = builderService.checkTools();

  res.json({
    app: {
      name: 'pve-os-builder-docker',
      version: '1.0.0',
      port: PORT,
    },
    auth: {
      adminUser: ADMIN_USER,
    },
    paths: {
      dataDir: DATA_DIR,
      dbPath: DB_PATH,
      downloadsDir: DOWNLOADS_DIR,
      configsDir: CONFIGS_DIR,
      outputDir: OUTPUT_DIR,
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptimeSeconds: os.uptime(),
      nodeVersion: process.version,
      memoryTotal: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
      memoryFree: (os.freemem() / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
    },
    tools,
  });
});

export default router;
