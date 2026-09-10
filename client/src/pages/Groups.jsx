import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import {
  Globe,
  Plus,
  Trash2,
  Edit2,
  Clock,
  MapPin,
  Server,
  RefreshCw,
  FileCode,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

const REGION_BADGES = {
  EU: { label: '🇪🇺 Central Europe', bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: '#3b82f6' },
  US: { label: '🇺🇸 US Central', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: '#ef4444' },
  CA: { label: '🇨🇦 Canada Central', bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185', border: '#f43f5e' },
  CN: { label: '🇨🇳 China Mainland', bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15', border: '#eab308' },
  IN: { label: '🇮🇳 India', bg: 'rgba(249, 115, 22, 0.15)', text: '#fb923c', border: '#f97316' },
  GLOBAL: { label: '🌐 Global UTC', bg: 'rgba(0, 192, 243, 0.15)', text: '#38bdf8', border: '#00c0f3' },
};

const PRESETS = [
  {
    name: 'Central Europe',
    timezone: 'Europe/Warsaw',
    locale: 'en_US.UTF-8',
    nameservers: '1.1.1.1, 8.8.8.8',
    region_code: 'EU',
    apt_mirror: 'http://deb.debian.org/debian/',
    package_mirrors: {
      debian: 'http://deb.debian.org/debian/',
      ubuntu: 'http://archive.ubuntu.com/ubuntu/',
      rhel: '',
      alpine: 'http://dl-cdn.alpinelinux.org/alpine/',
      archlinux: 'https://geo.mirror.pkgbuild.com/$repo/os/$arch',
      opensuse: 'http://download.opensuse.org/'
    },
    description: 'Central European standard (CET/CEST) with fast European mirror routing.',
  },
  {
    name: 'US Central / North America',
    timezone: 'America/Chicago',
    locale: 'en_US.UTF-8',
    nameservers: '1.1.1.1, 8.8.8.8',
    region_code: 'US',
    apt_mirror: 'http://us.archive.ubuntu.com/ubuntu/',
    package_mirrors: {
      debian: 'http://ftp.us.debian.org/debian/',
      ubuntu: 'http://us.archive.ubuntu.com/ubuntu/',
      rhel: '',
      alpine: 'http://dl-cdn.alpinelinux.org/alpine/',
      archlinux: 'https://geo.mirror.pkgbuild.com/$repo/os/$arch',
      opensuse: 'http://download.opensuse.org/'
    },
    description: 'Central & Eastern United States standard routing.',
  },
  {
    name: 'Canada Central',
    timezone: 'America/Winnipeg',
    locale: 'en_CA.UTF-8',
    nameservers: '1.1.1.1, 8.8.8.8',
    region_code: 'CA',
    apt_mirror: 'http://ca.archive.ubuntu.com/ubuntu/',
    package_mirrors: {
      debian: 'http://ftp.ca.debian.org/debian/',
      ubuntu: 'http://ca.archive.ubuntu.com/ubuntu/',
      rhel: '',
      alpine: 'http://dl-cdn.alpinelinux.org/alpine/',
      archlinux: 'https://geo.mirror.pkgbuild.com/$repo/os/$arch',
      opensuse: 'http://download.opensuse.org/'
    },
    description: 'Canadian regional standard (Winnipeg / Manitoba / Toronto).',
  },
  {
    name: 'China Mainland',
    timezone: 'Asia/Shanghai',
    locale: 'en_US.UTF-8',
    nameservers: '223.5.5.5, 119.29.29.29',
    region_code: 'CN',
    apt_mirror: 'http://mirrors.aliyun.com/debian/',
    package_mirrors: {
      debian: 'http://mirrors.aliyun.com/debian/',
      ubuntu: 'http://mirrors.aliyun.com/ubuntu/',
      rhel: 'http://mirrors.aliyun.com/centos/',
      alpine: 'http://mirrors.aliyun.com/alpine/',
      archlinux: 'http://mirrors.aliyun.com/archlinux/$repo/os/$arch',
      opensuse: 'http://mirrors.aliyun.com/opensuse/'
    },
    description: 'Mainland China: Alibaba/Tencent DNS and Aliyun mirrors.',
  },
  {
    name: 'India',
    timezone: 'Asia/Kolkata',
    locale: 'en_IN.UTF-8',
    nameservers: '1.1.1.1, 8.8.8.8',
    region_code: 'IN',
    apt_mirror: 'http://in.archive.ubuntu.com/ubuntu/',
    package_mirrors: {
      debian: 'http://deb.debian.org/debian/',
      ubuntu: 'http://in.archive.ubuntu.com/ubuntu/',
      rhel: '',
      alpine: 'http://dl-cdn.alpinelinux.org/alpine/',
      archlinux: 'https://geo.mirror.pkgbuild.com/$repo/os/$arch',
      opensuse: 'http://download.opensuse.org/'
    },
    description: 'Indian Standard Time (IST UTC+5:30) with regional mirrors.',
  },
  {
    name: 'Global Standard (UTC)',
    timezone: 'UTC',
    locale: 'en_US.UTF-8',
    nameservers: '1.1.1.1, 8.8.8.8',
    region_code: 'GLOBAL',
    apt_mirror: '',
    package_mirrors: {
      debian: '',
      ubuntu: '',
      rhel: '',
      alpine: '',
      archlinux: '',
      opensuse: ''
    },
    description: 'Universal standard UTC preset for cloud clusters.',
  },
];

const DISTRO_OPTIONS = [
  { key: 'debian', label: 'Debian', badge: 'APT', icon: '🐧', placeholder: 'e.g. http://deb.debian.org/debian/' },
  { key: 'ubuntu', label: 'Ubuntu', badge: 'APT', icon: '🟠', placeholder: 'e.g. http://archive.ubuntu.com/ubuntu/' },
  { key: 'rhel', label: 'RHEL / Alma / Rocky / CentOS', badge: 'DNF/YUM', icon: '🔴', placeholder: 'e.g. http://mirror.stream.centos.org/' },
  { key: 'alpine', label: 'Alpine Linux', badge: 'APK', icon: '🏔️', placeholder: 'e.g. http://dl-cdn.alpinelinux.org/alpine/' },
  { key: 'archlinux', label: 'Arch Linux', badge: 'Pacman', icon: '🏹', placeholder: 'e.g. https://geo.mirror.pkgbuild.com/$repo/os/$arch' },
  { key: 'opensuse', label: 'openSUSE', badge: 'Zypper', icon: '🦎', placeholder: 'e.g. http://download.opensuse.org/' },
];

export default function Groups() {
  const { apiFetch } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // JSON editor modal
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonContent, setJsonContent] = useState('');

  const defaultFormData = {
    name: '',
    description: '',
    timezone: 'Europe/Warsaw',
    locale: 'en_US.UTF-8',
    nameservers: '1.1.1.1, 8.8.8.8',
    apt_mirror: '',
    region_code: 'EU',
    package_mirrors: {
      debian: '',
      ubuntu: '',
      rhel: '',
      alpine: '',
      archlinux: '',
      opensuse: '',
    },
    custom_script: '',
  };

  const [formData, setFormData] = useState(defaultFormData);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadingCatalog, setReloadingCatalog] = useState(false);
  const [testingAllMirrors, setTestingAllMirrors] = useState(false);
  const [testingSingleMirror, setTestingSingleMirror] = useState({});
  const [mirrorTestResults, setMirrorTestResults] = useState({});

  const fetchGroups = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setMirrorTestResults({});
    setTestingSingleMirror({});
    setIsModalOpen(true);
  };

  const applyPreset = (preset) => {
    setMirrorTestResults({});
    setFormData({
      ...formData,
      name: preset.name,
      description: preset.description,
      timezone: preset.timezone,
      locale: preset.locale,
      nameservers: preset.nameservers,
      region_code: preset.region_code,
      apt_mirror: preset.apt_mirror || '',
      package_mirrors: {
        debian: preset.package_mirrors?.debian || preset.apt_mirror || '',
        ubuntu: preset.package_mirrors?.ubuntu || preset.apt_mirror || '',
        rhel: preset.package_mirrors?.rhel || '',
        alpine: preset.package_mirrors?.alpine || '',
        archlinux: preset.package_mirrors?.archlinux || '',
        opensuse: preset.package_mirrors?.opensuse || '',
      },
    });
  };

  const openEditModal = (group) => {
    setEditingId(group.id);
    setMirrorTestResults({});
    setTestingSingleMirror({});
    let mirrors = {};
    if (typeof group.package_mirrors === 'object' && group.package_mirrors !== null) {
      mirrors = group.package_mirrors;
    } else if (typeof group.package_mirrors === 'string') {
      try { mirrors = JSON.parse(group.package_mirrors); } catch (_) {}
    }
    setFormData({
      name: group.name,
      description: group.description || '',
      timezone: group.timezone || 'UTC',
      locale: group.locale || 'en_US.UTF-8',
      nameservers: group.nameservers || '1.1.1.1, 8.8.8.8',
      region_code: group.region_code || 'GLOBAL',
      apt_mirror: group.apt_mirror || '',
      package_mirrors: {
        debian: mirrors.debian || group.apt_mirror || '',
        ubuntu: mirrors.ubuntu || group.apt_mirror || '',
        rhel: mirrors.rhel || '',
        alpine: mirrors.alpine || '',
        archlinux: mirrors.archlinux || '',
        opensuse: mirrors.opensuse || '',
      },
      custom_script: group.custom_script || '',
    });
    setIsModalOpen(true);
  };

  const handleMirrorChange = (distroKey, value) => {
    setFormData((prev) => ({
      ...prev,
      package_mirrors: { ...(prev.package_mirrors || {}), [distroKey]: value },
    }));
    setMirrorTestResults((prev) => {
      const copy = { ...prev };
      delete copy[distroKey];
      return copy;
    });
  };

  const handleTestAllMirrors = async () => {
    if (!formData.package_mirrors) return;
    setTestingAllMirrors(true);
    try {
      const res = await apiFetch('/api/groups/test-mirrors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mirrors: formData.package_mirrors }),
      });
      if (res.ok) {
        const data = await res.json();
        setMirrorTestResults((prev) => ({ ...prev, ...(data.results || {}) }));
      }
    } catch (err) {
      console.error('Failed to test package mirrors:', err);
    } finally {
      setTestingAllMirrors(false);
    }
  };

  const handleTestSingleMirror = async (distroKey) => {
    const url = formData.package_mirrors?.[distroKey];
    if (!url || !url.trim()) return;

    setTestingSingleMirror((prev) => ({ ...prev, [distroKey]: true }));
    try {
      const res = await apiFetch('/api/groups/test-mirrors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMirrorTestResults((prev) => ({
          ...prev,
          [distroKey]: data.result || { ok: data.ok },
        }));
      }
    } catch (err) {
      setMirrorTestResults((prev) => ({
        ...prev,
        [distroKey]: { ok: false, error: err.message },
      }));
    } finally {
      setTestingSingleMirror((prev) => ({ ...prev, [distroKey]: false }));
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete group '${name}'?`)) return;
    try {
      await apiFetch(`/api/groups/${id}`, { method: 'DELETE' });
      fetchGroups();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingId ? `/api/groups/${editingId}` : '/api/groups';
      const method = editingId ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchGroups();
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

  const openJsonEditor = async () => {
    try {
      const res = await apiFetch('/api/groups/catalog-json');
      if (res.ok) {
        const data = await res.json();
        setJsonContent(JSON.stringify(data, null, 2));
        setIsJsonModalOpen(true);
      }
    } catch (err) {
      alert(`Failed to load groups JSON: ${err.message}`);
    }
  };

  const handleSaveJson = async () => {
    setSubmitting(true);
    try {
      const parsed = JSON.parse(jsonContent);
      const res = await apiFetch('/api/groups/catalog-json', {
        method: 'PUT',
        body: JSON.stringify(parsed),
      });

      if (res.ok) {
        setIsJsonModalOpen(false);
        fetchGroups();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      alert(`Invalid JSON format: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReloadCatalog = async () => {
    setReloadingCatalog(true);
    try {
      const res = await apiFetch('/api/groups/reload-catalog', { method: 'POST' });
      if (res.ok) {
        await fetchGroups();
      }
    } catch (err) {
      alert(`Reload failed: ${err.message}`);
    } finally {
      setReloadingCatalog(false);
    }
  };

  const getLocalTime = (tz) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date());
    } catch (_) {
      return '—';
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="panel-title">
              <Globe size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span>Regional & Localization Standards</span>
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Standard regional presets: Central Europe, US Central, Canada Central, China Mainland, India, and Global UTC. Synced with <code style={{ color: 'var(--accent-cyan)' }}>/data/configs/localization_groups.json</code>.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchGroups(true)}
              disabled={refreshing || loading}
              title="Refresh groups list"
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleReloadCatalog}
              disabled={reloadingCatalog}
              title="Sync from localization_groups.json"
            >
              <RefreshCw size={14} className={reloadingCatalog ? 'spin' : ''} />
              <span>{reloadingCatalog ? 'Syncing...' : 'Sync from File'}</span>
            </button>

            <button className="btn btn-secondary btn-sm" onClick={openJsonEditor} title="Edit raw JSON file">
              <FileCode size={14} />
              <span>Edit JSON</span>
            </button>

            <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
              <Plus size={16} />
              <span>Create Group</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            Loading localization groups...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {groups.map((group) => {
              const regBadge = REGION_BADGES[group.region_code] || REGION_BADGES.GLOBAL;
              const currentTime = getLocalTime(group.timezone);

              return (
                <div
                  key={group.id}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderTop: `3px solid ${regBadge.border}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ fontSize: '15.5px', fontWeight: 700, color: '#fff' }}>
                        {group.name}
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: regBadge.bg,
                          color: regBadge.text,
                          border: `1px solid ${regBadge.border}40`,
                        }}
                      >
                        {regBadge.label}
                      </span>
                    </div>

                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
                      {group.description || 'Regional localization preset.'}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <Clock size={14} style={{ color: 'var(--accent-cyan)' }} />
                          <span>Timezone:</span>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ color: '#fff' }}>{group.timezone}</strong>
                          <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.1)', padding: '1px 6px', borderRadius: '3px' }}>
                            {currentTime}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <MapPin size={14} style={{ color: '#a855f7' }} />
                          <span>System Locale:</span>
                        </span>
                        <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{group.locale}</strong>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <Server size={14} style={{ color: '#10b981' }} />
                          <span>DNS Nameservers:</span>
                        </span>
                        <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          {group.nameservers || '1.1.1.1, 8.8.8.8'}
                        </strong>
                      </div>

                      {/* Configured Package Mirrors Preview */}
                      {(() => {
                        let mirrors = group.package_mirrors;
                        if (typeof mirrors === 'string') {
                          try { mirrors = JSON.parse(mirrors); } catch (_) { mirrors = {}; }
                        }
                        const activeMirrors = Object.entries(mirrors || {}).filter(([_, url]) => url && url.trim());
                        if (activeMirrors.length === 0 && !group.apt_mirror) return null;

                        return (
                          <div style={{ fontSize: '11.5px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }}>
                            <div style={{ color: 'var(--text-muted)', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>Package Mirrors:</span>
                              <span className="badge badge-cyan" style={{ fontSize: '10px', padding: '1px 5px' }}>
                                {activeMirrors.length > 0 ? `${activeMirrors.length} Configured` : 'Legacy APT'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {activeMirrors.map(([distro, url]) => (
                                <span
                                  key={distro}
                                  style={{
                                    fontSize: '10px',
                                    fontFamily: 'var(--font-mono)',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    backgroundColor: 'rgba(0, 192, 243, 0.1)',
                                    color: 'var(--accent-cyan)',
                                    border: '1px solid rgba(0, 192, 243, 0.25)',
                                  }}
                                  title={`${distro}: ${url}`}
                                >
                                  {distro.toUpperCase()}
                                </span>
                              ))}
                              {activeMirrors.length === 0 && group.apt_mirror && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontFamily: 'var(--font-mono)',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    backgroundColor: 'rgba(0, 192, 243, 0.1)',
                                    color: 'var(--accent-cyan)',
                                    border: '1px solid rgba(0, 192, 243, 0.25)',
                                    maxWidth: '200px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  title={group.apt_mirror}
                                >
                                  {group.apt_mirror}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
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
                    <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(group)}>
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(group.id, group.name)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Group Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Localization Group' : 'Create Regional Group'}
        maxWidth="680px"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Group'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {!editingId && (
            <div style={{ marginBottom: '18px', padding: '12px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '8px' }}>
                <Sparkles size={14} />
                <span>Quick Fill from Standard Regional Presets:</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {PRESETS.map((p) => (
                  <button
                    key={p.region_code}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11.5px', padding: '4px 8px' }}
                    onClick={() => applyPreset(p)}
                  >
                    {REGION_BADGES[p.region_code]?.label || p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Group / Client Name *</label>
            <input
              type="text"
              className="form-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Central Europe (EU)"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Regional Standard Code</label>
              <select
                className="form-control"
                value={formData.region_code}
                onChange={(e) => setFormData({ ...formData, region_code: e.target.value })}
              >
                <option value="EU">🇪🇺 Central Europe (EU)</option>
                <option value="US">🇺🇸 US Central (US)</option>
                <option value="CA">🇨🇦 Canada Central (CA)</option>
                <option value="CN">🇨🇳 China Mainland (CN)</option>
                <option value="IN">🇮🇳 India (IN)</option>
                <option value="GLOBAL">🌐 Global Standard (UTC)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Timezone *</label>
              <input
                type="text"
                className="form-control"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                placeholder="e.g. Europe/Warsaw, America/Chicago, Asia/Shanghai"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">System Locale</label>
              <input
                type="text"
                className="form-control"
                value={formData.locale}
                onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
                placeholder="en_US.UTF-8"
              />
            </div>

            <div className="form-group">
              <label className="form-label">DNS Nameservers</label>
              <input
                type="text"
                className="form-control"
                value={formData.nameservers}
                onChange={(e) => setFormData({ ...formData, nameservers: e.target.value })}
                placeholder="1.1.1.1, 8.8.8.8 or 223.5.5.5, 119.29.29.29"
              />
            </div>
          </div>

          {/* Regional Package Mirrors By Distribution */}
          <div
            style={{
              marginTop: '16px',
              marginBottom: '16px',
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontWeight: 600, color: '#fff', fontSize: '13.5px' }}>
                  Regional Package Mirrors (By Distribution)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11.5px', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  onClick={handleTestAllMirrors}
                  disabled={testingAllMirrors || Object.values(formData.package_mirrors || {}).every((u) => !u || !u.trim())}
                  title="Test HTTP connectivity for all entered repository URLs"
                >
                  <RefreshCw size={12} className={testingAllMirrors ? 'spin' : ''} />
                  <span>{testingAllMirrors ? 'Testing All...' : 'Test All Mirrors'}</span>
                </button>
              </div>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
              Configure regional or internal repository mirrors for each distribution. If left blank, official default upstream mirrors are used.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {DISTRO_OPTIONS.map((d) => {
                const url = formData.package_mirrors?.[d.key] || '';
                const testRes = mirrorTestResults[d.key];
                const isTestingThis = testingSingleMirror[d.key] || (testingAllMirrors && !!url.trim());

                return (
                  <div key={d.key} className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label className="form-label" style={{ fontSize: '12px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{d.icon}</span>
                        <span style={{ fontWeight: 600 }}>{d.label}</span>
                        <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                          {d.badge}
                        </span>
                      </label>
                      {url.trim() && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', padding: '2px 7px', height: '22px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => handleTestSingleMirror(d.key)}
                          disabled={isTestingThis}
                          title={`Test connectivity to ${d.label} mirror`}
                        >
                          <RefreshCw size={10} className={isTestingThis ? 'spin' : ''} />
                          <span>{isTestingThis ? 'Testing...' : 'Test'}</span>
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                      value={url}
                      onChange={(e) => handleMirrorChange(d.key, e.target.value)}
                      placeholder={d.placeholder}
                    />

                    <div style={{ marginTop: '5px', minHeight: '18px', display: 'flex', alignItems: 'center' }}>
                      {testRes ? (
                        testRes.ok ? (
                          <span style={{ color: '#4ade80', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} />
                            <span>Reachable (HTTP {testRes.status || 200}{testRes.latencyMs ? `, ${testRes.latencyMs}ms` : ''})</span>
                          </span>
                        ) : (
                          <span style={{ color: '#f87171', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={testRes.error}>
                            <AlertCircle size={12} />
                            <span style={{ maxWidth: '270px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Failed: {testRes.error}
                            </span>
                          </span>
                        )
                      ) : url.trim() ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Click 'Test' to check repository reachability</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', opacity: 0.7, fontSize: '11px' }}>Using official default upstream</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <input
              type="text"
              className="form-control"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Regional datacenter and mirror details..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Custom Group Setup Script (Optional)</label>
            <textarea
              rows="2"
              className="form-control"
              value={formData.custom_script}
              onChange={(e) => setFormData({ ...formData, custom_script: e.target.value })}
              placeholder="#!/bin/bash\n# regional commands..."
            />
          </div>
        </form>
      </Modal>

      {/* JSON File Editor Modal */}
      <Modal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        title="Direct Edit: localization_groups.json"
        maxWidth="800px"
        footer={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsJsonModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveJson} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save & Synchronize'}
            </button>
          </>
        }
      >
        <div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            This configuration is saved in <code style={{ color: 'var(--accent-cyan)' }}>/data/configs/localization_groups.json</code> and mounted on your host at <code style={{ color: '#fff' }}>./data/configs/localization_groups.json</code>.
          </p>
          <textarea
            rows="18"
            className="form-control"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.4 }}
            value={jsonContent}
            onChange={(e) => setJsonContent(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
