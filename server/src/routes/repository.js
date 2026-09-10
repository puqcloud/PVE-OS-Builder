import express from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db/index.js';
import { OUTPUT_DIR } from '../config.js';
import { getEffectiveServerHost } from '../services/networkDetector.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json([]);
    }

    const templates = [];
    const seenFiles = new Set();

    // Scan both OUTPUT_DIR and dump subfolder
    const scanDirs = [OUTPUT_DIR, path.join(OUTPUT_DIR, 'dump')];

    for (const dir of scanDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);

      for (const filename of files) {
        if (
          filename.startsWith('.') ||
          filename.endsWith('.tmp') ||
          filename.endsWith('.notes') ||
          filename === 'dump' ||
          seenFiles.has(filename)
        ) {
          continue;
        }

        const fullPath = path.join(dir, filename);
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch (_) {
          continue;
        }

        if (stat.isFile()) {
          seenFiles.add(filename);

          // Query DB to see if we have build metadata for this file
          const buildInfo = db.prepare(`
            SELECT b.id, b.template_name, b.vmid, b.output_sha256,
                   bi.name as base_image_name, p.name as profile_name, g.name as group_name
            FROM builds b
            LEFT JOIN base_images bi ON b.base_image_id = bi.id
            LEFT JOIN profiles p ON b.profile_id = p.id
            LEFT JOIN groups g ON b.group_id = g.id
            WHERE b.output_filename = ?
          `).get(filename);

          // Read companion Proxmox .notes metadata file if available
          let notes = null;
          const notesPathStd = path.join(dir, `${filename}.notes`);
          const notesPathLegacy = path.join(
            dir,
            filename.replace(/\.vma\.(zst|gz|lzo)$/, '.notes').replace(/\.tar\.(zst|gz)$/, '.notes')
          );
          if (fs.existsSync(notesPathStd)) {
            try { notes = fs.readFileSync(notesPathStd, 'utf-8'); } catch (_) {}
          } else if (fs.existsSync(notesPathLegacy)) {
            try { notes = fs.readFileSync(notesPathLegacy, 'utf-8'); } catch (_) {}
          }

          // Extract metadata from database record or fallback to companion notes
          let baseImageName = buildInfo?.base_image_name || null;
          let profileName = buildInfo?.profile_name || null;
          let groupName = buildInfo?.group_name || null;
          let templateName = buildInfo?.template_name || null;
          let vmid = buildInfo?.vmid || null;
          let sha256 = buildInfo?.output_sha256 || null;

          if (notes) {
            const firstLine = notes.trim().split('\n')[0];
            if (firstLine && firstLine.includes('|')) {
              const parts = firstLine.split('|').map((s) => s.trim());
              if (!baseImageName && parts[0]) baseImageName = parts[0];
              if (!groupName && parts[1]) groupName = parts[1];
            }

            if (!baseImageName) {
              const m =
                notes.match(/\|\s*\*\*OS Distribution\*\*\s*\|\s*([^|\n]+)\|/i) ||
                notes.match(/[•\-\*]?\s*OS Distribution:\s*(.+)$/m) ||
                notes.match(/[•\-\*]?\s*OS:\s*(.+)$/m);
              if (m) baseImageName = m[1].trim();
            }
            if (!profileName) {
              const m =
                notes.match(/\|\s*\*\*Profile Preset\*\*\s*\|\s*([^|\n]+)\|/i) ||
                notes.match(/[•\-\*]?\s*Profile Preset:\s*(.+)$/m) ||
                notes.match(/[•\-\*]?\s*Profile:\s*(.+)$/m);
              if (m) profileName = m[1].trim();
            }
            if (!groupName) {
              const m =
                notes.match(/\|\s*\*\*Regional Group\*\*\s*\|\s*([^|\n]+)\|/i) ||
                notes.match(/[•\-\*]?\s*Regional Group:\s*(.+)$/m) ||
                notes.match(/[•\-\*]?\s*Group:\s*(.+)$/m);
              if (m) groupName = m[1].trim();
            }
            if (!templateName) {
              const m =
                notes.match(/\|\s*\*\*Template Name\*\*\s*\|\s*`?([^`|\n]+)`?\s*\|/i) ||
                notes.match(/[•\-\*]?\s*Template Name:\s*(.+)$/m) ||
                notes.match(/[•\-\*]?\s*Template:\s*(.+)$/m);
              if (m) templateName = m[1].trim();
            }
            if (!vmid) {
              const m =
                notes.match(/\|\s*\*\*Initial VMID\*\*\s*\|\s*`?(\d+)`?\s*\|/i) ||
                notes.match(/[•\-\*]?\s*Initial VMID:\s*(\d+)/m) ||
                notes.match(/[•\-\*]?\s*VMID:\s*(\d+)/m);
              if (m) vmid = parseInt(m[1].trim(), 10);
            }
            if (!sha256) {
              const m =
                notes.match(/SHA-256 Checksum:\*\*?\s*`?([a-fA-F0-9]{64})`?/i) ||
                notes.match(/[•\-\*]?\s*SHA-256 Checksum:\s*([a-fA-F0-9]{64})/m);
              if (m) sha256 = m[1].trim();
            }
          }

          // Fallback template name and VMID if still missing
          if (!templateName) {
            templateName = filename.replace(/\.vma\.(zst|gz|lzo)$/, '').replace(/\.tar\.(zst|gz)$/, '');
          }
          if (!vmid) {
            const vmidMatch = filename.match(/vzdump-(?:qemu|lxc)-(\d+)/);
            if (vmidMatch) vmid = parseInt(vmidMatch[1], 10);
          }

          templates.push({
            filename,
            size_bytes: stat.size,
            size_mb: (stat.size / (1024 * 1024)).toFixed(2),
            created_at: stat.birthtime || stat.mtime,
            modified_at: stat.mtime,
            sha256,
            template_name: templateName,
            vmid,
            base_image_name: baseImageName,
            profile_name: profileName,
            group_name: groupName,
            notes: notes || null,
            download_url: `/repository/${encodeURIComponent(filename)}`,
          });
        }
      }
    }

    // Sort by modified date descending
    templates.sort((a, b) => new Date(b.modified_at) - new Date(a.modified_at));
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NFS Connection info for Proxmox VE storage integration
router.get('/nfs-info', (req, res) => {
  const host = getEffectiveServerHost(req.hostname || req.headers.host?.split(':')[0]);
  res.json({
    server: host,
    nfs_port: 2049,
    rpc_port: 111,
    export_path: '/export',
    export_path_v3: '/data/repository',
    content_type: 'backup',
    pvesm_command: `pvesm add nfs os-builder-storage --server ${host} --export /export --content backup --options ro`,
    pvesm_command_v3: `pvesm add nfs os-builder-storage --server ${host} --export /data/repository --content backup --options ro`,
    qmrestore_example: `qmrestore os-builder-storage:backup/<archive_name>.vma.zst <NEW_VMID> --storage local-lvm`,
  });
});

// Download ready Proxmox template archive (Supports range requests for wget/curl resume)
router.get('/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  let filePath = path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(OUTPUT_DIR, 'dump', filename);
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Template file not found' });
  }

  res.download(filePath, filename);
});

// Clear all templates from repository
router.delete(['/clear-all', '/clear/all'], (req, res) => {
  try {
    const scanDirs = [OUTPUT_DIR, path.join(OUTPUT_DIR, 'dump')];
    let deletedCount = 0;
    for (const dir of scanDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file === '.gitkeep' || file === 'dump') continue;
        const fullPath = path.join(dir, file);
        try {
          const stat = fs.lstatSync(fullPath);
          if (stat.isFile() || stat.isSymbolicLink()) {
            fs.unlinkSync(fullPath);
            deletedCount++;
          }
        } catch (_) {}
      }
    }
    db.prepare('UPDATE builds SET output_path = NULL').run();
    res.json({ success: true, message: `All templates cleared (${deletedCount} files deleted)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete template from repository
router.delete('/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const rootPath = path.join(OUTPUT_DIR, filename);
  const dumpPath = path.join(OUTPUT_DIR, 'dump', filename);
  const notesRoot = rootPath.replace(/\.vma\.(zst|gz|lzo)$/, '.notes').replace(/\.tar\.(zst|gz)$/, '.notes');
  const notesDump = dumpPath.replace(/\.vma\.(zst|gz|lzo)$/, '.notes').replace(/\.tar\.(zst|gz)$/, '.notes');
  const notesRootStd = `${rootPath}.notes`;
  const notesDumpStd = `${dumpPath}.notes`;

  try {
    if (fs.existsSync(rootPath)) fs.unlinkSync(rootPath);
    if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath);
    if (fs.existsSync(notesRoot)) fs.unlinkSync(notesRoot);
    if (fs.existsSync(notesDump)) fs.unlinkSync(notesDump);
    if (fs.existsSync(notesRootStd)) fs.unlinkSync(notesRootStd);
    if (fs.existsSync(notesDumpStd)) fs.unlinkSync(notesDumpStd);

    db.prepare('UPDATE builds SET output_path = NULL WHERE output_filename = ?').run(filename);
    res.json({ success: true, message: `Template ${filename} deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
