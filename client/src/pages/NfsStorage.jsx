import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Server,
  HardDrive,
  RefreshCw,
  RotateCw,
  Copy,
  Check,
  Shield,
  CheckCircle2,
  XCircle,
  Network,
  Terminal,
  ExternalLink,
  Layers,
  Archive,
  ArrowRight,
} from 'lucide-react';

export default function NfsStorage({ setCurrentPage }) {
  const { apiFetch } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // Form states
  const [selectedHostIp, setSelectedHostIp] = useState('');
  const [customHostIpInput, setCustomHostIpInput] = useState('');
  const [allowedIpsInput, setAllowedIpsInput] = useState('*');

  const fetchStatus = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const res = await apiFetch('/api/nfs/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);

        // Determine best initial Server host
        const browserHost = window.location.hostname;
        const isInternalIp = (ip) => !ip || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) || ip === 'localhost' || ip === '127.0.0.1' || ip === 'YOUR_SERVER_IP';

        // 1. If physical host LAN IP is detected, it is the primary choice
        const hostIpObj = data.detected_ips?.find((i) => i.isHost);

        if (data.server_host && !isInternalIp(data.server_host)) {
          setSelectedHostIp(data.server_host);
        } else if (browserHost && !isInternalIp(browserHost)) {
          setSelectedHostIp(browserHost);
        } else if (hostIpObj?.address) {
          setSelectedHostIp(hostIpObj.address);
        } else if (data.server_host && data.server_host !== 'YOUR_SERVER_IP') {
          setSelectedHostIp(data.server_host);
        } else {
          setSelectedHostIp(browserHost || 'YOUR_SERVER_IP');
        }

        setAllowedIpsInput(data.allowed_ips || '*');
      }
    } catch (err) {
      console.error('Failed to fetch NFS status:', err);
      setActionMessage({ type: 'error', text: `Failed to fetch status: ${err.message}` });
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(false), 8000);
    return () => clearInterval(interval);
  }, []);

  const handleRestart = async () => {
    setRestarting(true);
    setActionMessage(null);
    try {
      const res = await apiFetch('/api/nfs/restart', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage({ type: 'success', text: 'NFS-Ganesha daemon restarted successfully!' });
        if (data.status) setStatus(data.status);
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to restart NFS daemon.' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: `Restart failed: ${err.message}` });
    } finally {
      setRestarting(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const handleSaveConfig = async (e) => {
    e?.preventDefault();
    setSavingConfig(true);
    setActionMessage(null);
    try {
      const payload = {
        allowed_ips: allowedIpsInput.trim() || '*',
        server_host: (customHostIpInput.trim() || selectedHostIp || '').trim(),
      };
      const res = await apiFetch('/api/nfs/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage({ type: 'success', text: 'NFS access restrictions updated and applied!' });
        if (data.status) setStatus(data.status);
        if (payload.server_host) setSelectedHostIp(payload.server_host);
        setCustomHostIpInput('');
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to update NFS configuration.' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: `Configuration failed: ${err.message}` });
    } finally {
      setSavingConfig(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const copyToClipboard = (text, keyName) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isInternalIp = (ip) => !ip || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) || ip === 'localhost' || ip === '127.0.0.1' || ip === 'YOUR_SERVER_IP';
  const effectiveServerHost = selectedHostIp || (!isInternalIp(status?.server_host) ? status?.server_host : null) || (!isInternalIp(window.location.hostname) ? window.location.hostname : null) || status?.server_host || '127.0.0.1';
  const exportPath = status?.export_path || '/export';
  const pvesmCommand = `pvesm add nfs os-builder-storage --server ${effectiveServerHost} --export ${exportPath} --content backup --options ro`;
  const allParamsFormatted = `ID: os-builder-storage\nServer: ${effectiveServerHost}\nExport: ${exportPath}\nContent: Backup`;

  // Aggregate candidate IPs (prioritize real host LAN IP first)
  const candidateIps = [];

  if (status?.detected_ips) {
    // Primary auto-detected IP first
    status.detected_ips
      .filter((i) => i.isPrimary)
      .forEach((item) => {
        candidateIps.push({
          label: item.label || 'Host Primary LAN (Recommended)',
          ip: item.address,
          isHost: true,
          isPrimary: true,
          source: 'Host Primary',
        });
      });

    // Other host interfaces (physical/bridges)
    status.detected_ips
      .filter((i) => i.isHost && !i.isPrimary)
      .forEach((item) => {
        if (!candidateIps.some((i) => i.ip === item.address)) {
          candidateIps.push({
            label: item.label || `Host Interface (${item.interface})`,
            ip: item.address,
            isHost: true,
            source: 'Host Interface',
          });
        }
      });
  }

  // Browser access host second (if not duplicate and not localhost)
  if (
    window.location.hostname &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    !candidateIps.some((i) => i.ip === window.location.hostname)
  ) {
    candidateIps.push({
      label: 'Browser Host IP / Domain',
      ip: window.location.hostname,
      source: 'Client Web Browser',
      isBrowser: true,
    });
  }

  // Other internal bridges / virtual interfaces
  if (status?.detected_ips) {
    status.detected_ips
      .filter((i) => !i.isHost)
      .forEach((item) => {
        if (!candidateIps.some((i) => i.ip === item.address)) {
          candidateIps.push({
            label: item.label || item.interface || 'Interface',
            ip: item.address,
            isDockerBridge: item.isDockerBridge,
            source: 'Docker Internal',
          });
        }
      });
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Action Notification */}
      {actionMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            color: actionMessage.type === 'success' ? '#34d399' : '#f87171',
            fontSize: '13.5px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Status & Controls Header */}
      <div
        className="panel"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(17, 24, 39, 0.95) 100%)',
          border: '1px solid rgba(11, 224, 199, 0.3)',
          marginBottom: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            paddingBottom: '20px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(11, 224, 199, 0.15)',
                border: '1px solid rgba(11, 224, 199, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)',
              }}
            >
              <Server size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Proxmox VE Native Storage (NFS)
                </h1>
                {status?.running ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 9px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    Active & Serving
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 9px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                    Stopped
                  </span>
                )}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Connect this container directly to Proxmox VE as a read-only NFS backup repository. Restore any VM template directly with zero manual file downloads.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => fetchStatus(true)}
              disabled={refreshing || loading}
              title="Refresh service metrics"
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleRestart}
              disabled={restarting}
              style={{ borderColor: 'rgba(11, 224, 199, 0.4)', color: 'var(--accent-cyan)' }}
              title="Restart NFS-Ganesha daemon and rpcbind"
            >
              <RotateCw size={14} className={restarting ? 'spin' : ''} />
              <span>{restarting ? 'Restarting NFS...' : 'Restart Service'}</span>
            </button>
          </div>
        </div>

        {/* Telemetry Metrics Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '20px',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              NFS Daemon (ganesha.nfsd)
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginTop: '4px' }}>
              {status?.running ? `PID ${status?.pid || 'Active'}` : 'Offline'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginTop: '2px' }}>
              Port 2049 (TCP/UDP)
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              RPC Portmapper (rpcbind)
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginTop: '4px' }}>
              {status?.rpcbind_running ? 'Active & Registered' : 'Inactive'}
            </div>
            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '2px' }}>
              Port 111 (TCP/UDP)
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              NFSv4 Export Share
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {status?.export_path || '/export'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              V3 Path: {status?.export_path_v3 || '/data/repository'}
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Exported Templates
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginTop: '4px' }}>
              {status?.template_count || 0} archives
            </div>
            <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '2px' }}>
              {status?.total_size_mb || 0} MB ready for restore
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Proxmox VE Connection Parameters & Network Access Restrictions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px' }}>
        {/* Proxmox VE Parameters Card */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={18} style={{ color: 'var(--accent-cyan)' }} />
              <h2 className="panel-title">Proxmox VE Storage Parameters</h2>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => copyToClipboard(allParamsFormatted, 'all_params')}
              title="Copy all parameters"
            >
              {copiedKey === 'all_params' ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
              <span>{copiedKey === 'all_params' ? 'Copied All' : 'Copy All'}</span>
            </button>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            In Proxmox VE GUI, navigate to <strong>Datacenter &rarr; Storage &rarr; Add &rarr; NFS</strong> and enter these exact parameters:
          </p>

          {/* Formatted Parameter Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* ID */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ width: '80px', fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  ID:
                </span>
                <code style={{ fontSize: '14px', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                  os-builder-storage
                </code>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard('os-builder-storage', 'id')}
              >
                {copiedKey === 'id' ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                <span>{copiedKey === 'id' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Server */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(11, 224, 199, 0.4)',
                boxShadow: '0 0 10px rgba(11, 224, 199, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ width: '80px', fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  Server:
                </span>
                <code style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                  {effectiveServerHost}
                </code>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard(effectiveServerHost, 'server')}
              >
                {copiedKey === 'server' ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                <span>{copiedKey === 'server' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Export */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ width: '80px', fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  Export:
                </span>
                <code style={{ fontSize: '14px', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                  {exportPath}
                </code>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard(exportPath, 'export')}
              >
                {copiedKey === 'export' ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                <span>{copiedKey === 'export' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Content */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ width: '80px', fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  Content:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code style={{ fontSize: '14px', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                    Backup
                  </code>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    (VZDump backup file)
                  </span>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard('Backup', 'content')}
              >
                {copiedKey === 'content' ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                <span>{copiedKey === 'content' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Detected Server IP Selection */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Detected Host & Network IPs (Click to select for Server parameter):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {candidateIps.map((cand) => {
                const isSelected = effectiveServerHost === cand.ip;
                return (
                  <button
                    key={cand.ip}
                    type="button"
                    onClick={() => setSelectedHostIp(cand.ip)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSelected
                        ? 'rgba(11, 224, 199, 0.2)'
                        : cand.isHost
                        ? 'rgba(56, 189, 248, 0.12)'
                        : 'var(--bg-card)',
                      border: `1px solid ${
                        isSelected
                          ? 'var(--accent-cyan)'
                          : cand.isHost
                          ? 'rgba(56, 189, 248, 0.45)'
                          : 'var(--border-color)'
                      }`,
                      color: isSelected ? 'var(--accent-cyan)' : cand.isHost ? '#38bdf8' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: cand.isDockerBridge ? 0.6 : 1,
                    }}
                    title={
                      cand.isDockerBridge
                        ? 'Container internal bridge IP (Cannot be reached from external Proxmox node)'
                        : cand.isHost
                        ? 'Real Host LAN IP (Reachable by external Proxmox nodes)'
                        : cand.label
                    }
                  >
                    <Network size={13} />
                    <strong>{cand.ip}</strong>
                    <span style={{ opacity: 0.8, fontSize: '11px' }}>({cand.label})</span>
                    {cand.isHost && (
                      <span className="badge badge-success" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: '2px' }}>
                        Host LAN
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Host IP / Domain Input */}
            <form onSubmit={handleSaveConfig} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '12.5px', padding: '7px 10px' }}
                placeholder="Or specify custom server IP / FQDN..."
                value={customHostIpInput}
                onChange={(e) => setCustomHostIpInput(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
                disabled={savingConfig || !customHostIpInput.trim()}
                style={{ whiteSpace: 'nowrap' }}
              >
                {savingConfig ? <RefreshCw size={12} className="spin" /> : null}
                <span>Set Custom IP</span>
              </button>
            </form>
          </div>

          {/* Proxmox CLI Command */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Proxmox Node One-Line Shell Command:
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard(pvesmCommand, 'cli_cmd')}
              >
                {copiedKey === 'cli_cmd' ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                <span>{copiedKey === 'cli_cmd' ? 'Copied' : 'Copy Command'}</span>
              </button>
            </div>
            <pre
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                color: 'var(--accent-cyan)',
                overflowX: 'auto',
                border: '1px solid var(--border-color)',
                margin: 0,
              }}
            >
              {pvesmCommand}
            </pre>
          </div>
        </div>

        {/* IP Restriction & Security Card */}
        <div className="panel" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} style={{ color: 'var(--accent-cyan)' }} />
              <h2 className="panel-title">NFS Client Access Restriction</h2>
            </div>
            <span className="badge badge-os">Security</span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Control which Proxmox nodes or subnets are permitted to mount this NFS export. By default, access is open to all clients (<code style={{ color: 'var(--accent-cyan)' }}>*</code>).
          </p>

          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Allowed Client IPs / CIDR Subnets:
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 192.168.1.0/24, 10.0.0.50 or * for any"
                value={allowedIpsInput}
                onChange={(e) => setAllowedIpsInput(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                Comma-separated IP addresses or CIDR blocks. Set to <code style={{ color: 'var(--accent-cyan)' }}>*</code> to allow all cluster nodes.
              </span>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                <span>Read-Only & Squash Safeguards</span>
              </div>
              The NFS export is mounted with strict <code style={{ color: 'var(--accent-cyan)' }}>Access_Type = RO</code> and <code style={{ color: 'var(--accent-cyan)' }}>Squash = All_Squash</code>. Proxmox nodes can read and restore templates immediately, but cannot alter or delete repository archives.
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingConfig}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {savingConfig ? <RefreshCw size={14} className="spin" /> : <Shield size={14} />}
                <span>{savingConfig ? 'Applying Security Rules...' : 'Save & Apply IP Rules'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Step-by-Step Proxmox VE Integration Walkthrough */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--accent-cyan)' }} />
            <h2 className="panel-title">How to Mount & Restore in Proxmox VE</h2>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage && setCurrentPage('repository')}
          >
            <Archive size={13} />
            <span>View Ready Templates</span>
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            marginTop: '8px',
          }}
        >
          {/* Step 1 */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(11, 224, 199, 0.15)',
                color: 'var(--accent-cyan)',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
              }}
            >
              1
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
              Add NFS Storage in Proxmox
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
              Open Proxmox VE Web GUI. In the left tree, select <strong>Datacenter</strong> &rarr; <strong>Storage</strong> &rarr; <strong>Add</strong> &rarr; <strong>NFS</strong>.
            </p>
          </div>

          {/* Step 2 */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(11, 224, 199, 0.15)',
                color: 'var(--accent-cyan)',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
              }}
            >
              2
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
              Fill Required Parameters
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
              Enter <strong>ID</strong>: <code style={{ color: 'var(--accent-cyan)' }}>os-builder-storage</code>, <strong>Server</strong>: <code style={{ color: 'var(--accent-cyan)' }}>{effectiveServerHost}</code>, <strong>Export</strong>: <code style={{ color: 'var(--accent-cyan)' }}>/export</code>, and choose <strong>Content</strong>: <code style={{ color: 'var(--accent-cyan)' }}>Backup</code>.
            </p>
          </div>

          {/* Step 3 */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(11, 224, 199, 0.15)',
                color: 'var(--accent-cyan)',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
              }}
            >
              3
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
              Save & Mount
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
              Click <strong>Add</strong>. Proxmox will connect over port 2049. A green active icon will appear under your cluster storage list.
            </p>
          </div>

          {/* Step 4 */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(11, 224, 199, 0.15)',
                color: 'var(--accent-cyan)',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
              }}
            >
              4
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>
              Restore Direct to VM
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
              Select <strong>os-builder-storage &rarr; Backups</strong>, pick any template, and click <strong>Restore</strong>. The VM is instantly created on your target storage!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
