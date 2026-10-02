import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import crypto from 'crypto';
import db from '../db/index.js';
import { OUTPUT_DIR, SCRATCH_DIR } from '../config.js';
import { checkMirrorReachability } from './mirrorValidator.js';

/**
 * Run a CLI command asynchronously without blocking the Node.js event loop.
 * Streams stdout and stderr line-by-line to onLine callback.
 */
function runCommand(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    let stderrData = '';
    let outBuf = '';
    let errBuf = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdoutData += text;
        if (options.onLine) {
          outBuf += text;
          const lines = outBuf.split('\n');
          outBuf = lines.pop() || '';
          for (const line of lines) {
            if (line.trim()) options.onLine(line);
          }
        }
      });
      child.stdout.on('end', () => {
        if (options.onLine && outBuf.trim()) {
          options.onLine(outBuf);
          outBuf = '';
        }
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderrData += text;
        if (options.onLine) {
          errBuf += text;
          const lines = errBuf.split('\n');
          errBuf = lines.pop() || '';
          for (const line of lines) {
            if (line.trim()) options.onLine(line);
          }
        }
      });
      child.stderr.on('end', () => {
        if (options.onLine && errBuf.trim()) {
          options.onLine(errBuf);
          errBuf = '';
        }
      });
    }

    child.on('error', (err) => reject(err));

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout: stdoutData, stderr: stderrData });
      } else {
        const err = new Error(`${cmd} exited with code ${code}: ${(stderrData || stdoutData).trim()}`);
        err.code = code;
        err.stdout = stdoutData;
        err.stderr = stderrData;
        reject(err);
      }
    });
  });
}

class BuilderService {
  constructor() {
    this.activeBuildId = null;
    this.subscribers = new Map(); // buildId -> Set of res

    // Automatically detect and recover any builds interrupted by a server restart or crash
    this._recoverInterruptedBuilds();

    // Automatically check and process any remaining queued builds on startup
    setTimeout(() => this._processQueue(), 1500);
  }

  _recoverInterruptedBuilds() {
    try {
      const activeBuilding = db.prepare(`
        SELECT * FROM builds 
        WHERE status = 'building'
      `).all();

      if (activeBuilding.length > 0) {
        console.log(`[Builder] Found ${activeBuilding.length} active build(s) interrupted by server restart. Cleaning up...`);
        for (const b of activeBuilding) {
          const workDir = path.join(SCRATCH_DIR, `build-${b.id}`);
          if (fs.existsSync(workDir)) {
            try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) {}
          }
          const failReason = 'Build interrupted by server restart or shutdown';
          const appendLogLine = `\n[${new Date().toISOString().substring(11, 19)}] [CRITICAL] ${failReason}. Click Retry to start again.\n`;
          db.prepare(`
            UPDATE builds 
            SET status = 'failed',
                current_step = 'Interrupted by server restart',
                error_message = ?,
                log = COALESCE(log, '') || ?,
                completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(failReason, appendLogLine, b.id);
        }
      }

      const queuedCount = db.prepare("SELECT COUNT(*) as cnt FROM builds WHERE status = 'queued'").get()?.cnt || 0;
      if (queuedCount > 0) {
        console.log(`[Builder] Preserved ${queuedCount} pending build(s) in queue after restart.`);
      }
    } catch (err) {
      console.error('[Builder] Error recovering interrupted builds:', err.message);
    }
  }

  subscribe(buildId, res) {
    if (!this.subscribers.has(buildId)) {
      this.subscribers.set(buildId, new Set());
    }
    this.subscribers.get(buildId).add(res);
    res.on('close', () => {
      const set = this.subscribers.get(buildId);
      if (set) {
        set.delete(res);
        if (set.size === 0) this.subscribers.delete(buildId);
      }
    });
  }

  broadcast(buildId, data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    const set = this.subscribers.get(buildId);
    if (set) {
      for (const client of set) {
        try {
          client.write(message);
          if (typeof client.flush === 'function') {
            client.flush();
          }
        } catch (_) {}
      }
    }
  }

  appendLog(buildId, text) {
    const timestamp = new Date().toISOString().substring(11, 19);
    const line = `[${timestamp}] ${text}\n`;
    db.prepare('UPDATE builds SET log = log || ? WHERE id = ?').run(line, buildId);
    this.broadcast(buildId, { type: 'log', text: line });
  }

  updateStatus(buildId, updates) {
    const sets = [];
    const values = [];
    for (const [k, v] of Object.entries(updates)) {
      sets.push(`${k} = ?`);
      values.push(v);
    }
    values.push(buildId);
    db.prepare(`UPDATE builds SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    this.broadcast(buildId, { type: 'status', ...updates });
  }

  checkTools() {
    const tools = {
      'qemu-img': false,
      'vma': false,
      'zstd': false,
      'virt-customize': false,
      'guestfish': false,
      'aria2c': false,
    };

    for (const tool of Object.keys(tools)) {
      try {
        execSync(`which ${tool}`, { stdio: 'ignore' });
        tools[tool] = true;
      } catch (_) {
        tools[tool] = false;
      }
    }
    tools['kvm'] = fs.existsSync('/dev/kvm');
    return tools;
  }

  async startBuild(buildParams) {
    const { template_name, vmid, base_image_id, profile_id, group_id } = buildParams;

    const baseImage = db.prepare('SELECT * FROM base_images WHERE id = ?').get(base_image_id);
    if (!baseImage) throw new Error('Base image not found');
    if (baseImage.status !== 'ready' || !baseImage.file_path || !fs.existsSync(baseImage.file_path)) {
      throw new Error(`Base image '${baseImage.name}' is not ready or not downloaded yet`);
    }

    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profile_id);
    if (!profile) throw new Error('Profile not found');

    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(group_id);
    if (!group) throw new Error('Group not found');

    const maxRow = db.prepare('SELECT MAX(build_number) as max_num FROM builds').get();
    const buildNumber = (maxRow?.max_num || 0) + 1;

    const info = db.prepare(`
      INSERT INTO builds (
        build_number, template_name, vmid, base_image_id, profile_id, group_id,
        status, progress, current_step, log
      ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, 'Queued in build pipeline', '')
    `).run(buildNumber, template_name, vmid, base_image_id, profile_id, group_id);

    const buildId = info.lastInsertRowid;

    // Trigger sequential queue processing asynchronously on next tick
    setImmediate(() => {
      this._processQueue().catch((err) => {
        console.error('Queue processing error:', err);
      });
    });

    return { buildId, buildNumber, status: 'queued' };
  }

  async startBatch(jobs) {
    if (!Array.isArray(jobs) || jobs.length === 0) {
      throw new Error('No build jobs provided');
    }

    const createdJobs = [];
    const maxRow = db.prepare('SELECT MAX(build_number) as max_num FROM builds').get();
    let num = (maxRow?.max_num || 0) + 1;

    const insertTx = db.transaction((items) => {
      for (const job of items) {
        const { template_name, vmid, base_image_id, profile_id, group_id } = job;

        const baseImage = db.prepare('SELECT * FROM base_images WHERE id = ?').get(base_image_id);
        if (!baseImage || baseImage.status !== 'ready') {
          throw new Error(`Base image for '${template_name}' is not downloaded yet`);
        }

        const info = db.prepare(`
          INSERT INTO builds (
            build_number, template_name, vmid, base_image_id, profile_id, group_id,
            status, progress, current_step, log
          ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, 'Queued in batch pipeline', '')
        `).run(num, template_name, vmid, base_image_id, profile_id, group_id);

        createdJobs.push({
          buildId: info.lastInsertRowid,
          buildNumber: num,
          template_name,
          vmid,
        });
        num++;
      }
    });

    insertTx(jobs);

    // Trigger queue processing asynchronously on next tick
    setImmediate(() => {
      this._processQueue().catch((err) => {
        console.error('Batch queue processing error:', err);
      });
    });

    return {
      queuedCount: createdJobs.length,
      firstBuildId: createdJobs[0]?.buildId,
      jobs: createdJobs,
    };
  }

  async retryBuild(identifier) {
    const build = db.prepare('SELECT * FROM builds WHERE id = ? OR build_number = ?').get(identifier, identifier);
    if (!build) {
      throw new Error(`Build #${identifier} not found in history`);
    }

    if (build.status === 'building' || build.status === 'queued') {
      return {
        buildId: build.id,
        buildNumber: build.build_number,
        status: build.status,
        alreadyActive: true,
        message: `Build #${build.build_number || build.id} is already ${build.status}`
      };
    }

    const existingActive = db.prepare(`
      SELECT * FROM builds
      WHERE template_name = ? AND status IN ('building', 'queued') AND id != ?
      ORDER BY id DESC LIMIT 1
    `).get(build.template_name, build.id);

    if (existingActive) {
      return {
        buildId: existingActive.id,
        buildNumber: existingActive.build_number,
        status: existingActive.status,
        alreadyActive: true,
        message: `Template '${build.template_name}' is already in progress (Build #${existingActive.build_number || existingActive.id} is ${existingActive.status})`
      };
    }

    const baseImage = db.prepare('SELECT id, name, status, file_path FROM base_images WHERE id = ?').get(build.base_image_id);
    if (!baseImage || baseImage.status !== 'ready' || !baseImage.file_path || !fs.existsSync(baseImage.file_path)) {
      throw new Error(`Base image '${baseImage?.name || 'unknown'}' is not downloaded yet or not ready`);
    }

    const workDir = path.join(SCRATCH_DIR, `build-${build.id}`);
    if (fs.existsSync(workDir)) {
      try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) {}
    }

    db.prepare(`
      UPDATE builds
      SET status = 'queued',
          progress = 0,
          current_step = 'Queued for retry',
          error_message = NULL,
          log = '',
          output_filename = NULL,
          output_path = NULL,
          output_size = 0,
          output_sha256 = NULL,
          completed_at = NULL
      WHERE id = ?
    `).run(build.id);

    this.broadcast(build.id, {
      type: 'status',
      status: 'queued',
      progress: 0,
      current_step: 'Queued for retry',
      error_message: null
    });

    setImmediate(() => {
      this._processQueue().catch((err) => {
        console.error('Queue processing error:', err);
      });
    });

    return {
      buildId: build.id,
      buildNumber: build.build_number,
      status: 'queued',
      message: `Build #${build.build_number || build.id} has been queued for retry`
    };
  }

  async retryFailedBuilds() {
    // 1. Clean up stale failed builds where a newer build of the same template already exists
    db.prepare(`
      DELETE FROM builds
      WHERE status = 'failed'
        AND EXISTS (
          SELECT 1 FROM builds b2
          WHERE b2.template_name = builds.template_name
            AND b2.status IN ('queued', 'building', 'completed')
            AND b2.id > builds.id
        )
    `).run();

    // 2. Fetch all remaining failed builds
    const failedBuilds = db.prepare(`
      SELECT * FROM builds
      WHERE status = 'failed'
      ORDER BY id ASC
    `).all();

    if (failedBuilds.length === 0) {
      return { count: 0, message: 'No failed builds eligible for retry', builds: [] };
    }

    const retriedJobs = [];
    const skipped = [];

    const resetTx = db.transaction((items) => {
      for (const b of items) {
        const baseImage = db.prepare('SELECT id, name, status, file_path FROM base_images WHERE id = ?').get(b.base_image_id);
        if (!baseImage || baseImage.status !== 'ready' || !baseImage.file_path || !fs.existsSync(baseImage.file_path)) {
          skipped.push({
            template_name: b.template_name,
            reason: `Base image '${baseImage?.name || 'unknown'}' not ready`,
          });
          continue;
        }

        const workDir = path.join(SCRATCH_DIR, `build-${b.id}`);
        if (fs.existsSync(workDir)) {
          try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) {}
        }

        db.prepare(`
          UPDATE builds
          SET status = 'queued',
              progress = 0,
              current_step = 'Queued in retry pipeline',
              error_message = NULL,
              log = '',
              output_filename = NULL,
              output_path = NULL,
              output_size = 0,
              output_sha256 = NULL,
              completed_at = NULL
          WHERE id = ?
        `).run(b.id);

        this.broadcast(b.id, {
          type: 'status',
          status: 'queued',
          progress: 0,
          current_step: 'Queued in retry pipeline',
          error_message: null
        });

        retriedJobs.push({
          buildId: b.id,
          buildNumber: b.build_number,
          template_name: b.template_name,
          vmid: b.vmid,
        });
      }
    });

    resetTx(failedBuilds);

    if (retriedJobs.length > 0) {
      setImmediate(() => {
        this._processQueue().catch((err) => {
          console.error('Queue processing error:', err);
        });
      });
    }

    return {
      count: retriedJobs.length,
      skipped: skipped.length,
      message: `Successfully re-queued ${retriedJobs.length} failed build(s) for retry`,
      builds: retriedJobs,
    };
  }

