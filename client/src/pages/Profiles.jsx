import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import {
  Sliders,
  Plus,
  Trash2,
  Edit2,
  Check,
  Shield,
  HardDrive,
  Cpu,
  Terminal,
  Monitor,
  Key,
  Zap,
  Lock,
  Server,
  AlertTriangle,
  Activity,
  RefreshCw,
  Disc,
} from 'lucide-react';

export default function Profiles() {
  const { apiFetch } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('baseline');

  const defaultFormData = {
    // Basic Details
    name: '',
    description: '',
    os_family: 'debian',
    root_password: 'puqcloud',
    target_disk_size_gb: 5,
    qemu_cores: 1,
    qemu_memory: 1024,
    extra_packages: 'cloud-init, cloud-initramfs-growroot, qemu-guest-agent, curl, wget',
    custom_script: '',
    is_default: false,

    // PUQ WHMCS Module Baseline Directives (Default: Active)
    enable_root_ssh: true,
    password_auth: true,
    install_cloud_init: true,
    install_guest_agent: true,
    remove_default_users: true,
    reset_machine_id: true,
    clean_ssh_host_keys: true,
    qemu_vga: 'std', // Mandatory for WHMCS noVNC Console compatibility
    qemu_net_model: 'virtio',
    qemu_scsihw: 'virtio-scsi-single',

    // Category 1: Proxmox VE & QEMU Hardware Directives
    qemu_cpu_type: 'host',
    qemu_bios: 'seabios',
    qemu_machine: 'pc',
    qemu_async_io: 'io_uring',
    qemu_disk_cache: 'none',
    qemu_discard: true,
    qemu_ssd: true,
    qemu_net_queues: 0,
    qemu_firewall: true,
    qemu_watchdog: false,
    qemu_cdrom: 'none',
    disk_format: 'raw',

    // Category 2: Cloud-Init & Access Management Directives
    cloud_init_user: 'root',
    provider_ssh_key: '',
    optimize_cloud_init_sources: true,
    force_ssh_regen: true,
    disable_password_expiry: true,

    // Category 3: Linux Kernel & Sysctl Tuning Directives
    sysctl_tcp_bbr: false,
    sysctl_file_limits: false,
    sysctl_swappiness: false,
    sysctl_syn_flood: false,
    disable_ipv6: false,

    // Category 4: Security & Hardening Directives
    enable_fail2ban: false,
    auto_security_updates: false,
    ssh_custom_port: 22,
  };

  const [formData, setFormData] = useState(defaultFormData);
  const [submitting, setSubmitting] = useState(false);

  // Collision detection logic
  const isLockoutRisk = !formData.password_auth && formData.enable_root_ssh && !formData.provider_ssh_key.trim();
  const isRootDisabled = !formData.enable_root_ssh && formData.cloud_init_user === 'root';
  const isMultiqueueExcess = formData.qemu_net_queues > formData.qemu_cores;

  const fetchProfiles = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch('/api/profiles');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch (err) {
      console.error('Failed to fetch profiles:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setActiveTab('baseline');
    setIsModalOpen(true);
  };

  const openEditModal = (profile) => {
    setEditingId(profile.id);
    setFormData({
      name: profile.name,
      description: profile.description || '',
      os_family: profile.os_family || 'debian',
      root_password: profile.root_password || 'puqcloud',
      target_disk_size_gb: profile.target_disk_size_gb || 5,
      qemu_cores: profile.qemu_cores || 1,
      qemu_memory: profile.qemu_memory || 1024,
      extra_packages: profile.extra_packages || '',
      custom_script: profile.custom_script || '',
      is_default: !!profile.is_default,

      // Baseline
      enable_root_ssh: profile.enable_root_ssh !== undefined ? !!profile.enable_root_ssh : true,
      password_auth: profile.password_auth !== undefined ? !!profile.password_auth : true,
      install_cloud_init: profile.install_cloud_init !== undefined ? !!profile.install_cloud_init : true,
      install_guest_agent: profile.install_guest_agent !== undefined ? !!profile.install_guest_agent : true,
      remove_default_users: profile.remove_default_users !== undefined ? !!profile.remove_default_users : true,
      reset_machine_id: profile.reset_machine_id !== undefined ? !!profile.reset_machine_id : true,
      clean_ssh_host_keys: profile.clean_ssh_host_keys !== undefined ? !!profile.clean_ssh_host_keys : true,
      qemu_vga: profile.qemu_vga || 'std',
      qemu_net_model: profile.qemu_net_model || 'virtio',
      qemu_scsihw: profile.qemu_scsihw || 'virtio-scsi-single',

      // Category 1
      qemu_cpu_type: profile.qemu_cpu_type || 'host',
      qemu_bios: profile.qemu_bios || 'seabios',
      qemu_machine: profile.qemu_machine === 'i440fx' ? 'pc' : (profile.qemu_machine || 'pc'),
      qemu_async_io: profile.qemu_async_io || 'io_uring',
      qemu_disk_cache: profile.qemu_disk_cache || 'none',
      qemu_discard: profile.qemu_discard !== undefined ? !!profile.qemu_discard : true,
      qemu_ssd: profile.qemu_ssd !== undefined ? !!profile.qemu_ssd : true,
      qemu_net_queues: profile.qemu_net_queues || 0,
      qemu_firewall: profile.qemu_firewall !== undefined ? !!profile.qemu_firewall : true,
      qemu_watchdog: !!profile.qemu_watchdog,
      qemu_cdrom: profile.qemu_cdrom || 'none',
      disk_format: profile.disk_format || 'raw',

      // Category 2
      cloud_init_user: profile.cloud_init_user || 'root',
      provider_ssh_key: profile.provider_ssh_key || '',
      optimize_cloud_init_sources: profile.optimize_cloud_init_sources !== undefined ? !!profile.optimize_cloud_init_sources : true,
      force_ssh_regen: profile.force_ssh_regen !== undefined ? !!profile.force_ssh_regen : true,
      disable_password_expiry: profile.disable_password_expiry !== undefined ? !!profile.disable_password_expiry : true,

      // Category 3
      sysctl_tcp_bbr: !!profile.sysctl_tcp_bbr,
      sysctl_file_limits: !!profile.sysctl_file_limits,
      sysctl_swappiness: !!profile.sysctl_swappiness,
      sysctl_syn_flood: !!profile.sysctl_syn_flood,
      disable_ipv6: !!profile.disable_ipv6,

      // Category 4
      enable_fail2ban: !!profile.enable_fail2ban,
      auto_security_updates: !!profile.auto_security_updates,
      ssh_custom_port: profile.ssh_custom_port || 22,
    });
    setActiveTab('baseline');
    setIsModalOpen(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete profile '${name}'?`)) return;
    try {
      await apiFetch(`/api/profiles/${id}`, { method: 'DELETE' });
      fetchProfiles();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLockoutRisk) {
      alert('Security Lockout Collision: You cannot disable Password Authentication without providing a Provider SSH Public Key. This would prevent all SSH logins.');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingId ? `/api/profiles/${editingId}` : '/api/profiles';
      const method = editingId ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchProfiles();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <Sliders size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span>OS Build Profiles</span>
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Configure PUQ WHMCS Proxmox KVM template presets: QEMU hardware parameters, cloud-init credentials, kernel sysctl tuning, and security hardening.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchProfiles(true)}
              disabled={refreshing || loading}
              title="Refresh profiles"
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
              <Plus size={16} />
              <span>Create Profile</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            Loading profiles...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {profiles.map((profile) => (
              <div
                key={profile.id}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>
                      {profile.name}
                    </div>
                    {profile.is_default ? (
                      <span className="badge badge-info">Default</span>
                    ) : (
                      <span className="badge badge-os" style={{ textTransform: 'uppercase' }}>
                        {profile.os_family}
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.4 }}>
                    {profile.description || 'No description provided.'}
                  </p>

                  {/* Feature Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {profile.enable_root_ssh === 1 && (
                      <span className="badge badge-success" title="Root SSH permitted">
                        <Shield size={11} /> Root SSH
                      </span>
                    )}
                    {profile.install_cloud_init === 1 && (
                      <span className="badge badge-success" title="Cloud-Init active">
                        <Check size={11} /> Cloud-Init
                      </span>
                    )}
                    {profile.install_guest_agent === 1 && (
                      <span className="badge badge-success" title="QEMU Guest Agent active">
                        <Cpu size={11} /> Guest Agent
                      </span>
                    )}
                    <span className="badge badge-os" title="VNC Console compatibility">
                      <Monitor size={11} /> noVNC ({profile.qemu_vga || 'std'})
                    </span>
                    <span className="badge badge-os" title="Primary Disk Format">
                      <HardDrive size={11} /> {profile.target_disk_size_gb || 5}GB ({(profile.disk_format || 'raw').toUpperCase()})
                    </span>
                    {profile.qemu_cdrom && profile.qemu_cdrom !== 'none' && (
                      <span className="badge badge-info" title="CD-ROM Drive Attached">
                        <Disc size={11} /> CD-ROM ({profile.qemu_cdrom})
                      </span>
                    )}

                    {/* Advanced Opt-in indicators */}
                    {profile.sysctl_tcp_bbr === 1 && (
                      <span className="badge" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }} title="TCP BBR Congestion Control Active">
                        <Zap size={11} /> TCP BBR
                      </span>
                    )}
                    {profile.qemu_async_io === 'io_uring' && (
                      <span className="badge" style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }} title="Async I/O: io_uring">
                        io_uring
                      </span>
                    )}
                    {profile.enable_fail2ban === 1 && (
                      <span className="badge" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }} title="Fail2ban Active">
                        <Lock size={11} /> Fail2ban
                      </span>
                    )}
                    {profile.qemu_watchdog === 1 && (
                      <span className="badge" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }} title="Hardware Watchdog Active">
                        <Activity size={11} /> Watchdog
                      </span>
                    )}
                    {profile.provider_ssh_key && profile.provider_ssh_key.trim().length > 0 && (
                      <span className="badge badge-info" title="Provider SSH Key Injected">
                        <Key size={11} /> SSH Key
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '14px',
                  }}
                >
                  <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(profile)}>
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(profile.id, profile.name)}
                    disabled={profile.is_default === 1}
                    title={profile.is_default === 1 ? 'Default profile cannot be deleted' : 'Delete profile'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit OS Build Profile' : 'Create OS Build Profile'}
        maxWidth="840px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              {isLockoutRisk && (
                <span style={{ color: '#f87171', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <AlertTriangle size={14} /> Lockout collision: Supply an SSH key or enable Password Auth.
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting || isLockoutRisk}>
                {submitting ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          {/* Lockout Warning Banner */}
          {isLockoutRisk && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12.5px', color: '#fca5a5', lineHeight: 1.4 }}>
                <strong>Security Collision Detected:</strong> Password Authentication is disabled while Root SSH is enabled, but no Provider SSH Key is supplied. This would permanently lock out SSH access to cloned virtual machines.
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '18px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'baseline' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px' }}
              onClick={() => setActiveTab('baseline')}
            >
              <Shield size={13} />
              <span>PUQ Baseline (Default)</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'hardware' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px' }}
              onClick={() => setActiveTab('hardware')}
            >
              <Server size={13} />
              <span>1. QEMU Hardware</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'access' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px' }}
              onClick={() => setActiveTab('access')}
            >
              <Key size={13} />
              <span>2. Cloud-Init & Access</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'sysctl' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px' }}
              onClick={() => setActiveTab('sysctl')}
            >
              <Zap size={13} />
              <span>3. Kernel & Sysctl</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'security' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '12px' }}
              onClick={() => setActiveTab('security')}
            >
              <Lock size={13} />
              <span>4. Hardening</span>
            </button>
          </div>

          {/* TAB 1: Baseline Directives (Default Active) */}
          {activeTab === 'baseline' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Profile Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. PUQ WHMCS - Debian 12 Standard"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">OS Family</label>
                  <select
                    className="form-control"
                    value={formData.os_family}
                    onChange={(e) => setFormData({ ...formData, os_family: e.target.value })}
                  >
                    <option value="debian">Debian</option>
                    <option value="ubuntu">Ubuntu</option>
                    <option value="rhel">RHEL / AlmaLinux / Rocky</option>
                    <option value="alpine">Alpine Linux</option>
                    <option value="fedora">Fedora Cloud</option>
                    <option value="opensuse">openSUSE</option>
                    <option value="arch">Arch Linux</option>
                    <option value="generic">Generic Linux</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="WHMCS automation template preset details..."
                />
              </div>

              {/* PUQ WHMCS Directives Box */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} style={{ color: 'var(--accent-cyan)' }} />
                    <span>PUQ WHMCS Module Template Directives (Active Baseline)</span>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: '11px' }}>Mandatory Baseline</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={formData.enable_root_ssh}
                      onChange={(e) => setFormData({ ...formData, enable_root_ssh: e.target.checked })}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, color: '#fff' }}>Enable Root SSH Login</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Sets PermitRootLogin yes in sshd_config</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={formData.password_auth}
                      onChange={(e) => setFormData({ ...formData, password_auth: e.target.checked })}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, color: '#fff' }}>Password Authentication</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Sets PasswordAuthentication yes for root</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={formData.install_cloud_init}
                      onChange={(e) => setFormData({ ...formData, install_cloud_init: e.target.checked })}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, color: '#fff' }}>Cloud-Init & Growroot</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Auto-expands root disk partition on boot</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={formData.install_guest_agent}
                      onChange={(e) => setFormData({ ...formData, install_guest_agent: e.target.checked })}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, color: '#fff' }}>QEMU Guest Agent (agent: 1)</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Required for IP fetching and graceful shutdown</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={formData.reset_machine_id}
                      onChange={(e) => setFormData({ ...formData, reset_machine_id: e.target.checked })}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, color: '#fff' }}>Reset Machine ID</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Truncates /etc/machine-id for DHCP uniqueness</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={formData.clean_ssh_host_keys}
                      onChange={(e) => setFormData({ ...formData, clean_ssh_host_keys: e.target.checked })}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, color: '#fff' }}>Purge SSH Host Keys</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Removes stock host keys to avoid duplicate fingerprint</div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={formData.remove_default_users}
                      onChange={(e) => setFormData({ ...formData, remove_default_users: e.target.checked })}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, color: '#fff' }}>Remove Stock Distro Users</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Purges ubuntu, debian, and centos default accounts</div>
                    </div>
                  </label>
                </div>

                {/* Mandatory Monitor for WHMCS VNC Console */}
                <div
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Monitor size={18} style={{ color: '#60a5fa' }} />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff' }}>
                        Mandatory Display Monitor (for PUQ WHMCS noVNC Console)
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Standard VGA display is active so the Proxmox noVNC console embedded in the WHMCS client area works immediately.
                      </div>
                    </div>
                  </div>

                  <select
                    className="form-control"
                    style={{ width: '130px', padding: '5px 10px', fontSize: '12px' }}
                    value={formData.qemu_vga}
                    onChange={(e) => setFormData({ ...formData, qemu_vga: e.target.value })}
                  >
                    <option value="std">Standard (std)</option>
                    <option value="virtio">VirtIO-GPU</option>
                    <option value="qxl">SPICE (qxl)</option>
                    <option value="serial0">Serial (serial0)</option>
                  </select>
                </div>
              </div>

              {/* Hardware resources */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Disk Size (GB)</label>
                  <input
                    type="number"
                    min="2"
                    max="500"
                    className="form-control"
                    value={formData.target_disk_size_gb}
                    onChange={(e) => setFormData({ ...formData, target_disk_size_gb: parseInt(e.target.value, 10) })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">QEMU Cores</label>
                  <input
                    type="number"
                    min="1"
                    max="32"
                    className="form-control"
                    value={formData.qemu_cores}
                    onChange={(e) => setFormData({ ...formData, qemu_cores: parseInt(e.target.value, 10) })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">QEMU RAM (MB)</label>
                  <input
                    type="number"
                    min="512"
                    max="65536"
                    step="512"
                    className="form-control"
                    value={formData.qemu_memory}
                    onChange={(e) => setFormData({ ...formData, qemu_memory: parseInt(e.target.value, 10) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Default Root Password</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.root_password}
                  onChange={(e) => setFormData({ ...formData, root_password: e.target.value })}
                  placeholder="puqcloud"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Category 1 - Proxmox VE & QEMU Hardware Directives */}
          {activeTab === 'hardware' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Server size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span>1. Proxmox VE & QEMU Virtual Machine Directives</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">CPU Type (cpu:)</label>
                  <select
                    className="form-control"
                    value={formData.qemu_cpu_type}
                    onChange={(e) => setFormData({ ...formData, qemu_cpu_type: e.target.value })}
                  >
                    <option value="host">host (Host CPU passthrough - Recommended & Highest performance)</option>
                    <option value="x86-64-v2-AES">x86-64-v2-AES (Standard modern cluster baseline, supported by EL9)</option>
                    <option value="x86-64-v3">x86-64-v3 (AVX2 instructions - Required for EL10 / CentOS 10)</option>
                    <option value="EPYC">EPYC (AMD EPYC processors)</option>
                    <option value="kvm64">kvm64 (Legacy baseline - Incompatible with RHEL/Alma/Rocky/CentOS 9 & 10)</option>
                  </select>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Use <strong>host</strong> (recommended) or <strong>x86-64-v2-AES</strong>. Modern RHEL/CentOS/Alma/Rocky 9 requires at least x86-64-v2, and version 10 requires x86-64-v3. Using kvm64 causes an immediate boot-loop kernel panic.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">BIOS Firmware</label>
                  <select
                    className="form-control"
                    value={formData.qemu_bios}
                    onChange={(e) => setFormData({ ...formData, qemu_bios: e.target.value })}
                  >
                    <option value="seabios">SeaBIOS (Standard BIOS - Default)</option>
                    <option value="ovmf">OVMF (UEFI - Modern GPT partition tables)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Machine Type</label>
                  <select
                    className="form-control"
                    value={formData.qemu_machine}
                    onChange={(e) => setFormData({ ...formData, qemu_machine: e.target.value })}
                  >
                    <option value="pc">pc (i440fx - Default)</option>
                    <option value="q35">q35 (Modern PCIe Architecture)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Disk Async I/O (aio=)</label>
                  <select
                    className="form-control"
                    value={formData.qemu_async_io}
                    onChange={(e) => setFormData({ ...formData, qemu_async_io: e.target.value })}
                  >
                    <option value="io_uring">io_uring (Fastest on Linux 5.15+ kernels)</option>
                    <option value="native">native (Direct Linux AIO)</option>
                    <option value="threads">threads (Fallback multi-threaded AIO)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Disk Cache Mode</label>
                  <select
                    className="form-control"
                    value={formData.qemu_disk_cache}
                    onChange={(e) => setFormData({ ...formData, qemu_disk_cache: e.target.value })}
                  >
                    <option value="none">none (Cluster & Ceph safe - Default)</option>
                    <option value="writeback">writeback (High performance for local NVMe)</option>
                    <option value="writethrough">writethrough (Conservative)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Primary Disk Format</label>
                  <select
                    className="form-control"
                    value={formData.disk_format}
                    onChange={(e) => setFormData({ ...formData, disk_format: e.target.value })}
                  >
                    <option value="raw">RAW (.raw - LVM / ZFS / Ceph Block Storage - Default)</option>
                    <option value="qcow2">QCOW2 (.qcow2 - QEMU Copy-On-Write / NFS & Directory Storage)</option>
                    <option value="vmdk">VMDK (.vmdk - VMware Compatible Virtual Disk)</option>
                  </select>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Target disk format. Converted via qemu-img and packaged directly into the Proxmox VMA archive.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">CD-ROM Drive (media=cdrom)</label>
                  <select
                    className="form-control"
                    value={formData.qemu_cdrom}
                    onChange={(e) => setFormData({ ...formData, qemu_cdrom: e.target.value })}
                  >
                    <option value="none">Disabled (No CD-ROM Drive)</option>
                    <option value="ide2">IDE 2 (ide2: none,media=cdrom - Proxmox Default)</option>
                    <option value="ide0">IDE 0 (ide0: none,media=cdrom)</option>
                    <option value="sata1">SATA 1 (sata1: none,media=cdrom - Recommended for Q35)</option>
                    <option value="scsi1">SCSI 1 (scsi1: none,media=cdrom)</option>
                  </select>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Attaches an empty CD-ROM drive for mounting ISOs. If IDE 2 is selected, Cloud-Init automatically shifts to IDE 0.
                  </div>
                </div>
              </div>

              {/* Hardware Toggles */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '14px',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.qemu_discard}
                    onChange={(e) => setFormData({ ...formData, qemu_discard: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Discard / TRIM (discard=on)</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Reclaims unallocated blocks back to host storage pool</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.qemu_ssd}
                    onChange={(e) => setFormData({ ...formData, qemu_ssd: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>SSD Emulation (ssd=1)</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Signals solid-state media to guest OS scheduler</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.qemu_firewall}
                    onChange={(e) => setFormData({ ...formData, qemu_firewall: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Proxmox Network Firewall (firewall=1)</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Enables Proxmox VE built-in packet firewall for net0</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.qemu_watchdog}
                    onChange={(e) => setFormData({ ...formData, qemu_watchdog: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Hardware Watchdog (i6300esb)</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Auto-reboots VM if guest operating system kernel hangs</div>
                  </div>
                </label>
              </div>

              {/* Multiqueue Network */}
              <div className="form-group">
                <label className="form-label">Network Multiqueue (queues=)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <select
                    className="form-control"
                    style={{ width: '180px' }}
                    value={formData.qemu_net_queues}
                    onChange={(e) => setFormData({ ...formData, qemu_net_queues: parseInt(e.target.value, 10) })}
                  >
                    <option value={0}>0 (Single Queue / Auto)</option>
                    <option value={2}>2 Queues (requires ≥ 2 Cores)</option>
                    <option value={4}>4 Queues (requires ≥ 4 Cores)</option>
                    <option value={8}>8 Queues (requires ≥ 8 Cores)</option>
                  </select>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Distributes high packet rate interrupts across multiple vCPUs (recommended for 10Gbps+ links).
                  </span>
                </div>
                {isMultiqueueExcess && (
                  <div style={{ color: '#fbbf24', fontSize: '11.5px', marginTop: '4px' }}>
                    Note: Multiqueue ({formData.qemu_net_queues}) exceeds configured CPU cores ({formData.qemu_cores}); it will be clamped to core count.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Category 2 - Cloud-Init & Access Management Directives */}
          {activeTab === 'access' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span>2. Cloud-Init & Access Management Directives</span>
              </div>

              <div className="form-group">
                <label className="form-label">Default Cloud-Init Username</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.cloud_init_user}
                  onChange={(e) => setFormData({ ...formData, cloud_init_user: e.target.value })}
                  placeholder="root"
                />
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Default is 'root' for PUQ WHMCS automation. Can be set to custom administrative user (e.g. puqadmin, debian, ubuntu).
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Provider Authorized SSH Public Key</label>
                <textarea
                  rows="3"
                  className="form-control"
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                  value={formData.provider_ssh_key}
                  onChange={(e) => setFormData({ ...formData, provider_ssh_key: e.target.value })}
                  placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQD... support@puqcloud.com"
                />
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Pre-injects your company or monitoring SSH public key into /root/.ssh/authorized_keys (with permissions 0600).
                </div>
              </div>

              {/* Cloud-Init Toggles */}
              <div
                style={{
                  padding: '14px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.optimize_cloud_init_sources}
                    onChange={(e) => setFormData({ ...formData, optimize_cloud_init_sources: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Fast Cloud-Init Datasources (NoCloud & ConfigDrive)</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Eliminates 20–30s boot lag by ignoring non-Proxmox metadata sources (AWS, Azure, GCP, OpenStack).
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.disable_password_expiry}
                    onChange={(e) => setFormData({ ...formData, disable_password_expiry: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Disable Password Expiry Enforcement</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Executes chage -d -1 so WHMCS clients are never forced to change root password upon first SSH login.
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.force_ssh_regen}
                    onChange={(e) => setFormData({ ...formData, force_ssh_regen: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Regenerate SSH Host Keys on First Boot</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Guarantees unique server fingerprint across cloned instances in WHMCS automation.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 4: Category 3 - Linux Kernel & Sysctl Tuning Directives */}
          {activeTab === 'sysctl' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span>3. Linux Kernel & Sysctl Network Tuning Directives</span>
              </div>

              <div
                style={{
                  padding: '14px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.sysctl_tcp_bbr}
                    onChange={(e) => setFormData({ ...formData, sysctl_tcp_bbr: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Enable TCP BBR Congestion Control</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Sets net.ipv4.tcp_congestion_control = bbr and fq queue. Provides dramatic throughput gains over long-haul connections.
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.sysctl_file_limits}
                    onChange={(e) => setFormData({ ...formData, sysctl_file_limits: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>High System File Limits (nofile: 65536)</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Sets fs.file-max = 2097152 and security limits nofile to 65536 for high concurrency (Docker/Web servers).
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.sysctl_swappiness}
                    onChange={(e) => setFormData({ ...formData, sysctl_swappiness: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Optimized Swappiness (vm.swappiness = 10)</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Prevents Linux kernel from prematurely swapping memory pages to disk under normal hosting workloads.
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.sysctl_syn_flood}
                    onChange={(e) => setFormData({ ...formData, sysctl_syn_flood: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Kernel SYN Flood Protection</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Enables net.ipv4.tcp_syncookies = 1 and raises tcp_max_syn_backlog to 8192 to resist basic SYN floods.
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.disable_ipv6}
                    onChange={(e) => setFormData({ ...formData, disable_ipv6: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Disable IPv6 Stack</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Disables IPv6 kernel stack (useful in IPv4-only datacenters to eliminate AAAA DNS resolution delays).
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 5: Category 4 - Security & Hardening Directives */}
          {activeTab === 'security' && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span>4. Security & Hardening Directives</span>
              </div>

              <div
                style={{
                  padding: '14px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  marginBottom: '16px',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.enable_fail2ban}
                    onChange={(e) => setFormData({ ...formData, enable_fail2ban: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Pre-install and Enable Fail2ban</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Automatically installs and starts fail2ban with default SSH jail to block brute-force attacks.
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.auto_security_updates}
                    onChange={(e) => setFormData({ ...formData, auto_security_updates: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: '#fff' }}>Unattended Security Upgrades</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      Configures unattended-upgrades (Debian/Ubuntu) or dnf-automatic (RHEL) for automated security fixes.
                    </div>
                  </div>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Custom SSH Port</label>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    className="form-control"
                    value={formData.ssh_custom_port}
                    onChange={(e) => setFormData({ ...formData, ssh_custom_port: parseInt(e.target.value, 10) || 22 })}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Default is 22. Can be set to non-standard port (e.g. 2222).
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Extra Packages (comma-separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.extra_packages}
                    onChange={(e) => setFormData({ ...formData, extra_packages: e.target.value })}
                    placeholder="curl, wget, ca-certificates, vim, htop"
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Packages installed during image build.
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Custom Bash Script (Post-install)</label>
                <textarea
                  rows="3"
                  className="form-control"
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                  value={formData.custom_script}
                  onChange={(e) => setFormData({ ...formData, custom_script: e.target.value })}
                  placeholder="#!/bin/bash\n# Custom post-installation commands..."
                />
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
