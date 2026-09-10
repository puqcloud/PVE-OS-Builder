import express from 'express';
import db from '../db/index.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const profiles = db.prepare('SELECT * FROM profiles ORDER BY is_default DESC, id ASC').all();
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const p = req.body;
  if (!p.name || !p.os_family) {
    return res.status(400).json({ error: 'Name and OS family are required' });
  }

  // Collision Check 1: Lockout prevention (Password auth disabled without SSH public key)
  const isPassAuth = p.password_auth !== undefined ? (p.password_auth ? 1 : 0) : 1;
  const isRootSsh = p.enable_root_ssh !== undefined ? (p.enable_root_ssh ? 1 : 0) : 1;
  const sshKey = (p.provider_ssh_key || '').trim();
  if (!isPassAuth && isRootSsh && !sshKey) {
    return res.status(400).json({
      error: 'Security Lockout Collision: Password authentication cannot be disabled without providing an authorized Provider SSH Public Key. This would permanently lock out SSH access to the VM.'
    });
  }

  // Collision Check 2: Multiqueue vs CPU cores
  const cores = Math.max(1, parseInt(p.qemu_cores, 10) || 1);
  let queues = parseInt(p.qemu_net_queues, 10) || 0;
  if (queues > cores) {
    queues = cores;
  }

  try {
    const insert = db.prepare(`
      INSERT INTO profiles (
        name, description, os_family, root_password, enable_root_ssh, password_auth,
        install_cloud_init, install_guest_agent, remove_default_users, reset_machine_id,
        clean_ssh_host_keys, target_disk_size_gb, extra_packages, custom_script,
        qemu_cores, qemu_memory, qemu_net_model, qemu_scsihw,
        qemu_cpu_type, qemu_bios, qemu_machine, qemu_async_io, qemu_disk_cache,
        qemu_discard, qemu_ssd, qemu_net_queues, qemu_firewall, qemu_vga, qemu_watchdog,
        cloud_init_user, provider_ssh_key, optimize_cloud_init_sources, force_ssh_regen,
        disable_password_expiry, sysctl_tcp_bbr, sysctl_file_limits, sysctl_swappiness,
        sysctl_syn_flood, disable_ipv6, auto_security_updates, enable_fail2ban,
        ssh_custom_port, is_default
      ) VALUES (
        @name, @description, @os_family, @root_password, @enable_root_ssh, @password_auth,
        @install_cloud_init, @install_guest_agent, @remove_default_users, @reset_machine_id,
        @clean_ssh_host_keys, @target_disk_size_gb, @extra_packages, @custom_script,
        @qemu_cores, @qemu_memory, @qemu_net_model, @qemu_scsihw,
        @qemu_cpu_type, @qemu_bios, @qemu_machine, @qemu_async_io, @qemu_disk_cache,
        @qemu_discard, @qemu_ssd, @qemu_net_queues, @qemu_firewall, @qemu_vga, @qemu_watchdog,
        @cloud_init_user, @provider_ssh_key, @optimize_cloud_init_sources, @force_ssh_regen,
        @disable_password_expiry, @sysctl_tcp_bbr, @sysctl_file_limits, @sysctl_swappiness,
        @sysctl_syn_flood, @disable_ipv6, @auto_security_updates, @enable_fail2ban,
        @ssh_custom_port, @is_default
      )
    `).run({
      name: p.name,
      description: p.description || '',
      os_family: p.os_family,
      root_password: p.root_password || 'puqcloud',
      enable_root_ssh: isRootSsh,
      password_auth: isPassAuth,
      install_cloud_init: p.install_cloud_init !== undefined ? (p.install_cloud_init ? 1 : 0) : 1,
      install_guest_agent: p.install_guest_agent !== undefined ? (p.install_guest_agent ? 1 : 0) : 1,
      remove_default_users: p.remove_default_users !== undefined ? (p.remove_default_users ? 1 : 0) : 1,
      reset_machine_id: p.reset_machine_id !== undefined ? (p.reset_machine_id ? 1 : 0) : 1,
      clean_ssh_host_keys: p.clean_ssh_host_keys !== undefined ? (p.clean_ssh_host_keys ? 1 : 0) : 1,
      target_disk_size_gb: p.target_disk_size_gb || 5,
      extra_packages: p.extra_packages || '',
      custom_script: p.custom_script || '',
      qemu_cores: cores,
      qemu_memory: p.qemu_memory || 1024,
      qemu_net_model: p.qemu_net_model || 'virtio',
      qemu_scsihw: p.qemu_scsihw || 'virtio-scsi-single',
      qemu_cpu_type: p.qemu_cpu_type || 'host',
      qemu_bios: p.qemu_bios || 'seabios',
      qemu_machine: (p.qemu_machine === 'q35') ? 'q35' : 'pc',
      qemu_async_io: p.qemu_async_io || 'io_uring',
      qemu_disk_cache: p.qemu_disk_cache || 'none',
      qemu_discard: p.qemu_discard !== undefined ? (p.qemu_discard ? 1 : 0) : 1,
      qemu_ssd: p.qemu_ssd !== undefined ? (p.qemu_ssd ? 1 : 0) : 1,
      qemu_net_queues: queues,
      qemu_firewall: p.qemu_firewall !== undefined ? (p.qemu_firewall ? 1 : 0) : 1,
      qemu_vga: p.qemu_vga || 'std',
      qemu_watchdog: p.qemu_watchdog ? 1 : 0,
      cloud_init_user: p.cloud_init_user || 'root',
      provider_ssh_key: sshKey,
      optimize_cloud_init_sources: p.optimize_cloud_init_sources !== undefined ? (p.optimize_cloud_init_sources ? 1 : 0) : 1,
      force_ssh_regen: p.force_ssh_regen !== undefined ? (p.force_ssh_regen ? 1 : 0) : 1,
      disable_password_expiry: p.disable_password_expiry !== undefined ? (p.disable_password_expiry ? 1 : 0) : 1,
      sysctl_tcp_bbr: p.sysctl_tcp_bbr ? 1 : 0,
      sysctl_file_limits: p.sysctl_file_limits ? 1 : 0,
      sysctl_swappiness: p.sysctl_swappiness ? 1 : 0,
      sysctl_syn_flood: p.sysctl_syn_flood ? 1 : 0,
      disable_ipv6: p.disable_ipv6 ? 1 : 0,
      auto_security_updates: p.auto_security_updates ? 1 : 0,
      enable_fail2ban: p.enable_fail2ban ? 1 : 0,
      ssh_custom_port: parseInt(p.ssh_custom_port, 10) || 22,
      is_default: p.is_default ? 1 : 0,
    });

    const newProfile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(insert.lastInsertRowid);
    res.status(201).json(newProfile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const p = req.body;
  const id = req.params.id;

  // Collision Check 1: Lockout prevention
  const isPassAuth = p.password_auth !== undefined ? (p.password_auth ? 1 : 0) : 1;
  const isRootSsh = p.enable_root_ssh !== undefined ? (p.enable_root_ssh ? 1 : 0) : 1;
  const sshKey = (p.provider_ssh_key || '').trim();
  if (!isPassAuth && isRootSsh && !sshKey) {
    return res.status(400).json({
      error: 'Security Lockout Collision: Password authentication cannot be disabled without providing an authorized Provider SSH Public Key. This would permanently lock out SSH access to the VM.'
    });
  }

  // Collision Check 2: Multiqueue vs CPU cores
  const cores = Math.max(1, parseInt(p.qemu_cores, 10) || 1);
  let queues = parseInt(p.qemu_net_queues, 10) || 0;
  if (queues > cores) {
    queues = cores;
  }

  try {
    db.prepare(`
      UPDATE profiles SET
        name = @name,
        description = @description,
        os_family = @os_family,
        root_password = @root_password,
        enable_root_ssh = @enable_root_ssh,
        password_auth = @password_auth,
        install_cloud_init = @install_cloud_init,
        install_guest_agent = @install_guest_agent,
        remove_default_users = @remove_default_users,
        reset_machine_id = @reset_machine_id,
        clean_ssh_host_keys = @clean_ssh_host_keys,
        target_disk_size_gb = @target_disk_size_gb,
        extra_packages = @extra_packages,
        custom_script = @custom_script,
        qemu_cores = @qemu_cores,
        qemu_memory = @qemu_memory,
        qemu_net_model = @qemu_net_model,
        qemu_scsihw = @qemu_scsihw,
        qemu_cpu_type = @qemu_cpu_type,
        qemu_bios = @qemu_bios,
        qemu_machine = @qemu_machine,
        qemu_async_io = @qemu_async_io,
        qemu_disk_cache = @qemu_disk_cache,
        qemu_discard = @qemu_discard,
        qemu_ssd = @qemu_ssd,
        qemu_net_queues = @qemu_net_queues,
        qemu_firewall = @qemu_firewall,
        qemu_vga = @qemu_vga,
        qemu_watchdog = @qemu_watchdog,
        cloud_init_user = @cloud_init_user,
        provider_ssh_key = @provider_ssh_key,
        optimize_cloud_init_sources = @optimize_cloud_init_sources,
        force_ssh_regen = @force_ssh_regen,
        disable_password_expiry = @disable_password_expiry,
        sysctl_tcp_bbr = @sysctl_tcp_bbr,
        sysctl_file_limits = @sysctl_file_limits,
        sysctl_swappiness = @sysctl_swappiness,
        sysctl_syn_flood = @sysctl_syn_flood,
        disable_ipv6 = @disable_ipv6,
        auto_security_updates = @auto_security_updates,
        enable_fail2ban = @enable_fail2ban,
        ssh_custom_port = @ssh_custom_port,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
      id,
      name: p.name,
      description: p.description || '',
      os_family: p.os_family,
      root_password: p.root_password || 'puqcloud',
      enable_root_ssh: isRootSsh,
      password_auth: isPassAuth,
      install_cloud_init: p.install_cloud_init !== undefined ? (p.install_cloud_init ? 1 : 0) : 1,
      install_guest_agent: p.install_guest_agent !== undefined ? (p.install_guest_agent ? 1 : 0) : 1,
      remove_default_users: p.remove_default_users !== undefined ? (p.remove_default_users ? 1 : 0) : 1,
      reset_machine_id: p.reset_machine_id !== undefined ? (p.reset_machine_id ? 1 : 0) : 1,
      clean_ssh_host_keys: p.clean_ssh_host_keys !== undefined ? (p.clean_ssh_host_keys ? 1 : 0) : 1,
      target_disk_size_gb: p.target_disk_size_gb || 5,
      extra_packages: p.extra_packages || '',
      custom_script: p.custom_script || '',
      qemu_cores: cores,
      qemu_memory: p.qemu_memory || 1024,
      qemu_net_model: p.qemu_net_model || 'virtio',
      qemu_scsihw: p.qemu_scsihw || 'virtio-scsi-single',
      qemu_cpu_type: p.qemu_cpu_type || 'host',
      qemu_bios: p.qemu_bios || 'seabios',
      qemu_machine: (p.qemu_machine === 'q35') ? 'q35' : 'pc',
      qemu_async_io: p.qemu_async_io || 'io_uring',
      qemu_disk_cache: p.qemu_disk_cache || 'none',
      qemu_discard: p.qemu_discard !== undefined ? (p.qemu_discard ? 1 : 0) : 1,
      qemu_ssd: p.qemu_ssd !== undefined ? (p.qemu_ssd ? 1 : 0) : 1,
      qemu_net_queues: queues,
      qemu_firewall: p.qemu_firewall !== undefined ? (p.qemu_firewall ? 1 : 0) : 1,
      qemu_vga: p.qemu_vga || 'std',
      qemu_watchdog: p.qemu_watchdog ? 1 : 0,
      cloud_init_user: p.cloud_init_user || 'root',
      provider_ssh_key: sshKey,
      optimize_cloud_init_sources: p.optimize_cloud_init_sources !== undefined ? (p.optimize_cloud_init_sources ? 1 : 0) : 1,
      force_ssh_regen: p.force_ssh_regen !== undefined ? (p.force_ssh_regen ? 1 : 0) : 1,
      disable_password_expiry: p.disable_password_expiry !== undefined ? (p.disable_password_expiry ? 1 : 0) : 1,
      sysctl_tcp_bbr: p.sysctl_tcp_bbr ? 1 : 0,
      sysctl_file_limits: p.sysctl_file_limits ? 1 : 0,
      sysctl_swappiness: p.sysctl_swappiness ? 1 : 0,
      sysctl_syn_flood: p.sysctl_syn_flood ? 1 : 0,
      disable_ipv6: p.disable_ipv6 ? 1 : 0,
      auto_security_updates: p.auto_security_updates ? 1 : 0,
      enable_fail2ban: p.enable_fail2ban ? 1 : 0,
      ssh_custom_port: parseInt(p.ssh_custom_port, 10) || 22,
    });

    const updated = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM profiles WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
