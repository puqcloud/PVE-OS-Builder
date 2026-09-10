import express from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db/index.js';
import { DOWNLOADS_DIR, OUTPUT_DIR, CONFIGS_DIR, DB_PATH } from '../config.js';
import { builderService } from '../services/builder.js';

const router = express.Router();

function getDirSize(dirPath) {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        size += stat.size;
      }
    }
  } catch (_) {}
  return size;
}

router.get('/stats', (req, res) => {
  try {
    const baseTotal = db.prepare('SELECT count(*) as count FROM base_images').get().count;
    const baseDownloaded = db.prepare("SELECT count(*) as count FROM base_images WHERE status = 'ready'").get().count;
    const profilesTotal = db.prepare('SELECT count(*) as count FROM profiles').get().count;
    const groupsTotal = db.prepare('SELECT count(*) as count FROM groups').get().count;
    const buildsTotal = db.prepare('SELECT count(*) as count FROM builds').get().count;
    const buildsActive = db.prepare("SELECT count(*) as count FROM builds WHERE status IN ('queued', 'building')").get().count;

    // Output repository files
    let repoTemplatesCount = 0;
    let repoSize = 0;
    if (fs.existsSync(OUTPUT_DIR)) {
      const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.vma.zst') || f.endsWith('.tar.zst') || f.endsWith('.tar.gz'));
      repoTemplatesCount = files.length;
      repoSize = getDirSize(OUTPUT_DIR);
    }

    const downloadsSize = getDirSize(DOWNLOADS_DIR);
    const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;

    const tools = builderService.checkTools();

    // Recent activity
    const recentBuilds = db.prepare(`
      SELECT b.id, b.build_number, b.template_name, b.vmid, b.status, b.progress, b.output_filename, b.output_size, b.created_at,
             bi.name as base_image_name, p.name as profile_name, g.name as group_name
      FROM builds b
      LEFT JOIN base_images bi ON b.base_image_id = bi.id
      LEFT JOIN profiles p ON b.profile_id = p.id
      LEFT JOIN groups g ON b.group_id = g.id
      ORDER BY b.id DESC LIMIT 5
    `).all();

    res.json({
      baseImages: {
        total: baseTotal,
        downloaded: baseDownloaded,
      },
      profiles: {
        total: profilesTotal,
      },
      groups: {
        total: groupsTotal,
      },
      builds: {
        total: buildsTotal,
        active: buildsActive,
      },
      repository: {
        templatesCount: repoTemplatesCount,
        totalBytes: repoSize,
      },
      storage: {
        downloadsBytes: downloadsSize,
        repositoryBytes: repoSize,
        databaseBytes: dbSize,
        totalBytes: downloadsSize + repoSize + dbSize,
      },
      tools,
      recentBuilds,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
