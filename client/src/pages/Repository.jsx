import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import {
  Archive,
  Download,
  Copy,
  Check,
  Trash2,
  HardDrive,
  RefreshCw,
  Terminal,
  Info,
  Server,
  ExternalLink,
  ShieldCheck,
  Zap,
  FileText,
} from 'lucide-react';

export default function Repository({ setCurrentPage }) {
  const { apiFetch } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedAction, setCopiedAction] = useState(null); // { id, type }
  const [isNfsModalOpen, setIsNfsModalOpen] = useState(false);
  const [nfsInfo, setNfsInfo] = useState(null);
  const [activeNotesTemplate, setActiveNotesTemplate] = useState(null);

  const fetchTemplates = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch('/api/repository');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  const fetchNfsInfo = async () => {
    try {
      const res = await apiFetch('/api/repository/nfs-info');
      if (res.ok) {
        const data = await res.json();
        setNfsInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch NFS info:', err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchNfsInfo();
  }, []);

  const isInternalIp = (ip) => !ip || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) || ip === 'localhost' || ip === '127.0.0.1' || ip === 'SERVER_IP' || ip === 'YOUR_SERVER_IP';
  const serverHost = (!isInternalIp(nfsInfo?.server) ? nfsInfo?.server : null) || (!isInternalIp(window.location.hostname) ? window.location.hostname : null) || nfsInfo?.server || 'SERVER_IP';
  const pvesmCliCmd = `pvesm add nfs os-builder-storage --server ${serverHost} --export /export --content backup --options ro`;

  const handleCopyText = (text, id, type) => {
    navigator.clipboard.writeText(text);
    setCopiedAction({ id, type });
    setTimeout(() => setCopiedAction(null), 2000);
  };

  const handleCopyUrl = (filename) => {
    const directUrl = `${window.location.origin}/repository/${encodeURIComponent(filename)}`;
    handleCopyText(directUrl, filename, 'url');
  };

  const handleCopyWget = (filename) => {
    const cmd = `wget -c ${window.location.origin}/repository/${encodeURIComponent(filename)} -P /var/lib/vz/dump/`;
    handleCopyText(cmd, filename, 'wget');
  };

  const handleCopyNfsRestore = (filename, vmid) => {
    const targetVmid = vmid || '9000';
    const cmd = `qmrestore os-builder-storage:backup/${filename} ${targetVmid} --storage local-lvm`;
    handleCopyText(cmd, filename, 'nfs-restore');
  };

  const handleDirectDownload = (filename) => {
    const directUrl = `/repository/${encodeURIComponent(filename)}`;
    window.open(directUrl, '_blank');
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Permanently delete template archive '${filename}' from repository?`)) return;
    try {
      await apiFetch(`/api/repository/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1900px', margin: '0 auto' }}>
      {/* NFS Proxmox Storage Integration Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '18px 22px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid rgba(11, 224, 199, 0.3)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px',
          flexWrap: 'wrap',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(17, 24, 39, 0.9) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
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
                Proxmox VE Native Storage Integration (NFS)
              </span>
              <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
                Zero File Transfers
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Mount this builder directly inside your Proxmox VE cluster as a native Read-Only <code style={{ color: 'var(--accent-cyan)' }}>backup</code> storage. Restore templates directly via GUI without manual downloads.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={() => (setCurrentPage ? setCurrentPage('nfs-storage') : setIsNfsModalOpen(true))}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Server size={15} />
            <span>Manage Proxmox Storage (NFS)</span>
          </button>
        </div>
      </div>

      {/* Main Repository Panel */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <Archive size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span>Ready Proxmox Templates Repository</span>
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Standard <code style={{ color: 'var(--accent-cyan)' }}>.vma.zst</code> archives with Proxmox companion notes. Compatible with both direct HTTP downloads and native Proxmox NFS storage restore.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <a href="/repo" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              <ExternalLink size={13} />
              <span>Public Web Mirror</span>
            </a>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchTemplates(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <RefreshCw className="spin" size={24} style={{ margin: '0 auto 12px' }} />
            <div>Loading templates repository...</div>
          </div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <HardDrive size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontSize: '15px', color: '#fff', marginBottom: '6px' }}>No templates in repository yet</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Launch a build in <strong style={{ color: 'var(--accent-cyan)' }}>Build Studio</strong> to generate a Proxmox template archive.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Template & Archive</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Size</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Base OS Image</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Group & Profile</th>
                  <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>SHA-256</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.filename}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#fff', fontSize: '13.5px' }}>{t.template_name}</span>
                        {t.vmid && (
                          <span className="badge" style={{ fontSize: '10px', padding: '2px 6px' }}>
                            VMID: {t.vmid}
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: '3px' }}>
                        <code style={{ fontSize: '11.5px', color: 'var(--accent-cyan)' }}>{t.filename}</code>
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 500 }}>{t.size_mb} MB</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {t.base_image_name ? (
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{t.base_image_name}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div>
                        {t.group_name ? (
                          <span className="badge badge-cyan" style={{ whiteSpace: 'nowrap' }}>{t.group_name}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                        {t.profile_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {t.sha256 ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            gap: '4px',
                          }}
                          onClick={() => handleCopyText(t.sha256, t.filename, 'sha256')}
                          title={`Copy SHA-256 Checksum:\n${t.sha256}`}
                        >
                          {copiedAction && copiedAction.id === t.filename && copiedAction.type === 'sha256' ? (
                            <>
                              <Check size={12} style={{ color: 'var(--color-success)' }} />
                              <span style={{ color: 'var(--color-success)' }}>Copied!</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={12} style={{ color: 'var(--accent-cyan)' }} />
                              <span>Copy SHA</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
                        {/* Row 1: Primary actions */}
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                          {/* Instant NFS Restore command */}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ borderColor: 'rgba(11, 224, 199, 0.4)', color: 'var(--accent-cyan)', padding: '3px 8px', fontSize: '11.5px' }}
                            onClick={() => handleCopyNfsRestore(t.filename, t.vmid)}
                            title="Copy Proxmox NFS restore command: qmrestore os-builder-storage:backup/..."
                          >
                            {copiedAction && copiedAction.id === t.filename && copiedAction.type === 'nfs-restore' ? (
                              <>
                                <Check size={12} style={{ color: 'var(--color-success)' }} />
                                <span style={{ color: 'var(--color-success)' }}>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Zap size={12} />
                                <span>qmrestore</span>
                              </>
                            )}
                          </button>

                          {/* View Proxmox Notes */}
                          {t.notes && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ borderColor: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8', padding: '3px 8px', fontSize: '11.5px' }}
                              onClick={() => setActiveNotesTemplate(t)}
                              title="View full OS specifications and Proxmox template notes"
                            >
                              <FileText size={12} />
                              <span>Notes</span>
                            </button>
                          )}

                          {/* Direct Download */}
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ padding: '3px 10px', fontSize: '11.5px' }}
                            onClick={() => handleDirectDownload(t.filename)}
                            title="Download template archive directly"
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </button>
                        </div>

                        {/* Row 2: Secondary / utility actions */}
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                          {/* wget Command */}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11.5px' }}
                            onClick={() => handleCopyWget(t.filename)}
                            title="Copy wget command to download directly to Proxmox /var/lib/vz/dump/"
                          >
                            {copiedAction && copiedAction.id === t.filename && copiedAction.type === 'wget' ? (
                              <>
                                <Check size={12} style={{ color: 'var(--color-success)' }} />
                                <span style={{ color: 'var(--color-success)' }}>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Terminal size={12} />
                                <span>wget</span>
                              </>
                            )}
                          </button>

                          {/* Direct URL */}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11.5px' }}
                            onClick={() => handleCopyUrl(t.filename)}
                            title="Copy Direct Public URL"
                          >
                            {copiedAction && copiedAction.id === t.filename && copiedAction.type === 'url' ? (
                              <>
                                <Check size={12} style={{ color: 'var(--color-success)' }} />
                                <span style={{ color: 'var(--color-success)' }}>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>URL</span>
                              </>
                            )}
                          </button>

                          {/* Delete */}
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11.5px' }}
                            onClick={() => handleDelete(t.filename)}
                            title="Delete archive from repository"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Proxmox VE NFS Storage Connect Modal */}
      <Modal
        isOpen={isNfsModalOpen}
        onClose={() => setIsNfsModalOpen(false)}
        title="Connect to Proxmox VE as Native Storage (NFS)"
        maxWidth="740px"
        footer={
          <button className="btn btn-primary btn-sm" onClick={() => setIsNfsModalOpen(false)}>
            Close
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            By connecting this PVE OS Builder container as a <strong>native NFS storage pool</strong>, your Proxmox VE cluster immediately detects all generated <code style={{ color: 'var(--accent-cyan)' }}>.vma.zst</code> templates under <strong>Backups</strong>. You can restore virtual machines in 1 click without manually transferring files!
          </div>

          {/* Option A: One-Line CLI Setup */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={15} style={{ color: 'var(--accent-cyan)' }} />
              <span>Method 1: One-Line CLI Command (Run on any Proxmox VE Node)</span>
            </div>

            <div
              style={{
                position: 'relative',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12.5px',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <code style={{ wordBreak: 'break-all' }}>{pvesmCliCmd}</code>
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: '12px', flexShrink: 0 }}
                onClick={() => handleCopyText(pvesmCliCmd, 'pvesm', 'cli')}
              >
                {copiedAction?.id === 'pvesm' ? (
                  <>
                    <Check size={13} style={{ color: 'var(--color-success)' }} />
                    <span style={{ color: 'var(--color-success)' }}>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Option B: Proxmox Web GUI Setup */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={15} style={{ color: 'var(--accent-cyan)' }} />
              <span>Method 2: Proxmox Web GUI Step-by-Step</span>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 18px',
                fontSize: '12.5px',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
              }}
            >
              <ol style={{ paddingLeft: '18px' }}>
                <li>Open your Proxmox VE Web GUI.</li>
                <li>Navigate to <strong>Datacenter</strong> &rarr; <strong>Storage</strong> &rarr; click <strong>Add</strong> &rarr; select <strong>NFS</strong>.</li>
                <li>
                  Fill in the connection details:
                  <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>ID:</span>
                    <strong style={{ color: '#fff' }}>os-builder-storage</strong>
                    <span style={{ color: 'var(--text-muted)' }}>Server:</span>
                    <strong style={{ color: 'var(--accent-cyan)' }}>{serverHost}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>Export:</span>
                    <strong style={{ color: '#fff' }}>/export</strong>
                    <span style={{ color: 'var(--text-muted)' }}>Content:</span>
                    <strong style={{ color: '#38bdf8' }}>VZDump backup file</strong>
                    <span style={{ color: 'var(--text-muted)' }}>Options:</span>
                    <strong style={{ color: '#fff' }}>ro</strong>
                  </div>
                </li>
                <li style={{ marginTop: '8px' }}>Click <strong>Add</strong>. The storage will immediately appear in your Proxmox tree!</li>
              </ol>
            </div>
          </div>

          {/* How to restore */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12.5px',
              color: 'var(--text-secondary)',
            }}
          >
            <div style={{ fontWeight: 600, color: '#34d399', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={15} />
              <span>How Restoration Works:</span>
            </div>
            <div>
              Click on <strong style={{ color: '#fff' }}>os-builder-storage</strong> in your Proxmox VE Web UI, switch to the <strong>Backups</strong> tab, click on any template, and press <strong style={{ color: 'var(--accent-cyan)' }}>Restore</strong>! Proxmox decompress-streams the template over the network directly into your target storage pool.
            </div>
          </div>
        </div>
      </Modal>

      {/* Template Notes Modal */}
      <Modal
        isOpen={Boolean(activeNotesTemplate)}
        onClose={() => setActiveNotesTemplate(null)}
        title={`Template Notes: ${activeNotesTemplate?.template_name || activeNotesTemplate?.filename}`}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            This metadata is stored in Proxmox companion <code style={{ color: 'var(--accent-cyan)' }}>.notes</code> files and embedded in the backup configuration for automatic display in Proxmox VE.
          </div>

          <pre
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              lineHeight: '1.55',
              color: '#e2e8f0',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              maxHeight: '460px',
            }}
          >
            {activeNotesTemplate?.notes}
          </pre>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleCopyText(activeNotesTemplate?.notes, activeNotesTemplate?.filename, 'notes-copy')}
            >
              {copiedAction && activeNotesTemplate && copiedAction.id === activeNotesTemplate.filename && copiedAction.type === 'notes-copy' ? (
                <>
                  <Check size={14} style={{ color: 'var(--color-success)' }} />
                  <span>Copied Notes!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Notes</span>
                </>
              )}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveNotesTemplate(null)}>
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
