import express from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db/index.js';
import { OUTPUT_DIR } from '../config.js';
import { getEffectiveServerHost } from '../services/networkDetector.js';

const router = express.Router();

function getPublicTemplates() {
  if (!fs.existsSync(OUTPUT_DIR)) return [];

  const templates = [];
  const seenFiles = new Set();
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

        // Attempt reading companion notes file
        let notes = null;
        const notesPath1 = path.join(dir, `${filename}.notes`);
        const baseNameWithoutExt = filename.replace(/\.vma\.(zst|gz|lzo)$/, '').replace(/\.tar\.(zst|gz)$/, '');
        const notesPath2 = path.join(dir, `${baseNameWithoutExt}.notes`);
        const notesPath3 = path.join(OUTPUT_DIR, `${filename}.notes`);
        const notesPath4 = path.join(OUTPUT_DIR, `${baseNameWithoutExt}.notes`);

        for (const np of [notesPath1, notesPath2, notesPath3, notesPath4]) {
          if (fs.existsSync(np)) {
            try {
              notes = fs.readFileSync(np, 'utf8');
              break;
            } catch (_) {}
          }
        }

        let buildInfo = null;
        try {
          buildInfo = db.prepare(`
            SELECT b.id, b.template_name, b.vmid, b.output_sha256,
                   bi.name as base_image_name, p.name as profile_name, g.name as group_name
            FROM builds b
            LEFT JOIN base_images bi ON b.base_image_id = bi.id
            LEFT JOIN profiles p ON b.profile_id = p.id
            LEFT JOIN groups g ON b.group_id = g.id
            WHERE b.output_filename = ?
          `).get(filename);
        } catch (_) {}

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

  templates.sort((a, b) => new Date(b.modified_at) - new Date(a.modified_at));
  return templates;
}

// 1. Direct Public Download Endpoint (Supports Range requests for wget -c / curl -C -)
router.get(['/repository/:filename', '/download/:filename'], (req, res) => {
  const filename = path.basename(req.params.filename);
  let filePath = path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(OUTPUT_DIR, 'dump', filename);
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Template archive not found in repository' });
  }

  // Set explicit download headers
  res.setHeader('Accept-Ranges', 'bytes');
  res.download(filePath, filename);
});