  async _processQueue() {
    if (this.activeBuildId !== null) {
      return; // A build is currently running
    }

    const nextJob = db.prepare(`
      SELECT * FROM builds 
      WHERE status = 'queued'
      ORDER BY id ASC
      LIMIT 1
    `).get();

    if (!nextJob) {
      return; // No queued jobs remaining
    }

    this.activeBuildId = nextJob.id;
    this.updateStatus(nextJob.id, {
      status: 'building',
      progress: 5,
      current_step: 'Initializing build environment',
    });

    const baseImage = db.prepare('SELECT * FROM base_images WHERE id = ?').get(nextJob.base_image_id);
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(nextJob.profile_id);
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(nextJob.group_id);
    const tools = this.checkTools();

    try {
      await this._executePipeline(nextJob.id, {
        template_name: nextJob.template_name,
        vmid: nextJob.vmid,
        baseImage,
        profile,
        group,
        tools,
      });
    } catch (err) {
      this.appendLog(nextJob.id, `ERROR: ${err.message}`);
      this.updateStatus(nextJob.id, {
        status: 'failed',
        error_message: err.message,
        completed_at: new Date().toISOString(),
      });
    } finally {
      this.activeBuildId = null;
      // Continue to next queued job
      setTimeout(() => this._processQueue(), 500);
    }
  }

