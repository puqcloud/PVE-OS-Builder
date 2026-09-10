import express from 'express';
import fs from 'fs';
import db from '../db/index.js';
import { GROUPS_CONFIG_PATH } from '../services/groupsCatalog.js';
import { syncGroupsWithDatabase, saveDatabaseGroupsToFile } from '../services/groupsCatalog.js';
import { checkMirrorReachability, checkDistroMirrors } from '../services/mirrorValidator.js';

const router = express.Router();

// Connectivity and health check for package mirrors
router.post('/test-mirrors', async (req, res) => {
  try {
    const { mirrors, url } = req.body;
    if (url) {
      const result = await checkMirrorReachability(url);
      return res.json({ ok: result.ok, result });
    }
    if (mirrors && typeof mirrors === 'object') {
      const results = await checkDistroMirrors(mirrors);
      return res.json({ ok: true, results });
    }
    return res.status(400).json({ error: 'Provide url string or mirrors object' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const rawGroups = db.prepare('SELECT * FROM groups ORDER BY id ASC').all();
    const groups = rawGroups.map((g) => {
      let mirrors = {};
      try {
        mirrors = g.package_mirrors ? JSON.parse(g.package_mirrors) : {};
      } catch (_) {
        mirrors = {};
      }
      return { ...g, package_mirrors: mirrors };
    });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get raw JSON file content
router.get('/catalog-json', (req, res) => {
  try {
    if (fs.existsSync(GROUPS_CONFIG_PATH)) {
      const raw = fs.readFileSync(GROUPS_CONFIG_PATH, 'utf-8');
      res.json(JSON.parse(raw));
    } else {
      res.json([]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update entire JSON file and re-sync database
router.put('/catalog-json', (req, res) => {
  try {
    const newGroups = req.body;
    if (!Array.isArray(newGroups)) {
      return res.status(400).json({ error: 'Groups must be a JSON array' });
    }

    fs.writeFileSync(GROUPS_CONFIG_PATH, JSON.stringify(newGroups, null, 2), 'utf-8');
    syncGroupsWithDatabase(db);
    res.json({ success: true, message: 'Localization groups JSON updated and synchronized' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reload groups from JSON file
router.post('/reload-catalog', (req, res) => {
  try {
    syncGroupsWithDatabase(db);
    res.json({ success: true, message: 'Groups reloaded from localization_groups.json' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    let mirrors = {};
    try {
      mirrors = group.package_mirrors ? JSON.parse(group.package_mirrors) : {};
    } catch (_) {
      mirrors = {};
    }
    res.json({ ...group, package_mirrors: mirrors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const g = req.body;
  if (!g.name) return res.status(400).json({ error: 'Group name is required' });

  let mirrorsStr = '{}';
  if (g.package_mirrors) {
    mirrorsStr = typeof g.package_mirrors === 'object' ? JSON.stringify(g.package_mirrors) : g.package_mirrors;
  } else if (g.apt_mirror) {
    mirrorsStr = JSON.stringify({ debian: g.apt_mirror, ubuntu: g.apt_mirror });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO groups (name, description, timezone, locale, nameservers, apt_mirror, region_code, package_mirrors, custom_script)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      g.name,
      g.description || '',
      g.timezone || 'UTC',
      g.locale || 'en_US.UTF-8',
      g.nameservers || '1.1.1.1, 8.8.8.8',
      g.apt_mirror || '',
      g.region_code || 'GLOBAL',
      mirrorsStr,
      g.custom_script || ''
    );

    saveDatabaseGroupsToFile(db);
    const newGroup = db.prepare('SELECT * FROM groups WHERE id = ?').get(insert.lastInsertRowid);
    let parsedMirrors = {};
    try { parsedMirrors = JSON.parse(newGroup.package_mirrors); } catch (_) {}
    res.status(201).json({ ...newGroup, package_mirrors: parsedMirrors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const g = req.body;
  const id = req.params.id;

  let mirrorsStr = '{}';
  if (g.package_mirrors) {
    mirrorsStr = typeof g.package_mirrors === 'object' ? JSON.stringify(g.package_mirrors) : g.package_mirrors;
  } else if (g.apt_mirror) {
    mirrorsStr = JSON.stringify({ debian: g.apt_mirror, ubuntu: g.apt_mirror });
  }

  try {
    db.prepare(`
      UPDATE groups SET
        name = ?,
        description = ?,
        timezone = ?,
        locale = ?,
        nameservers = ?,
        apt_mirror = ?,
        region_code = ?,
        package_mirrors = ?,
        custom_script = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      g.name,
      g.description || '',
      g.timezone || 'UTC',
      g.locale || 'en_US.UTF-8',
      g.nameservers || '1.1.1.1, 8.8.8.8',
      g.apt_mirror || '',
      g.region_code || 'GLOBAL',
      mirrorsStr,
      g.custom_script || '',
      id
    );

    saveDatabaseGroupsToFile(db);
    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
    let parsedMirrors = {};
    try { parsedMirrors = JSON.parse(updated.package_mirrors); } catch (_) {}
    res.json({ ...updated, package_mirrors: parsedMirrors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
    saveDatabaseGroupsToFile(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