// 2. Public Template Catalog in JSON format (for automation scripts and WHMCS modules)
router.get(['/repository.json', '/repo.json', '/api/public-repo/templates'], (req, res) => {
  try {
    const list = getPublicTemplates();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. NFS Connection Info for Proxmox VE Storage Integration
router.get(['/nfs.json', '/api/public-repo/nfs-info'], (req, res) => {
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

// 3. Dedicated Public HTML Template Repository Page (Zero Auth Required)
router.get(['/repo', '/repo/', '/downloads', '/downloads/', '/repository/'], (req, res) => {
  try {
    const templates = getPublicTemplates();
    const host = req.get('host') || 'localhost:8080';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;
    const nfsHost = getEffectiveServerHost(req.hostname || host.split(':')[0]);

    let totalSizeBytes = 0;
    for (const t of templates) totalSizeBytes += t.size_bytes;
    const totalSizeMb = (totalSizeBytes / (1024 * 1024)).toFixed(1);

    const rowsHtml = templates.length === 0
      ? `<tr><td colspan="6" style="text-align: center; padding: 48px 16px; color: #64748b;">No ready templates in repository yet. Generate templates using Build Studio.</td></tr>`
      : templates.map((t) => {
          const downloadHref = `${baseUrl}/repository/${encodeURIComponent(t.filename)}`;
          const vmidStr = t.vmid ? String(t.vmid) : '9000';
          const wgetCmd = `wget -c ${downloadHref} -P /var/lib/vz/dump/`;
          const qmrestoreCmd = `qmrestore /var/lib/vz/dump/${t.filename} ${vmidStr} --storage local-lvm`;

          return `
          <tr class="template-row" data-name="${(t.template_name + ' ' + t.filename + ' ' + (t.group_name || '') + ' ' + (t.base_image_name || '')).toLowerCase()}">
            <td style="white-space: nowrap;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 600; color: #f8fafc; font-size: 13.5px;">${escapeHtml(t.template_name)}</span>
                ${t.vmid ? `<span class="badge badge-vmid" style="margin-top: 0; padding: 1px 6px; font-size: 10px;">VMID: ${t.vmid}</span>` : ''}
              </div>
              <div style="margin-top: 3px;">
                <code class="code-filename" style="font-size: 11px;">${escapeHtml(t.filename)}</code>
              </div>
            </td>
            <td style="white-space: nowrap;">
              <span class="size-text">${t.size_mb} MB</span>
            </td>
            <td style="white-space: nowrap;">
              <span style="color: #cbd5e1; font-weight: 500;">${escapeHtml(t.base_image_name || '—')}</span>
            </td>
            <td style="white-space: nowrap;">
              <div>
                ${t.group_name ? `<span class="badge badge-group" style="padding: 1px 6px; font-size: 10.5px;">${escapeHtml(t.group_name)}</span>` : '<span style="color: #64748b;">—</span>'}
              </div>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 3px;">
                ${escapeHtml(t.profile_name || '—')}
              </div>
            </td>
            <td style="text-align: center; white-space: nowrap;">
              ${t.sha256 ? `
                <button onclick="copyToClipboard('${escapeJs(t.sha256)}', this)" class="btn btn-copy" style="font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 3px 8px; gap: 4px;" title="Copy SHA-256 Checksum:&#10;${escapeHtml(t.sha256)}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  <span>Copy SHA</span>
                </button>
              ` : '<span style="color: #64748b;">—</span>'}
            </td>
            <td style="text-align: right; white-space: nowrap;">
              <div style="display: flex; flex-direction: column; gap: 5px; align-items: flex-end;">
                <div style="display: flex; gap: 5px; justify-content: flex-end;">
                  <a href="${downloadHref}" class="btn btn-download" style="padding: 3px 9px; font-size: 11.5px;" title="Download archive directly">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span>Download</span>
                  </a>
                  <button onclick="copyToClipboard('${escapeJs(qmrestoreCmd)}', this)" class="btn btn-copy" style="padding: 3px 8px; font-size: 11.5px;" title="Copy qmrestore command">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                    <span>qmrestore</span>
                  </button>
                </div>
                <div style="display: flex; gap: 5px; justify-content: flex-end;">
                  ${t.notes ? `<button onclick="showNotesModal('${escapeJs(t.filename)}')" class="btn btn-notes" style="padding: 3px 8px; font-size: 11.5px;" title="View Proxmox template notes"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg><span>Notes</span></button>` : ''}
                  <button onclick="copyToClipboard('${escapeJs(wgetCmd)}', this)" class="btn btn-copy" style="padding: 3px 8px; font-size: 11.5px;" title="Copy Proxmox wget command">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                    <span>wget Cmd</span>
                  </button>
                </div>
              </div>
            </td>
          </tr>
          `;
        }).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ready Templates Repository - Proxmox VE Template Builder</title>
  <link rel="icon" type="image/png" href="/puq-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-main: #0b0f19;
      --bg-card: #111827;
      --bg-panel: #1e293b;
      --border-color: #334155;
      --accent-cyan: #0be0c7;
      --accent-blue: #38bdf8;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --radius-sm: 6px;
      --radius-md: 10px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-main);
      color: var(--text-main);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      padding: 32px 24px;
      line-height: 1.5;
    }
    .container {
      width: 100%;
      max-width: 1900px;
      margin: 0 auto;
      box-sizing: border-box;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
      background: linear-gradient(135deg, #0be0c7 0%, #0284c7 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0b0f19;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
    }
    .brand-subtitle {
      font-size: 13px;
      color: var(--text-muted);
    }
    .header-links {
      display: flex;
      gap: 12px;
    }
    .header-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      border: 1px solid var(--border-color);
      color: var(--text-main);
      background: var(--bg-card);
      transition: all 0.2s;
    }
    .header-link:hover {
      border-color: var(--accent-cyan);
      color: var(--accent-cyan);
    }
    .info-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 20px 24px;
      margin-bottom: 28px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .info-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--accent-cyan);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .cli-box {
      background: #060a12;
      border: 1px solid #1e293b;
      border-radius: var(--radius-sm);
      padding: 12px 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: #38bdf8;
      overflow-x: auto;
    }
    .panel {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .panel-header {
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .panel-stats {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .panel-stats strong {
      color: #fff;
    }
    .search-input {
      background: var(--bg-panel);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      color: #fff;
      padding: 8px 14px;
      font-size: 13px;
      width: 260px;
      outline: none;
    }
    .search-input:focus {
      border-color: var(--accent-cyan);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    th {
      text-align: left;
      padding: 12px 18px;
      background: rgba(30, 41, 59, 0.4);
      color: var(--text-muted);
      font-weight: 600;
      border-bottom: 1px solid var(--border-color);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    td {
      padding: 14px 18px;
      border-bottom: 1px solid #1e293b;
      vertical-align: middle;
      white-space: nowrap;
    }
    tr:hover td {
      background: rgba(30, 41, 59, 0.3);
    }
    .code-filename {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--accent-cyan);
      background: rgba(11, 224, 199, 0.08);
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .size-text {
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .badge-vmid {
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      margin-top: 4px;
    }
    .badge-group {
      background: rgba(11, 224, 199, 0.15);
      color: var(--accent-cyan);
      border: 1px solid rgba(11, 224, 199, 0.3);
    }
    .checksum-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-muted);
      background: #0b0f19;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: help;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s;
      border: 1px solid transparent;
    }
    .btn-download {
      background: var(--accent-cyan);
      color: #0b0f19;
      font-weight: 600;
    }
    .btn-download:hover {
      background: #02c7b0;
    }
    .btn-notes {
      background: rgba(56, 189, 248, 0.12);
      color: #38bdf8;
      border-color: rgba(56, 189, 248, 0.35);
    }
    .btn-notes:hover {
      background: rgba(56, 189, 248, 0.25);
      border-color: #38bdf8;
    }
    .btn-copy {
      background: var(--bg-panel);
      color: #e2e8f0;
      border-color: var(--border-color);
    }
    .btn-copy:hover {
      border-color: var(--accent-cyan);
      color: var(--accent-cyan);
    }
    .btn-copy.copied {
      background: rgba(34, 197, 94, 0.2);
      border-color: #22c55e;
      color: #4ade80;
    }
    footer {
      text-align: center;
      margin-top: 36px;
      font-size: 12.5px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <a href="/" style="display: flex; align-items: center; text-decoration: none;">
          <img src="/logo.png" alt="PUQcloud Logo" style="height: 38px; width: auto; object-fit: contain; margin-right: 14px;">
        </a>
        <div>
          <h1 class="brand-title">PVE OS Builder &bull; Ready Templates Repository</h1>
          <p class="brand-subtitle">Open Public Download Mirror for Proxmox VE Nodes &amp; WHMCS Automation</p>
        </div>
      </div>
      <div class="header-links">
        <a href="https://puqcloud.com/" target="_blank" rel="noopener noreferrer" class="header-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          <span>PUQcloud</span>
        </a>
        <a href="https://doc.puq.info/books/proxmoxkvm-whmcs-module" target="_blank" rel="noopener noreferrer" class="header-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          <span>Documentation</span>
        </a>
        <a href="/repository.json" target="_blank" class="header-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          <span>Catalog JSON</span>
        </a>
        <a href="/" class="header-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span>Admin Console</span>
        </a>
      </div>
    </header>

    <div class="info-card">
      <div class="info-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <span>Proxmox VE Storage Integration &amp; Quick Restore Guide</span>
      </div>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
        Connect this repository directly to your Proxmox cluster as a Read-Only NFS backup storage (no manual downloading needed), or download individual archives via HTTP/wget:
      </p>
      <div class="cli-box">
        <span style="color: #a7f3d0; font-weight: 600;"># Option 1: Mount directly in Proxmox VE as a native Storage Pool (Instant 1-Click Restore):</span><br>
        pvesm add nfs os-builder-storage --server ${nfsHost} --export /export --content backup --options ro<br><br>
        <span style="color: #93c5fd; font-weight: 600;"># Option 2: Download directly via wget to Proxmox VE dump directory:</span><br>
        wget -c ${baseUrl}/repository/&lt;filename.vma.zst&gt; -P /var/lib/vz/dump/<br><br>
        <span style="color: #fde047; font-weight: 600;"># Restore from NFS storage or local dump:</span><br>
        qmrestore os-builder-storage:backup/&lt;filename.vma.zst&gt; &lt;vmid&gt; --storage local-lvm
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-stats">
          <div>Total Templates: <strong>${templates.length}</strong></div>
          <div>Total Repository Size: <strong>${totalSizeMb} MB</strong></div>
        </div>
        <div>
          <input type="text" id="searchFilter" class="search-input" placeholder="Search templates, OS, or groups..." oninput="filterTemplates(this.value)">
        </div>
      </div>

      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>Template &amp; Archive</th>
              <th>Size</th>
              <th>Base OS Image</th>
              <th>Group &amp; Profile</th>
              <th style="text-align: center;">SHA-256</th>
              <th style="text-align: right;">Download &amp; Commands</th>
            </tr>
          </thead>
          <tbody id="templatesBody">
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <footer style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #1e293b; text-align: center; display: flex; flex-direction: column; gap: 14px; color: #64748b; font-size: 13px;">
      <div style="display: flex; justify-content: center; gap: 18px; flex-wrap: wrap;">
        <a href="https://puqcloud.com/" target="_blank" rel="noopener noreferrer" style="color: #94a3b8; text-decoration: none;">PUQcloud.com</a>
        <span style="color: #334155;">&bull;</span>
        <a href="https://puqsoftware.com/" target="_blank" rel="noopener noreferrer" style="color: #94a3b8; text-decoration: none;">PUQsoftware.com</a>
        <span style="color: #334155;">&bull;</span>
        <a href="https://doc.puq.info/books/proxmoxkvm-whmcs-module" target="_blank" rel="noopener noreferrer" style="color: #94a3b8; text-decoration: none;">WHMCS Proxmox Guide</a>
        <span style="color: #334155;">&bull;</span>
        <a href="https://github.com/puqcloud" target="_blank" rel="noopener noreferrer" style="color: #94a3b8; text-decoration: none;">GitHub Community</a>
        <span style="color: #334155;">&bull;</span>
        <a href="https://www.youtube.com/@PUQCloud" target="_blank" rel="noopener noreferrer" style="color: #94a3b8; text-decoration: none;">YouTube</a>
        <span style="color: #334155;">&bull;</span>
        <a href="https://t.me/puqcloud" target="_blank" rel="noopener noreferrer" style="color: #94a3b8; text-decoration: none;">Telegram</a>
        <span style="color: #334155;">&bull;</span>
        <a href="https://www.facebook.com/puqcloud" target="_blank" rel="noopener noreferrer" style="color: #94a3b8; text-decoration: none;">Facebook</a>
        <span style="color: #334155;">&bull;</span>
        <a href="https://www.linkedin.com/company/puqcloud" target="_blank" rel="noopener noreferrer" style="color: #94a3b8; text-decoration: none;">LinkedIn</a>
      </div>
      <div>
        PUQcloud PVE OS Builder &bull; Docker Edition &bull; Open HTTP Template Repository Mirror
      </div>
    </footer>
  </div>

  <!-- Proxmox Notes Modal -->
  <div id="notesModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); backdrop-filter:blur(4px); z-index:999; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;">
    <div style="background:#111827; border:1px solid #334155; border-radius:10px; width:100%; max-width:760px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.8);">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid #1e293b;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:#38bdf8; font-weight:600; font-size:15px;" id="modalNotesTitle">Template Notes</span>
        </div>
        <button onclick="closeNotesModal()" style="background:none; border:none; color:#94a3b8; font-size:22px; cursor:pointer; line-height:1;">&times;</button>
      </div>
      <div style="padding:20px; overflow-y:auto; flex:1;">
        <pre id="modalNotesContent" style="background:#060a12; border:1px solid #1e293b; border-radius:6px; padding:16px; font-family:'JetBrains Mono',monospace; font-size:12.5px; color:#e2e8f0; white-space:pre-wrap; line-height:1.5;"></pre>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid #1e293b; background:#0b0f19;">
        <button onclick="copyModalNotes()" class="btn btn-copy" id="modalCopyBtn">
          <span>Copy Notes</span>
        </button>
        <button onclick="closeNotesModal()" class="btn btn-download">
          <span>Close</span>
        </button>
      </div>
    </div>
  </div>

  <script>
    const templateNotesMap = ${JSON.stringify(templates.reduce((acc, t) => { if (t.notes) acc[t.filename] = t.notes; return acc; }, {}))};

    function showNotesModal(filename) {
      const content = templateNotesMap[filename] || 'No companion notes available.';
      document.getElementById('modalNotesTitle').textContent = filename + ' - Notes';
      document.getElementById('modalNotesContent').textContent = content;
      const modal = document.getElementById('notesModal');
      modal.style.display = 'flex';
    }

    function closeNotesModal() {
      document.getElementById('notesModal').style.display = 'none';
    }

    function copyModalNotes() {
      const text = document.getElementById('modalNotesContent').textContent;
      copyToClipboard(text, document.getElementById('modalCopyBtn'));
    }

    function copyToClipboard(text, btn) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => flashBtn(btn));
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        flashBtn(btn);
      }
    }

    function flashBtn(btn) {
      const origHtml = btn.innerHTML;
      btn.classList.add('copied');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Copied!</span>';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = origHtml;
      }, 2000);
    }

    function filterTemplates(query) {
      const q = query.toLowerCase().trim();
      const rows = document.querySelectorAll('.template-row');
      rows.forEach(r => {
        const name = r.getAttribute('data-name') || '';
        r.style.display = name.includes(q) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(`Error loading template repository: ${err.message}`);
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeJs(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}

export default router;
