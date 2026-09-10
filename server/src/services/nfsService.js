import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawn } from 'child_process';
import db from '../db/index.js';
import { OUTPUT_DIR } from '../config.js';
import { getAllDetectedIps, getEffectiveServerHost } from './networkDetector.js';

const GANESHA_CONF_PATH = '/etc/ganesha/ganesha.conf';
const GANESHA_PID_PATH = '/var/run/ganesha/ganesha.pid';

export class NfsService {
  /**
   * Auto-detect host and network interface IPv4 addresses
   */
  getDetectedIps() {
    return getAllDetectedIps();
  }

  /**
   * Get active NFS service status and metrics
   */
  getStatus(reqHost = null) {
    let isRunning = false;
    let pid = null;

    // Check process status via pidfile or pgrep
    try {
      if (fs.existsSync(GANESHA_PID_PATH)) {
        const rawPid = fs.readFileSync(GANESHA_PID_PATH, 'utf-8').trim();
        if (rawPid && !isNaN(parseInt(rawPid, 10))) {
          const testPid = parseInt(rawPid, 10);
          try {
            process.kill(testPid, 0); // Check if process exists
            isRunning = true;
            pid = testPid;
          } catch (_) {}
        }
      }
      if (!isRunning) {
        const pgrepOutput = execSync('pgrep -o ganesha.nfsd 2>/dev/null', { encoding: 'utf-8' }).trim();
        if (pgrepOutput) {
          isRunning = true;
          pid = parseInt(pgrepOutput, 10);
        }
      }
    } catch (_) {}

    // Check rpcbind status
    let rpcbindRunning = false;
    try {
      const rpcPid = execSync('pgrep -o rpcbind 2>/dev/null', { encoding: 'utf-8' }).trim();
      if (rpcPid) rpcbindRunning = true;
    } catch (_) {}

    // Retrieve settings from database
    const allowedIpsSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('nfs_allowed_ips');
    const allowedIps = allowedIpsSetting?.value || '*';
    const detectedIps = this.getDetectedIps();
    const serverHost = getEffectiveServerHost(reqHost);

    // Count templates in dump directory
    const dumpDir = path.join(OUTPUT_DIR, 'dump');
    let templateCount = 0;
    let totalSizeBytes = 0;

    const scanDirs = [OUTPUT_DIR, dumpDir];
    const seen = new Set();

    for (const dir of scanDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            if (f.endsWith('.vma.zst') || f.endsWith('.tar.zst') || f.endsWith('.vma.gz')) {
              if (!seen.has(f)) {
                seen.add(f);
                templateCount++;
                try {
                  const stat = fs.statSync(path.join(dir, f));
                  totalSizeBytes += stat.size;
                } catch (_) {}
              }
            }
          }
        } catch (_) {}
      }
    }

    return {
      running: isRunning,
      pid,
      rpcbind_running: rpcbindRunning,
      nfs_port: 2049,
      rpc_port: 111,
      export_path: '/export',
      export_path_v3: '/data/repository',
      content_type: 'backup',
      server_host: serverHost,
      allowed_ips: allowedIps,
      detected_ips: detectedIps,
      template_count: templateCount,
      total_size_mb: (totalSizeBytes / (1024 * 1024)).toFixed(2),
      pvesm_command: `pvesm add nfs os-builder-storage --server ${serverHost} --export /export --content backup --options ro`,
      pvesm_command_v3: `pvesm add nfs os-builder-storage --server ${serverHost} --export /data/repository --content backup --options ro`,
      qmrestore_example: `qmrestore os-builder-storage:backup/<archive_name>.vma.zst <NEW_VMID> --storage local-lvm`,
    };
  }

  /**
   * Generate ganesha.conf with configured allowed IPs
   */
  generateConfig(allowedIps = '*') {
    const clientsRule = allowedIps && allowedIps.trim() && allowedIps.trim() !== '*'
      ? `    Clients = ${allowedIps.trim()};`
      : '';

    return `NFS_CORE_PARAM {
    nb_worker = 4;
    Protocols = 3, 4;
    NFS_Port = 2049;
    MNT_Port = 20048;
    NLM_Port = 32803;
    Rquota_Port = 875;
    Mount_Path_Pseudo = true;
}

NFSv4 {
    RecoveryBackend = "null";
    Minor_Versions = 0, 1, 2;
}

EXPORT {
    Export_Id = 77;
    Path = /data/repository;
    Pseudo = /export;
    Access_Type = RO;
    Squash = No_Root_Squash;
    PrivilegedPort = false;
    Protocols = 3, 4;
    Transports = TCP, UDP;
    SecType = sys;
${clientsRule}

    FSAL {
        Name = VFS;
    }
}

LOG {
    Default_Log_Level = INFO;
    Facility {
        name = FILE;
        destination = "/data/scratch/ganesha.log";
        enable = active;
    }
}
`;
  }

  /**
   * Save configuration and reload NFS-Ganesha
   */
  updateConfig(allowedIps, serverHost) {
    // Save to settings table
    if (allowedIps !== undefined) {
      db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('nfs_allowed_ips', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).run(allowedIps.trim() || '*');
    }

    if (serverHost !== undefined) {
      const cleanHost = serverHost.trim();
      const isInternal = !cleanHost || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanHost) || cleanHost === 'localhost' || cleanHost === '127.0.0.1';
      if (isInternal) {
        db.prepare("DELETE FROM settings WHERE key = 'nfs_server_host'").run();
      } else {
        db.prepare(`
          INSERT INTO settings (key, value, updated_at)
          VALUES ('nfs_server_host', ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).run(cleanHost);
      }
    }

    // Write new config file
    const confContent = this.generateConfig(allowedIps || '*');
    try {
      fs.writeFileSync(GANESHA_CONF_PATH, confContent);
    } catch (err) {
      console.error('[NFS Service] Failed to write ganesha.conf:', err.message);
    }

    // Restart/reload service
    return this.restartService();
  }

  /**
   * Safely restart NFS-Ganesha and rpcbind
   */
  restartService() {
    try {
      // 1. Ensure rpcbind is running
      try {
        execSync('pgrep rpcbind || rpcbind -w', { stdio: 'pipe' });
      } catch (_) {}

      // 2. Kill existing ganesha.nfsd processes
      try {
        execSync('pkill -9 ganesha.nfsd 2>/dev/null || true', { stdio: 'pipe' });
      } catch (_) {}

      // Clean old pid file
      if (fs.existsSync(GANESHA_PID_PATH)) {
        try { fs.unlinkSync(GANESHA_PID_PATH); } catch (_) {}
      }

      // 3. Ensure runtime directories exist
      fs.mkdirSync('/var/run/ganesha', { recursive: true });
      fs.mkdirSync('/run/rpcbind', { recursive: true });
      fs.mkdirSync(path.join(OUTPUT_DIR, 'dump'), { recursive: true });

      // 4. Start ganesha.nfsd in background
      const confFile = fs.existsSync(GANESHA_CONF_PATH) ? GANESHA_CONF_PATH : '/app/ganesha.conf';
      const proc = spawn('ganesha.nfsd', ['-f', confFile, '-p', GANESHA_PID_PATH], {
        detached: true,
        stdio: 'ignore',
      });
      proc.unref();

      // Give it a brief moment to bind port 2049
      execSync('sleep 1');

      console.log('[NFS Service] NFS-Ganesha daemon restarted successfully.');
      return { success: true, message: 'NFS-Ganesha daemon restarted successfully' };
    } catch (err) {
      console.error('[NFS Service] Error restarting NFS-Ganesha:', err.message);
      return { success: false, error: err.message };
    }
  }
}

export const nfsService = new NfsService();
