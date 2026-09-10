import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  DownloadCloud,
  Sliders,
  Globe,
  Archive,
  HardDrive,
  Cpu,
  Server,
  RefreshCw,
  CheckCircle,
  XCircle,
  Play,
  ArrowRight,
} from 'lucide-react';

export default function Dashboard({ setCurrentPage }) {
  const { apiFetch } = useAuth();
  const [stats, setStats] = useState(null);
  const [nfsStatus, setNfsStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAllData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [statsRes, nfsRes] = await Promise.allSettled([
        apiFetch('/api/dashboard/stats'),
        apiFetch('/api/nfs/status'),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setStats(data);
      }
      if (nfsRes.status === 'fulfilled' && nfsRes.value.ok) {
        const nfsData = await nfsRes.value.json();
        setNfsStatus(nfsData);
      }
    } catch (err) {
      console.error('Failed to load dashboard telemetry:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => fetchAllData(false), 6000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  if (loading && !stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <RefreshCw className="spin" size={24} style={{ color: 'var(--accent-cyan)', marginRight: '10px' }} />
        <span style={{ color: 'var(--text-muted)' }}>Loading system telemetry...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fetchAllData(true)}
          disabled={refreshing || loading}
          title="Refresh system telemetry"
        >
          <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
        </button>
      </div>

      {/* NFS Proxmox Storage Status Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid rgba(11, 224, 199, 0.3)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          flexWrap: 'wrap',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(17, 24, 39, 0.95) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              padding: '10px',
              backgroundColor: 'rgba(11, 224, 199, 0.12)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Server size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>
                Proxmox VE Native Storage (NFS)
              </span>
              {nfsStatus?.running ? (
                <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
                  Online (Port 2049)
                </span>
              ) : (
                <span className="badge badge-danger" style={{ fontSize: '10.5px' }}>
                  Offline
                </span>
              )}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Export: <code style={{ color: 'var(--accent-cyan)' }}>/export</code> &bull; Ready for instant Proxmox cluster restore ({nfsStatus?.template_count || stats?.repository?.templatesCount || 0} templates available).
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => setCurrentPage('nfs-storage')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span>Connect Proxmox VE</span>
          <ArrowRight size={14} />
        </button>
      </div>
      {/* Metrics Row */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => setCurrentPage('base-images')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="stat-title">Base OS Images</div>
            <div className="stat-value">
              {stats?.baseImages?.downloaded || 0}{' '}
              <span style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 400 }}>
                / {stats?.baseImages?.total || 0}
              </span>
            </div>
            <div className="stat-desc">
              {stats?.baseImages?.downloaded || 0} ready in downloads cache
            </div>
          </div>
          <div className="stat-icon" style={{ background: 'var(--accent-cyan-glow)', color: 'var(--accent-cyan)' }}>
            <DownloadCloud size={22} />
          </div>
        </div>

        <div className="stat-card" onClick={() => setCurrentPage('profiles')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="stat-title">OS Profiles</div>
            <div className="stat-value">{stats?.profiles?.total || 0}</div>
            <div className="stat-desc">Cloud-init & Root SSH rules</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Sliders size={22} />
          </div>
        </div>

        <div className="stat-card" onClick={() => setCurrentPage('groups')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="stat-title">Localization Groups</div>
            <div className="stat-value">{stats?.groups?.total || 0}</div>
            <div className="stat-desc">Timezone & locale presets</div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <Globe size={22} />
          </div>
        </div>

        <div className="stat-card" onClick={() => setCurrentPage('repository')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="stat-title">Ready PVE Templates</div>
            <div className="stat-value">{stats?.repository?.templatesCount || 0}</div>
            <div className="stat-desc">
              {formatBytes(stats?.repository?.totalBytes)} total storage
            </div>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Archive size={22} />
          </div>
        </div>
      </div>

      {/* Storage & Tools Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Storage Volume Breakdown */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h2 className="panel-title">
              <HardDrive size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span>Volume Storage Allocation</span>
            </h2>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Total: {formatBytes(stats?.storage?.totalBytes)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Base Images Cache (/data/downloads)</span>
                <span style={{ fontWeight: 600 }}>{formatBytes(stats?.storage?.downloadsBytes)}</span>
              </div>
              <div className="progress-container">
                <div
                  className="progress-bar"
                  style={{
                    width: `${stats?.storage?.totalBytes ? Math.min(100, ((stats.storage.downloadsBytes / stats.storage.totalBytes) * 100)) : 0}%`,
                    background: '#00c0f3',
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Ready Templates Repository (/data/repository)</span>
                <span style={{ fontWeight: 600 }}>{formatBytes(stats?.storage?.repositoryBytes)}</span>
              </div>
              <div className="progress-container">
                <div
                  className="progress-bar"
                  style={{
                    width: `${stats?.storage?.totalBytes ? Math.min(100, ((stats.storage.repositoryBytes / stats.storage.totalBytes) * 100)) : 0}%`,
                    background: '#10b981',
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>SQLite Database (/data/db)</span>
                <span style={{ fontWeight: 600 }}>{formatBytes(stats?.storage?.databaseBytes)}</span>
              </div>
              <div className="progress-container">
                <div
                  className="progress-bar"
                  style={{
                    width: '5%',
                    background: '#8b5cf6',
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Engine CLI Tools Status */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h2 className="panel-title">
              <Cpu size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span>Container Packaging Utilities</span>
            </h2>
            <span className="badge badge-info">Containerized</span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            All tools are packaged directly into the container image for complete offline autonomy.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {stats?.tools &&
              Object.entries(stats.tools).map(([tool, ready]) => (
                <div
                  key={tool}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <code style={{ fontSize: '13px', color: '#fff', fontFamily: 'var(--font-mono)' }}>{tool}</code>
                  {ready ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)', fontSize: '12px', fontWeight: 600 }}>
                      <CheckCircle size={15} />
                      <span>Ready</span>
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      <XCircle size={15} />
                      <span>Fallback</span>
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Recent Builds Table */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">
            <span>Recent Template Builds</span>
          </h2>
          <button className="btn btn-primary btn-sm" onClick={() => setCurrentPage('builds')}>
            <Play size={14} />
            <span>Launch New Build</span>
          </button>
        </div>

        {(!stats?.recentBuilds || stats.recentBuilds.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
            No template builds recorded yet. Download a base image and launch your first Proxmox template build!
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Build #</th>
                  <th>Template Name</th>
                  <th>VMID</th>
                  <th>Base OS</th>
                  <th>Profile</th>
                  <th>Status</th>
                  <th>Output File</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentBuilds.map((build) => (
                  <tr key={build.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>#{build.build_number || build.id}</td>
                    <td style={{ color: '#fff', fontWeight: 600 }}>{build.template_name}</td>
                    <td>
                      <span className="badge badge-os">{build.vmid}</span>
                    </td>
                    <td>{build.base_image_name || 'Generic'}</td>
                    <td>{build.profile_name || 'Standard'}</td>
                    <td>
                      <span
                        className={`badge ${
                          build.status === 'completed'
                            ? 'badge-success'
                            : build.status === 'building'
                            ? 'badge-warning'
                            : build.status === 'failed'
                            ? 'badge-danger'
                            : 'badge-info'
                        }`}
                      >
                        {build.status}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {build.output_filename || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