  cancelBuild(buildId) {
    const build = db.prepare('SELECT * FROM builds WHERE id = ?').get(buildId);
    if (!build) throw new Error('Build not found');

    if (build.status === 'queued') {
      db.prepare("UPDATE builds SET status = 'failed', current_step = 'Cancelled in queue', error_message = 'Cancelled by user', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(buildId);
      this.broadcast(buildId, { type: 'status', status: 'failed', current_step: 'Cancelled in queue' });
      return { success: true, message: 'Queued build cancelled' };
    }

    if (build.status === 'building') {
      this.updateStatus(buildId, {
        status: 'failed',
        current_step: 'Cancelled by user',
        error_message: 'Build cancelled by user',
        completed_at: new Date().toISOString(),
      });
      this.activeBuildId = null;
      setTimeout(() => this._processQueue(), 500);
      return { success: true, message: 'Active build stopped' };
    }

    return { success: false, message: `Build already finished with status: ${build.status}` };
  }

  async _executePipeline(buildId, ctx) {
    const { template_name, vmid, baseImage, profile, group, tools } = ctx;
    const osFamily = (profile.os_family || baseImage.os || '').toLowerCase();
    const baseOs = (baseImage.os || '').toLowerCase();
    const workDir = path.join(SCRATCH_DIR, `build-${buildId}`);

    try {
      if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
      fs.mkdirSync(workDir, { recursive: true });

      this.appendLog(buildId, `=== Starting Build #${buildId}: ${template_name} (VMID: ${vmid}) ===`);
      this.appendLog(buildId, `Base image: ${baseImage.name} (${baseImage.filename})`);
      this.appendLog(buildId, `Profile: ${profile.name} (Disk: ${profile.target_disk_size_gb}GB, Root SSH: ${profile.enable_root_ssh ? 'Yes' : 'No'})`);
      this.appendLog(buildId, `Group: ${group.name} (TZ: ${group.timezone}, Locale: ${group.locale})`);
      this.appendLog(buildId, `Tools detected: ${Object.entries(tools).filter(([k, v]) => v && k !== 'kvm').map(([k]) => k).join(', ') || 'None (Fallback mode)'}`);
      this.appendLog(buildId, `Virtualization mode: ${tools.kvm ? 'KVM Hardware Acceleration (/dev/kvm active)' : 'Software TCG Emulation (Safe for VM / Nested environments)'}`);

      // Step 1: Copy base image to work directory
      this.updateStatus(buildId, { progress: 15, current_step: 'Copying base image' });
      this.appendLog(buildId, `Copying base image to work workspace...`);
      const diskPath = path.join(workDir, 'disk.qcow2');
      await fs.promises.copyFile(baseImage.file_path, diskPath);
      this.appendLog(buildId, `Base image copied successfully.`);

      // Step 2: Resize disk if needed
      let actualDiskSizeGb = profile.target_disk_size_gb || 5;
      if (tools['qemu-img']) {
        try {
          const infoRes = await runCommand('qemu-img', ['info', '--output=json', diskPath]);
          const imgInfo = JSON.parse(infoRes.stdout);
          const currentVirtualBytes = Number(imgInfo['virtual-size']) || 0;
          const currentVirtualGb = currentVirtualBytes / (1024 * 1024 * 1024);
          const targetGb = profile.target_disk_size_gb ? Number(profile.target_disk_size_gb) : 0;

          if (targetGb > 0 && targetGb * 1024 * 1024 * 1024 > currentVirtualBytes) {
            this.updateStatus(buildId, { progress: 30, current_step: 'Resizing disk image' });
            this.appendLog(buildId, `Expanding disk from ${currentVirtualGb.toFixed(1)}GB to ${targetGb}GB...`);
            await runCommand('qemu-img', ['resize', diskPath, `${targetGb}G`]);
            actualDiskSizeGb = targetGb;
            this.appendLog(buildId, `Disk expanded successfully to ${actualDiskSizeGb}GB.`);
          } else {
            actualDiskSizeGb = Math.max(targetGb, Math.ceil(currentVirtualGb));
            this.appendLog(
              buildId,
              `Disk virtual size is ${currentVirtualGb.toFixed(1)}GB (profile target: ${targetGb || 'not set'}GB). ` +
              (targetGb > 0 && targetGb < currentVirtualGb
                ? `Skipping shrink to prevent filesystem truncation and partition corruption. Preserving ${actualDiskSizeGb}GB.`
                : `No expansion needed.`)
            );
          }
        } catch (imgErr) {
          this.appendLog(buildId, `Warning: Could not inspect or resize disk: ${imgErr.message}`);
        }
      }

      // Step 3: Apply OS Customizations
      this.updateStatus(buildId, { progress: 45, current_step: 'Applying OS customizations' });
      this.appendLog(buildId, `Applying OS modifications for PUQ WHMCS Proxmox template...`);

      if (tools['virt-customize']) {
        const customizeArgs = [
          '-a', diskPath,
          '--root-password', `password:${profile.root_password || 'puqcloud'}`,
          '--run-command', 'passwd -u root 2>/dev/null || true',
          '--run-command', 'usermod -U root 2>/dev/null || true',
          '--timezone', group.timezone || 'Europe/Warsaw',
        ];

        // Regional Package Mirror Configuration (per-distribution)
        let packageMirrors = {};
        try {
          packageMirrors = group.package_mirrors ? (typeof group.package_mirrors === 'string' ? JSON.parse(group.package_mirrors) : group.package_mirrors) : {};
        } catch (_) {
          packageMirrors = {};
        }

        let mirrorUrl = '';
        if (osFamily === 'debian' || baseOs === 'debian') {
          mirrorUrl = packageMirrors.debian || group.apt_mirror || '';
        } else if (osFamily === 'ubuntu' || baseOs === 'ubuntu') {
          mirrorUrl = packageMirrors.ubuntu || group.apt_mirror || '';
        } else if (osFamily === 'rhel' || ['almalinux', 'rocky', 'centos', 'fedora'].includes(baseOs)) {
          mirrorUrl = packageMirrors.rhel || '';
        } else if (osFamily === 'alpine' || baseOs === 'alpine') {
          mirrorUrl = packageMirrors.alpine || '';
        } else if (osFamily === 'archlinux' || baseOs === 'archlinux') {
          mirrorUrl = packageMirrors.archlinux || '';
        } else if (osFamily === 'opensuse' || baseOs === 'opensuse') {
          mirrorUrl = packageMirrors.opensuse || '';
        }
        mirrorUrl = (mirrorUrl || '').trim();

        if (mirrorUrl) {
          const cleanMirror = mirrorUrl.replace(/\/+$/, '');
          const targetDistroName = osFamily || baseOs || 'Linux';

          this.appendLog(buildId, `Pre-flight check: Verifying reachability of regional ${targetDistroName} mirror: ${cleanMirror}...`);
          const check = await checkMirrorReachability(cleanMirror, 7000);
          if (!check.ok) {
            const mirrorErrMsg = `Regional mirror for ${targetDistroName} is unreachable (${check.error}): ${cleanMirror}`;
            this.appendLog(buildId, `[CRITICAL ERROR] ${mirrorErrMsg}`);
            this.appendLog(buildId, `Build aborted to prevent generating an unbootable or broken VM template.`);
            this.appendLog(buildId, `Tip: Verify the repository URL in Regional & Localization Standards or leave it blank to use official upstream defaults.`);
            throw new Error(mirrorErrMsg);
          }
          this.appendLog(buildId, `Pre-flight check passed: Mirror is reachable (${check.status || 200}, ${check.latencyMs}ms). Applying repository configuration...`);

          if (osFamily === 'debian' || baseOs === 'debian') {
            this.appendLog(buildId, `Configuring regional Debian package mirror: ${cleanMirror}`);
            customizeArgs.push(
              '--run-command', `sed -i -E "s|https?://[a-zA-Z0-9.-]+/debian|${cleanMirror}|g" /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true`
            );
            const cloudAptCfg = `apt:\n  primary:\n    - uri: ${cleanMirror}\n`;
            const cloudAptFile = path.join(workDir, '01-pve-apt-mirror.cfg');
            fs.writeFileSync(cloudAptFile, cloudAptCfg);
            customizeArgs.push(
              '--run-command', 'mkdir -p /etc/cloud/cloud.cfg.d',
              '--upload', `${cloudAptFile}:/etc/cloud/cloud.cfg.d/01-pve-apt-mirror.cfg`,
              '--run-command', 'chmod 644 /etc/cloud/cloud.cfg.d/01-pve-apt-mirror.cfg'
            );
          } else if (osFamily === 'ubuntu' || baseOs === 'ubuntu') {
            this.appendLog(buildId, `Configuring regional Ubuntu package mirror: ${cleanMirror}`);
            customizeArgs.push(
              '--run-command', `sed -i -E "s|https?://([a-zA-Z0-9.-]+\\.)?archive\\.ubuntu\\.com/ubuntu|${cleanMirror}|g" /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true`
            );
            const cloudUbuntuCfg = `apt:\n  primary:\n    - uri: ${cleanMirror}\n`;
            const cloudUbuntuFile = path.join(workDir, '01-pve-apt-mirror.cfg');
            fs.writeFileSync(cloudUbuntuFile, cloudUbuntuCfg);
            customizeArgs.push(
              '--run-command', 'mkdir -p /etc/cloud/cloud.cfg.d',
              '--upload', `${cloudUbuntuFile}:/etc/cloud/cloud.cfg.d/01-pve-apt-mirror.cfg`,
              '--run-command', 'chmod 644 /etc/cloud/cloud.cfg.d/01-pve-apt-mirror.cfg'
            );
          } else if (osFamily === 'rhel' || ['almalinux', 'rocky', 'centos', 'fedora'].includes(baseOs)) {
            this.appendLog(buildId, `Configuring regional Enterprise Linux package mirror: ${cleanMirror}`);
            customizeArgs.push(
              '--run-command', `sed -i "s|^mirrorlist=|#mirrorlist=|g" /etc/yum.repos.d/*.repo 2>/dev/null || true`,
              '--run-command', `sed -i "s|^metalink=|#metalink=|g" /etc/yum.repos.d/*.repo 2>/dev/null || true`,
              '--run-command', `sed -i "s|^#baseurl=|baseurl=|g" /etc/yum.repos.d/*.repo 2>/dev/null || true`,
              '--run-command', `sed -i -E "s|https?://repo\\.almalinux\\.org/almalinux|${cleanMirror}|g" /etc/yum.repos.d/*.repo 2>/dev/null || true`,
              '--run-command', `sed -i -E "s|https?://dl\\.rockylinux\\.org/pub/rocky|${cleanMirror}|g" /etc/yum.repos.d/*.repo 2>/dev/null || true`,
              '--run-command', `sed -i -E "s|https?://mirror\\.centos\\.org|${cleanMirror}|g" /etc/yum.repos.d/*.repo 2>/dev/null || true`,
              '--run-command', `sed -i -E "s|https?://download\\.fedoraproject\\.org/pub/fedora/linux|${cleanMirror}|g" /etc/yum.repos.d/*.repo 2>/dev/null || true`
            );
          } else if (osFamily === 'alpine' || baseOs === 'alpine') {
            this.appendLog(buildId, `Configuring regional Alpine package mirror: ${cleanMirror}`);
            customizeArgs.push(
              '--run-command', `sed -i -E "s|https?://[^/]+/alpine|${cleanMirror}|g" /etc/apk/repositories 2>/dev/null || true`
            );
          } else if (osFamily === 'archlinux' || baseOs === 'archlinux') {
            this.appendLog(buildId, `Configuring regional Arch Linux package mirror: ${cleanMirror}`);
            let serverLine = cleanMirror;
            if (!serverLine.includes('$repo')) {
              serverLine = `${cleanMirror}/$repo/os/$arch`;
            }
            customizeArgs.push(
              '--run-command', `sed -i "1i Server = ${serverLine}" /etc/pacman.d/mirrorlist 2>/dev/null || true`
            );
          } else if (osFamily === 'opensuse' || baseOs === 'opensuse') {
            this.appendLog(buildId, `Configuring regional openSUSE package mirror: ${cleanMirror}`);
            customizeArgs.push(
              '--run-command', `sed -i -E "s|https?://download\\.opensuse\\.org|${cleanMirror}|g" /etc/zypp/repos.d/*.repo 2>/dev/null || true`
            );
          }
        }

        // QEMU Guest Agent installation & enablement
        if (profile.install_guest_agent) {
          customizeArgs.push(
            '--run-command',
            'which qemu-ga 2>/dev/null || (apt-get update && apt-get install -y qemu-guest-agent 2>/dev/null) || (dnf install -y qemu-guest-agent 2>/dev/null) || (zypper --non-interactive --no-refresh install qemu-guest-agent 2>/dev/null) || (pacman -Sy --noconfirm qemu-guest-agent 2>/dev/null) || (apk add --no-cache qemu-guest-agent 2>/dev/null) || true',
            '--run-command',
            'systemctl enable qemu-guest-agent 2>/dev/null || rc-update add qemu-guest-agent default 2>/dev/null || true'
          );
        }

        // SSH settings - in /etc/ssh/sshd_config.d/00-pve-sshd.conf + main sshd_config + remove cloud-init overrides
        const sshLines = [
          '# Proxmox OS Template Builder - OpenSSH Overrides',
          profile.enable_root_ssh ? 'PermitRootLogin yes' : 'PermitRootLogin no',
          profile.password_auth ? 'PasswordAuthentication yes' : 'PasswordAuthentication no',
          profile.password_auth ? 'KbdInteractiveAuthentication yes' : 'KbdInteractiveAuthentication no',
          'PubkeyAuthentication yes',
        ];
        if (profile.ssh_custom_port && profile.ssh_custom_port !== 22) {
          sshLines.push(`Port ${profile.ssh_custom_port}`);
        }

        const sshDropinFile = path.join(workDir, '00-pve-sshd.conf');
        fs.writeFileSync(sshDropinFile, sshLines.join('\n') + '\n');
        customizeArgs.push(
          '--run-command', 'mkdir -p /etc/ssh/sshd_config.d',
          // Upload as 00-pve-sshd.conf so OpenSSH loads it first before any cloud-init drop-ins
          '--upload', `${sshDropinFile}:/etc/ssh/sshd_config.d/00-pve-sshd.conf`,
          '--run-command', 'chmod 644 /etc/ssh/sshd_config.d/00-pve-sshd.conf',
          // Remove cloud-init SSH override snippet that enforces 'PasswordAuthentication no'
          '--run-command', 'rm -f /etc/ssh/sshd_config.d/50-cloud-init.conf /etc/ssh/sshd_config.d/*cloud-init*.conf 2>/dev/null || true',
          // Also patch main sshd_config for Linux distributions that do not evaluate sshd_config.d
          '--run-command', `sed -i "s/#*PermitRootLogin.*/PermitRootLogin ${profile.enable_root_ssh ? 'yes' : 'no'}/g" /etc/ssh/sshd_config 2>/dev/null || true`,
          '--run-command', `sed -i "s/#*PasswordAuthentication.*/PasswordAuthentication ${profile.password_auth ? 'yes' : 'no'}/g" /etc/ssh/sshd_config 2>/dev/null || true`,
          '--run-command', `sed -i "s/#*KbdInteractiveAuthentication.*/KbdInteractiveAuthentication ${profile.password_auth ? 'yes' : 'no'}/g" /etc/ssh/sshd_config 2>/dev/null || true`
        );

        if (profile.ssh_custom_port && profile.ssh_custom_port !== 22) {
          customizeArgs.push(
            '--run-command',
            `sed -i "s/#*Port .*/Port ${profile.ssh_custom_port}/g" /etc/ssh/sshd_config 2>/dev/null || true`
          );
        }

        // Cloud-Init integration: Comprehensive configuration for Proxmox VE NoCloud / ConfigDrive
        customizeArgs.push(
          '--run-command',
          'which cloud-init 2>/dev/null || (apt-get update && apt-get install -y cloud-init 2>/dev/null) || (dnf install -y cloud-init 2>/dev/null) || (zypper --non-interactive --no-refresh install cloud-init 2>/dev/null) || (pacman -Sy --noconfirm cloud-init 2>/dev/null) || (apk add --no-cache cloud-init 2>/dev/null) || true'
        );

        // Upload /etc/cloud/ds-identify.cfg to prevent ds-identify from disabling cloud-init before virtual CD-ROM drive is ready
        const dsIdentifyLines = [
          '# Proxmox VE early-boot datasource identification policy',
          'policy: search,found=all,maybe=all,notfound=enabled',
        ];
        const dsIdentifyFile = path.join(workDir, 'ds-identify.cfg');
        fs.writeFileSync(dsIdentifyFile, dsIdentifyLines.join('\n') + '\n');
        customizeArgs.push(
          '--run-command', 'mkdir -p /etc/cloud',
          '--upload', `${dsIdentifyFile}:/etc/cloud/ds-identify.cfg`,
          '--run-command', 'chmod 644 /etc/cloud/ds-identify.cfg'
        );

        // Upload 99-pve.cfg to enforce NoCloud/ConfigDrive, NetworkManager keyfile renderer, and password auth
        const cloudPveCfg = [
          '# Proxmox VE Cloud-Init Universal Configuration (PUQ WHMCS)',
          'datasource_list: [ NoCloud, ConfigDrive, None ]',
          'datasource:',
          '  NoCloud:',
          '    fs_label: cidata',
          '  ConfigDrive:',
          '    fs_label: config-2',
          'system_info:',
          '  default_user:',
          '    lock_passwd: false',
          '  network:',
          '    renderers: [network-manager, netplan, networkd, sysconfig, eni]',
          `disable_root: ${profile.enable_root_ssh ? 'false' : 'true'}`,
          `ssh_pwauth: ${profile.password_auth ? 'true' : 'false'}`,
          'chpasswd:',
          '  expire: false',
        ];
        const cloudPveFile = path.join(workDir, '99-pve.cfg');
        fs.writeFileSync(cloudPveFile, cloudPveCfg.join('\n') + '\n');
        customizeArgs.push(
          '--run-command', 'mkdir -p /etc/cloud/cloud.cfg.d',
          '--upload', `${cloudPveFile}:/etc/cloud/cloud.cfg.d/99-pve.cfg`,
          '--run-command', 'chmod 644 /etc/cloud/cloud.cfg.d/99-pve.cfg',
          '--run-command', `sed -i "s/disable_root:.*/disable_root: ${profile.enable_root_ssh ? 'false' : 'true'}/g" /etc/cloud/cloud.cfg 2>/dev/null || true`,
          '--run-command', `sed -i "s/ssh_pwauth:.*/ssh_pwauth: ${profile.password_auth ? 'true' : 'false'}/g" /etc/cloud/cloud.cfg 2>/dev/null || true`,
          '--run-command', 'sed -i "s/lock_passwd:.*/lock_passwd: false/g" /etc/cloud/cloud.cfg 2>/dev/null || true',
          '--run-command', 'sed -i "s/lock_passwd:.*/lock_passwd: false/g" /etc/cloud/cloud.cfg.d/*.cfg 2>/dev/null || true'
        );

        // Enable all Cloud-Init systemd units, multi-user.target static symlink, and NetworkManager
        customizeArgs.push(
          '--run-command',
          'systemctl enable cloud-init-local.service cloud-init.service cloud-init-main.service cloud-init-network.service cloud-config.service cloud-final.service cloud-init.target 2>/dev/null || true',
          '--run-command',
          'mkdir -p /etc/systemd/system/multi-user.target.wants /etc/systemd/system/cloud-init.target.wants 2>/dev/null || true',
          '--run-command',
          '( [ -f /usr/lib/systemd/system/cloud-init.target ] && ln -sf /usr/lib/systemd/system/cloud-init.target /etc/systemd/system/multi-user.target.wants/cloud-init.target ) || ( [ -f /lib/systemd/system/cloud-init.target ] && ln -sf /lib/systemd/system/cloud-init.target /etc/systemd/system/multi-user.target.wants/cloud-init.target ) || true',
          '--run-command',
          'systemctl enable NetworkManager.service 2>/dev/null || true',
          '--run-command',
          'rc-update add cloud-init-local boot 2>/dev/null || true',
          '--run-command',
          'rc-update add cloud-init default 2>/dev/null || true',
          '--run-command',
          'rc-update add cloud-config default 2>/dev/null || true',
          '--run-command',
          'rc-update add cloud-final default 2>/dev/null || true'
        );

        // Provider SSH Key injection
        if (profile.provider_ssh_key && profile.provider_ssh_key.trim()) {
          const sshKeyFile = path.join(workDir, 'provider_key.pub');
          fs.writeFileSync(sshKeyFile, profile.provider_ssh_key.trim() + '\n');
          customizeArgs.push(
            '--run-command', 'mkdir -p /root/.ssh && chmod 700 /root/.ssh',
            '--upload', `${sshKeyFile}:/root/.ssh/authorized_keys`,
            '--run-command', 'chmod 600 /root/.ssh/authorized_keys'
          );
        }

        // Disable password expiration
        if (profile.disable_password_expiry) {
          customizeArgs.push('--run-command', 'chage -I -1 -m 0 -M 99999 -E -1 root 2>/dev/null || true');
        }

        // Sysctl kernel and network tuning
        const sysctlLines = [];
        if (profile.sysctl_tcp_bbr) {
          sysctlLines.push('net.core.default_qdisc = fq', 'net.ipv4.tcp_congestion_control = bbr');
        }
        if (profile.sysctl_file_limits) {
          sysctlLines.push('fs.file-max = 2097152', 'fs.inotify.max_user_watches = 524288');
        }
        if (profile.sysctl_swappiness) {
          sysctlLines.push('vm.swappiness = 10');
        }
        if (profile.sysctl_syn_flood) {
          sysctlLines.push('net.ipv4.tcp_syncookies = 1', 'net.ipv4.tcp_max_syn_backlog = 8192');
        }
        if (profile.disable_ipv6) {
          sysctlLines.push(
            'net.ipv6.conf.all.disable_ipv6 = 1',
            'net.ipv6.conf.default.disable_ipv6 = 1',
            'net.ipv6.conf.lo.disable_ipv6 = 1'
          );
        }
        if (sysctlLines.length > 0) {
          const sysctlFile = path.join(workDir, '99-puq-tuning.conf');
          fs.writeFileSync(sysctlFile, sysctlLines.join('\n') + '\n');
          customizeArgs.push(
            '--run-command', 'mkdir -p /etc/sysctl.d',
            '--upload', `${sysctlFile}:/etc/sysctl.d/99-puq-tuning.conf`
          );
        }

        // High file descriptor limits
        if (profile.sysctl_file_limits) {
          const limitsFile = path.join(workDir, '99-puq-limits.conf');
          fs.writeFileSync(limitsFile, '* soft nofile 65536\n* hard nofile 65536\nroot soft nofile 65536\nroot hard nofile 65536\n');
          customizeArgs.push(
            '--run-command', 'mkdir -p /etc/security/limits.d',
            '--upload', `${limitsFile}:/etc/security/limits.d/99-puq-limits.conf`
          );
        }

        // Auto security updates
        if (profile.auto_security_updates) {
          customizeArgs.push('--run-command', 'apt-get update && apt-get install -y unattended-upgrades 2>/dev/null || dnf install -y dnf-automatic 2>/dev/null || true');
        }

        // Fail2ban
        if (profile.enable_fail2ban) {
          customizeArgs.push(
            '--run-command', 'apt-get update && apt-get install -y fail2ban 2>/dev/null || dnf install -y fail2ban 2>/dev/null || zypper --non-interactive --no-refresh install fail2ban 2>/dev/null || pacman -Sy --noconfirm fail2ban 2>/dev/null || true',
            '--run-command', 'systemctl enable fail2ban 2>/dev/null || true'
          );
        }

        // Clean machine id and SSH host keys
        if (profile.reset_machine_id) {
          customizeArgs.push('--touch', '/etc/machine-id');
          customizeArgs.push('--truncate', '/etc/machine-id');
          customizeArgs.push('--run-command', 'rm -f /var/lib/dbus/machine-id && ln -sf /etc/machine-id /var/lib/dbus/machine-id || true');
        }

        if (profile.clean_ssh_host_keys) {
          customizeArgs.push('--run-command', 'rm -f /etc/ssh/ssh_host_*');
        }

        // Clean cloud-init state and purge cached vendor machine markers for pure first-boot
        customizeArgs.push(
          '--run-command', 'cloud-init clean --logs --seed 2>/dev/null || true',
          '--run-command', 'rm -rf /var/lib/cloud/instances/* /var/lib/cloud/instance /var/lib/cloud/data/* /var/lib/cloud/seed/* /var/lib/cloud/sem/* 2>/dev/null || true',
          '--run-command', 'rm -f /etc/cloud/cloud-init.disabled /run/cloud-init/disabled /var/lib/cloud/instance/manual-clean 2>/dev/null || true',
          '--run-command', 'rm -f /etc/NetworkManager/system-connections/eth0.nmconnection /etc/NetworkManager/system-connections/cloud-init* 2>/dev/null || true',
          '--run-command', 'rm -f /etc/sysconfig/network-scripts/ifcfg-eth0 /etc/sysconfig/network-scripts/ifcfg-ens* 2>/dev/null || true'
        );

        // Remove default users
        if (profile.remove_default_users) {
          customizeArgs.push(
            '--run-command', 'userdel -r ubuntu 2>/dev/null || true',
            '--run-command', 'userdel -r debian 2>/dev/null || true',
            '--run-command', 'userdel -r centos 2>/dev/null || true',
            '--run-command', 'userdel -r rocky 2>/dev/null || true',
            '--run-command', 'userdel -r almalinux 2>/dev/null || true'
          );
        }

        // Custom script
        if (profile.custom_script && profile.custom_script.trim()) {
          const scriptFile = path.join(workDir, 'custom_script.sh');
          fs.writeFileSync(scriptFile, profile.custom_script);
          customizeArgs.push('--run', scriptFile);
        }

        // Relabel SELinux contexts and ensure permissive mode for RHEL/CentOS/Alma/Rocky/Fedora guests to ensure cloud-init & systemd services boot cleanly
        if (osFamily === 'rhel' || ['almalinux', 'rocky', 'centos', 'fedora'].includes(baseOs)) {
          customizeArgs.push(
            '--run-command', 'sed -i "s/^SELINUX=.*/SELINUX=permissive/g" /etc/selinux/config 2>/dev/null || true',
            '--touch', '/.autorelabel',
            '--selinux-relabel'
          );
        }

        this.appendLog(buildId, `Running virt-customize inside guest OS filesystem...`);
        try {
          await runCommand('virt-customize', customizeArgs, {
            env: { ...process.env, LIBGUESTFS_BACKEND: 'direct' },
            onLine: (line) => this.appendLog(buildId, `[virt-customize] ${line}`)
          });
          this.appendLog(buildId, `virt-customize completed successfully.`);
        } catch (err) {
          const errMsg = err.stderr || err.stdout || err.message;
          this.appendLog(buildId, `ERROR in virt-customize: ${errMsg}`);
          throw new Error(`virt-customize failed: ${errMsg}`);
        }
      } else {
        this.appendLog(buildId, `Note: virt-customize not found in host environment. (Pre-configured stock image used)`);
      }

      // Step 4: Convert to target disk format (raw, qcow2, vmdk)
      const validDiskFormats = ['raw', 'qcow2', 'vmdk'];
      const targetDiskFormat = validDiskFormats.includes(profile.disk_format) ? profile.disk_format : 'raw';
      const diskFilename = `disk.${targetDiskFormat}`;
      const convertedDiskPath = path.join(workDir, diskFilename);

      this.updateStatus(buildId, { progress: 65, current_step: `Converting disk to ${targetDiskFormat.toUpperCase()} format` });
      if (tools['qemu-img']) {
        this.appendLog(buildId, `Converting disk to ${targetDiskFormat.toUpperCase()} format for Proxmox VMA archive...`);
        if (diskPath === convertedDiskPath) {
          // Prevent QEMU file write lock collision when input and output paths are identical (e.g. disk.qcow2 -> disk.qcow2)
          const tempDiskPath = path.join(workDir, `disk.tmp.${targetDiskFormat}`);
          await runCommand('qemu-img', ['convert', '-f', 'qcow2', '-O', targetDiskFormat, diskPath, tempDiskPath]);
          fs.unlinkSync(diskPath);
          fs.renameSync(tempDiskPath, convertedDiskPath);
        } else {
          await runCommand('qemu-img', ['convert', '-f', 'qcow2', '-O', targetDiskFormat, diskPath, convertedDiskPath]);
        }
        this.appendLog(buildId, `Disk converted to ${targetDiskFormat.toUpperCase()} format.`);
      } else {
        if (diskPath !== convertedDiskPath) {
          fs.copyFileSync(diskPath, convertedDiskPath);
        }
      }

      // Step 5: Generate qemu-server.conf
      this.updateStatus(buildId, { progress: 75, current_step: 'Generating Proxmox VM configuration' });
      const netQueues = profile.qemu_net_queues > 0 ? `,queues=${profile.qemu_net_queues}` : '';
      const discardOpt = profile.qemu_discard !== 0 ? ',discard=on' : '';
      const ssdOpt = profile.qemu_ssd !== 0 ? ',ssd=1' : '';
      const aioOpt = profile.qemu_async_io ? `,aio=${profile.qemu_async_io}` : ',aio=io_uring';
      const cacheOpt = profile.qemu_disk_cache ? `,cache=${profile.qemu_disk_cache}` : ',cache=none';

      // Generate detailed template notes for VM description and Proxmox .notes files
      const initialNotes = this.generateNotes({ template_name, vmid, baseImage, profile, group, actualDiskSizeGb });

      // Validate CPU compatibility for EL9 and EL10 (AlmaLinux, Rocky, CentOS, RHEL, Fedora)
      const isRhelFamily = osFamily === 'rhel' || ['almalinux', 'rocky', 'centos', 'fedora'].includes(baseOs);
      const osVerNum = parseInt(baseImage.version, 10) || 0;
      let effectiveCpuType = profile.qemu_cpu_type || 'host';

      if (isRhelFamily && osVerNum >= 9 && (effectiveCpuType === 'kvm64' || effectiveCpuType === 'qemu64')) {
        this.appendLog(buildId, `[WARNING] CPU type '${effectiveCpuType}' lacks mandatory x86-64-v2 microarchitecture required by ${baseImage.name}. Overriding to 'host' to prevent fatal glibc illegal instruction / reboot loop.`);
        effectiveCpuType = 'host';
      } else if (isRhelFamily && osVerNum >= 10 && effectiveCpuType === 'x86-64-v2-AES') {
        this.appendLog(buildId, `[WARNING] CPU type '${effectiveCpuType}' lacks mandatory x86-64-v3 microarchitecture required by ${baseImage.name}. Overriding to 'host' to prevent boot loop.`);
        effectiveCpuType = 'host';
      }

      // Memory safeguard for modern enterprise Linux guests
      let effectiveMemory = profile.qemu_memory || 1024;
      if (isRhelFamily && osVerNum >= 9 && effectiveMemory < 2048) {
        this.appendLog(buildId, `[INFO] Adjusting template memory for ${baseImage.name} from ${effectiveMemory}MB to 2048MB to satisfy enterprise Linux minimum RAM requirements and prevent kdump OOM panics.`);
        effectiveMemory = 2048;
      }

      // Storage volume naming and mapping based on target format
      const targetStorage = targetDiskFormat === 'raw' ? 'local-lvm' : 'local';
      const diskVol = targetDiskFormat === 'raw'
        ? `local-lvm:vm-${vmid}-disk-0`
        : `local:vm-${vmid}-disk-0.${targetDiskFormat}`;

      // CD-ROM drive and Cloud-Init drive slot allocation
      const cdromSetting = profile.qemu_cdrom || 'none';
      let cloudInitDevice = 'ide2';

      const vmConfLines = [
        `# Proxmox VM Configuration generated by pve-os-builder`,
        `agent: ${profile.install_guest_agent ? 1 : 0}`,
        `bios: ${profile.qemu_bios || 'seabios'}`,
        `boot: order=scsi0`,
        `cores: ${profile.qemu_cores || 1}`,
        `cpu: ${effectiveCpuType}`,
        `description: ${encodeURIComponent(initialNotes)}`,
      ];

      // Add ordinary CD-ROM drive if enabled
      if (cdromSetting && cdromSetting !== 'none') {
        vmConfLines.push(`${cdromSetting}: none,media=cdrom`);
        if (cdromSetting === 'ide2') {
          // If CD-ROM occupies ide2, shift cloudinit drive to ide0
          cloudInitDevice = 'ide0';
        }
      }

      // Add Cloud-Init drive if enabled
      if (profile.install_cloud_init) {
        vmConfLines.push(`${cloudInitDevice}: local-lvm:vm-${vmid}-cloudinit,media=cdrom`);
      }

      vmConfLines.push(
        `machine: ${profile.qemu_machine === 'q35' ? 'q35' : 'pc'}`,
        `memory: ${effectiveMemory}`,
        `name: ${template_name}`,
        `net0: ${profile.qemu_net_model || 'virtio'}=00:00:00:00:00:00,bridge=vmbr0,firewall=${profile.qemu_firewall !== 0 ? 1 : 0}${netQueues}`,
        `numa: 0`,
        `ostype: l26`,
        `scsi0: ${diskVol}${cacheOpt}${aioOpt}${discardOpt}${ssdOpt},size=${actualDiskSizeGb}G`,
        `scsihw: ${profile.qemu_scsihw || 'virtio-scsi-single'}`,
        `serial0: socket`,
        `smbios1: uuid=${crypto.randomUUID()}`,
        `sockets: 1`,
        `template: 1`,
        `vga: ${profile.qemu_vga || 'std'}`
      );

      if (profile.qemu_watchdog) {
        vmConfLines.push('watchdog: model=i6300esb,action=reset');
      }

      // Proxmox VZDump device mapping hint (required by Proxmox qmrestore / vma extract)
      vmConfLines.push(`#qmdump#map:scsi0:drive-scsi0:${targetStorage}:${targetDiskFormat}:`);

      const vmConf = vmConfLines.join('\n') + '\n';
      const confPath = path.join(workDir, 'qemu-server.conf');
      fs.writeFileSync(confPath, vmConf);
      this.appendLog(buildId, `Generated qemu-server.conf.`);

      // Step 6: Package into Proxmox .vma.zst
      this.updateStatus(buildId, { progress: 85, current_step: 'Packaging Proxmox .vma.zst archive' });
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '_').substring(0, 19);
      const outFilename = `vzdump-qemu-${vmid}-${timestamp}.vma.zst`;
      const outPath = path.join(OUTPUT_DIR, outFilename);
      const tempOutPath = path.join(workDir, outFilename);

      this.appendLog(buildId, `Packaging into ${outFilename}...`);

      if (tools['vma'] && tools['zstd']) {
        this.appendLog(buildId, `Creating Proxmox VMA archive with vma create...`);
        const tempVmaPath = path.join(workDir, `archive.vma`);
        await runCommand('vma', ['create', tempVmaPath, '-c', confPath, '-d', `format=${targetDiskFormat}:drive-scsi0=${convertedDiskPath}`]);
        this.appendLog(buildId, `Compressing VMA archive with zstd (-T0 -1)...`);
        await runCommand('zstd', ['-T0', '-1', '--rm', tempVmaPath, '-o', tempOutPath]);
      } else if (tools['zstd']) {
        // Fallback archive creation if vma is not installed on host machine yet
        this.appendLog(buildId, `Creating Proxmox template tar.zst container...`);
        const tarPath = path.join(workDir, 'archive.tar');
        await runCommand('tar', ['-cf', tarPath, '-C', workDir, 'qemu-server.conf', diskFilename]);
        await runCommand('zstd', ['-T0', '-1', tarPath, '-o', tempOutPath]);
      } else {
        // Simple gzip fallback
        this.appendLog(buildId, `Creating compressed template archive...`);
        await runCommand('tar', ['-czf', tempOutPath, '-C', workDir, 'qemu-server.conf', diskFilename]);
      }

      // Ensure Proxmox NFS dump directory exists as a real directory
      const dumpDir = path.join(OUTPUT_DIR, 'dump');
      if (fs.existsSync(dumpDir)) {
        try {
          const st = fs.lstatSync(dumpDir);
          if (st.isSymbolicLink()) {
            fs.unlinkSync(dumpDir);
            fs.mkdirSync(dumpDir, { recursive: true });
          }
        } catch (_) {}
      } else {
        fs.mkdirSync(dumpDir, { recursive: true });
      }
      const dumpPath = path.join(dumpDir, outFilename);

      // Move to dump directory (support cross-volume mounts)
      try {
        fs.renameSync(tempOutPath, dumpPath);
      } catch (err) {
        if (err.code === 'EXDEV') {
          fs.copyFileSync(tempOutPath, dumpPath);
          fs.unlinkSync(tempOutPath);
        } else {
          throw err;
        }
      }

      // Mirror in root OUTPUT_DIR for legacy/direct HTTP downloads
      try {
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
        fs.linkSync(dumpPath, outPath);
      } catch (_) {
        try {
          fs.symlinkSync(path.join('dump', outFilename), outPath);
        } catch (_) {}
      }

      const stats = fs.statSync(dumpPath);

      // Compute sha256
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(outPath);
      for await (const chunk of stream) hash.update(chunk);
      const sha256 = hash.digest('hex');

      // Generate and persist comprehensive Proxmox companion .notes metadata files
      const finalNotes = this.generateNotes({
        template_name,
        vmid,
        baseImage,
        profile,
        group,
        sha256,
        actualDiskSizeGb,
      });
      this.saveNotesFiles({
        dumpDir,
        outputDir: OUTPUT_DIR,
        outFilename,
        notesContent: finalNotes,
      });

      // Cleanup scratch directory
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch (_) {}

      this.appendLog(buildId, `SUCCESS: Template built and saved to ${outPath}`);
      this.appendLog(buildId, `File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
      this.appendLog(buildId, `SHA-256: ${sha256}`);

      this.updateStatus(buildId, {
        status: 'completed',
        progress: 100,
        current_step: 'Completed',
        output_filename: outFilename,
        output_path: outPath,
        output_size: stats.size,
        output_sha256: sha256,
        completed_at: new Date().toISOString(),
      });
    } catch (err) {
      if (fs.existsSync(workDir)) {
        try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (_) {}
      }
      throw err;
    }
  }

  generateNotes(ctx) {
    const { template_name, vmid, baseImage, profile, group, sha256, actualDiskSizeGb } = ctx;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Format concise OS Name & Version for line 1 display in Proxmox VE Backups table
    let osTitle = `${baseImage?.os || 'Linux'} ${baseImage?.version || ''}`.trim();
    if (baseImage?.name) {
      const cleaned = baseImage.name
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s+(GenericCloud|Cloud Base|Cloud Image|Cloud).*$/i, '')
        .trim();
      if (cleaned) osTitle = cleaned;
    }
    const groupTitle = group?.name || 'Global Standard (UTC)';
    const firstLine = `${osTitle} | ${groupTitle}`;

    const guestAgent = profile?.install_guest_agent ? 'Installed & Enabled' : 'Disabled';
    const cloudInit = profile?.optimize_cloud_init_sources ? 'Enabled (Fast NoCloud / ConfigDrive)' : 'Enabled';
    const rootSsh = profile?.enable_root_ssh ? 'Permitted' : 'Disabled';
    const passAuth = profile?.password_auth ? 'Enabled' : 'Disabled';
    const sshPort = profile?.ssh_custom_port || 22;
    const vga = profile?.qemu_vga || 'std';
    const netQueues = profile?.qemu_net_queues > 0 ? `, Queues: ${profile.qemu_net_queues}` : '';
    const firewall = profile?.qemu_firewall !== 0 ? 'Enabled' : 'Disabled';
    const discard = profile?.qemu_discard !== 0 ? 'Enabled' : 'Disabled';
    const ssd = profile?.qemu_ssd !== 0 ? 'Enabled' : 'Disabled';
    const aio = profile?.qemu_async_io || 'io_uring';
    const cache = profile?.qemu_disk_cache || 'none';

    const targetDiskFormat = (profile?.disk_format || 'raw').toUpperCase();
    const cdromStatus = profile?.qemu_cdrom && profile?.qemu_cdrom !== 'none'
      ? `${profile.qemu_cdrom} (Empty / ISO Ready)`
      : 'Disabled';

    const lines = [
      firstLine,
      ``,
      `# 🚀 Proxmox VE Template: \`${template_name}\``,
      ``,
      `> **Optimized Cloud Template** • Pre-configured for automated provisioning with **PUQ WHMCS Proxmox KVM Module**.`,
      ``,
      `---`,
      ``,
      `### 📦 Operating System & Image`,
      `| Attribute | Specification |`,
      `| :--- | :--- |`,
      `| **OS Distribution** | ${baseImage?.name || baseImage?.os || 'Linux'} |`,
      `| **Version / Family** | ${baseImage?.os || ''} ${baseImage?.version || ''}`.trim() + ` |`,
      `| **Architecture** | \`${baseImage?.arch || 'amd64 (x86_64)'}\` |`,
      `| **Upstream Source** | \`${baseImage?.filename || 'Cloud Base Image'}\` |`,
      ``,
      `### ⚙️ Template & Regional Settings`,
      `| Parameter | Value |`,
      `| :--- | :--- |`,
      `| **Template Name** | \`${template_name}\` |`,
      `| **Initial VMID** | \`${vmid}\` |`,
      `| **Profile Preset** | ${profile?.name || 'Standard'} |`,
      `| **Regional Group** | ${group?.name || 'Standard'} |`,
      `| **Timezone** | \`${group?.timezone || 'Europe/Warsaw'}\` |`,
      `| **System Locale** | \`${group?.locale || 'en_US.UTF-8'}\` |`,
      `| **Keyboard Layout** | \`${group?.keyboard_layout || 'en-us'}\` |`,
      ``,
      `### 💻 Hardware Allocation`,
      `| Component | Configuration |`,
      `| :--- | :--- |`,
      `| **vCPU** | ${profile?.qemu_cores || 1} Core(s) (\`${profile?.qemu_cpu_type || 'host'}\`) |`,
      `| **Memory (RAM)** | ${profile?.qemu_memory || 1024} MB |`,
      `| **Primary Disk** | ${actualDiskSizeGb || profile?.target_disk_size_gb || 5} GB (VirtIO SCSI, Format: \`${targetDiskFormat}\`, Discard: ${discard}, SSD: ${ssd}) |`,
      `| **CD-ROM Drive** | ${cdromStatus} |`,
      `| **Storage I/O** | Async I/O: \`${aio}\` \\| Cache: \`${cache}\` |`,
      `| **Display / Console** | \`${vga}\` (Serial Socket & noVNC Ready) |`,
      `| **Network Interface** | \`${profile?.qemu_net_model || 'virtio'}\` on \`vmbr0\` (Firewall: ${firewall}${netQueues}) |`,
      `| **Machine / BIOS** | \`${profile?.qemu_machine === 'q35' ? 'q35' : 'pc (i440fx)'}\` / \`${profile?.qemu_bios || 'seabios'}\` |`,
      ``,
      `### 🔧 Pre-Configured Services & Security`,
      `| Feature / Service | Configuration Status |`,
      `| :--- | :--- |`,
      `| **QEMU Guest Agent** | ${guestAgent} |`,
      `| **Cloud-Init Engine** | ${cloudInit} |`,
      `| **SSH Access** | Root Login: ${rootSsh} \\| Password Auth: ${passAuth} \\| Port: ${sshPort} |`,
      `| **Fail2ban Protection** | ${profile?.enable_fail2ban ? 'Installed & Enabled' : 'Disabled'} |`,
      `| **Kernel Optimization** | ${profile?.sysctl_tcp_bbr ? 'BBR TCP Congestion Control' : 'Standard'} |`,
      `| **Automation Compatibility** | PUQ WHMCS Proxmox KVM Directives Configured |`,
      ``,
      `---`,
      ``,
      `### 🛡️ Build Metadata`,
      `- **Build Timestamp:** \`${now} UTC\``,
      `- **Builder Engine:** [PUQcloud Template Studio](https://puqcloud.com)`,
      sha256 ? `- **SHA-256 Checksum:** \`${sha256}\`` : null,
    ];

    return lines.filter((line) => line !== null).join('\n') + '\n';
  }

  saveNotesFiles({ dumpDir, outputDir, outFilename, notesContent }) {
    const legacyName = outFilename.replace(/\.vma\.(zst|gz|lzo)$/, '.notes').replace(/\.tar\.(zst|gz)$/, '.notes');
    const stdName = `${outFilename}.notes`;

    const targetPaths = [
      path.join(dumpDir, stdName),
      path.join(dumpDir, legacyName),
      path.join(outputDir, stdName),
      path.join(outputDir, legacyName),
    ];

    for (const targetPath of targetPaths) {
      try {
        fs.writeFileSync(targetPath, notesContent, 'utf-8');
      } catch (_) {}
    }
  }
}

export const builderService = new BuilderService();
