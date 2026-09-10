import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Settings as SettingsIcon,
  HardDrive,
  Cpu,
  Shield,
  Server,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';

export default function Settings() {
  const { apiFetch } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSettings = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading && !settings) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div>
      {/* Storage Paths Panel */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">
            <HardDrive size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span>Storage Paths & Mounted Volumes</span>
          </h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchSettings(true)}
            disabled={refreshing || loading}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>
          Separated paths for downloads, configuration presets, database, and ready template outputs. Mount these in Docker Compose to persist data.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Database Path (SQLite)
            </div>
            <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#fff', wordBreak: 'break-all' }}>
              {settings?.paths?.dbPath}
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Base Images Download Cache
            </div>
            <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
              {settings?.paths?.downloadsDir}
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Configuration Presets Directory
            </div>
            <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#a855f7', wordBreak: 'break-all' }}>
              {settings?.paths?.configsDir}
            </div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
              Ready Templates Repository Output
            </div>
            <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-success)', wordBreak: 'break-all' }}>
              {settings?.paths?.outputDir}
            </div>
          </div>
        </div>
      </div>

      {/* Utilities & System Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <Cpu size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span>Image Creation Toolchain</span>
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {settings?.tools &&
              Object.entries(settings.tools).map(([tool, ready]) => (
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
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#fff', fontSize: '13px' }}>{tool}</span>
                  {ready ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)', fontSize: '12px', fontWeight: 600 }}>
                      <CheckCircle size={15} />
                      <span>Installed</span>
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      <XCircle size={15} />
                      <span>Not present on host</span>
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <Server size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span>System & Environment</span>
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Admin User:</span>
              <strong style={{ color: '#fff' }}>{settings?.auth?.adminUser}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Server Port:</span>
              <strong style={{ color: '#fff' }}>{settings?.app?.port}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Platform / Arch:</span>
              <strong style={{ color: '#fff' }}>{settings?.system?.platform} / {settings?.system?.arch}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Node.js Version:</span>
              <strong style={{ color: '#fff' }}>{settings?.system?.nodeVersion}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>System Memory:</span>
              <strong style={{ color: '#fff' }}>
                {settings?.system?.memoryFree} free of {settings?.system?.memoryTotal}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
