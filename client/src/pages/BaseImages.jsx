import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { OsIcon } from '../components/OsIcons';
import {
  DownloadCloud,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  XCircle,
  Zap,
  FileCode,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';

const OS_META = {
  debian: { name: 'Debian GNU/Linux', color: '#D70A53' },
  ubuntu: { name: 'Ubuntu Linux', color: '#E95420' },
  almalinux: { name: 'AlmaLinux OS', color: '#00B4D8' },
  rocky: { name: 'Rocky Linux', color: '#10B981' },
  centos: { name: 'CentOS Stream', color: '#EEA236' },
  alpine: { name: 'Alpine Linux', color: '#0D597F' },
  fedora: { name: 'Fedora Cloud', color: '#51A2DA' },
  opensuse: { name: 'openSUSE Leap', color: '#73BA25' },
  archlinux: { name: 'Arch Linux', color: '#1793D1' },
  other: { name: 'Custom / Other Linux', color: '#64748B' },
};

export default function BaseImages() {
  const { apiFetch, token } = useAuth();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add / Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [editingImageId, setEditingImageId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    os: 'debian',
    version: '',
    arch: 'amd64',
    url: '',
    format: 'qcow2',
    filename: '',
  });

  // JSON Catalog Editor state
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonContent, setJsonContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadingCatalog, setReloadingCatalog] = useState(false);
  const [copiedErrorId, setCopiedErrorId] = useState(null);

  const handleCopyError = (errMsg, id) => {
    if (!errMsg) return;
    navigator.clipboard.writeText(errMsg).then(() => {
      setCopiedErrorId(id);
      setTimeout(() => setCopiedErrorId(null), 2500);
    }).catch((err) => {
      console.error('Failed to copy error to clipboard:', err);
    });
  };

  const fetchImages = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch('/api/base-images');
      if (res.ok) {
        const data = await res.json();
        setImages(data);
      }
    } catch (err) {
      console.error('Failed to fetch images:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchImages();

    // Connect to Server-Sent Events (SSE) for live download progress updates
    const sseUrl = `/api/base-images/events?token=${token}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        setImages((prev) =>
          prev.map((img) => {
            if (img.id === data.id) {
              return {
                ...img,
                status: data.status,
                download_progress: data.progress,
                downloaded_bytes: data.downloadedBytes ?? img.downloaded_bytes,
                total_bytes: data.totalBytes ?? img.total_bytes,
                speed: data.speed ?? img.speed,
                file_size: data.fileSize || img.file_size,
                error_message: data.error !== undefined ? data.error : img.error_message,
                retry_count: data.retryCount !== undefined ? data.retryCount : img.retry_count,
              };
            }
            return img;
          })
        );
      } catch (_) {}
    });

    return () => {
      eventSource.close();
    };
  }, [token]);

  // Polling fallback while any download is active, queued, or pending auto-retry
  useEffect(() => {
    const hasActiveOrQueued = images.some(
      (img) => img.status === 'downloading' || img.status === 'queued' || (img.status === 'error' && (img.retry_count || 0) > 0 && (img.retry_count || 0) < 3)
    );
    if (!hasActiveOrQueued) return;

    const interval = setInterval(fetchImages, 1500);
    return () => clearInterval(interval);
  }, [images]);

  const handleDownload = async (id) => {
    try {
      const res = await apiFetch(`/api/base-images/${id}/download`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status} ${res.statusText}` }));
        alert(`Download failed to start: ${errData.error || 'Server error'}`);
      }
      fetchImages();
    } catch (err) {
      alert(`Download failed to start: ${err.message}`);
    }
  };

  const handleDownloadAll = async (osFamily = null) => {
    try {
      const res = await apiFetch('/api/base-images/download-all', {
        method: 'POST',
        body: JSON.stringify(osFamily ? { os: osFamily } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        fetchImages();
      } else {
        alert(`Download all failed: ${data.error || 'Server error'}`);
      }
    } catch (err) {
      alert(`Failed to trigger sequential downloads: ${err.message}`);
    }
  };

  const handleCancelDownload = async (id) => {
    try {
      const res = await apiFetch(`/api/base-images/${id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status} ${res.statusText}` }));
        alert(`Cancel failed: ${errData.error || 'Server error'}`);
      }
      fetchImages();
    } catch (err) {
      alert(`Cancel failed: ${err.message}`);
    }
  };

  const handleDelete = async (id, name, status) => {
    const isError = status === 'error';
    const confirmPrompt = isError
      ? `Clear error for '${name}' and reset status to not downloaded? The image will remain in the catalog.`
      : `Delete downloaded file for '${name}' from storage? The image will remain in the catalog and can be re-downloaded at any time.`;

    if (!window.confirm(confirmPrompt)) return;
    try {
      const res = await apiFetch(`/api/base-images/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        alert(`Reset failed: ${errData.error || 'Server error'}`);
      }
      fetchImages();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handlePurgeFromCatalog = async () => {
    if (!window.confirm(`Permanently delete '${formData.name}' definition from the catalog?`)) return;
    try {
      const res = await apiFetch(`/api/base-images/${editingImageId}?purge=true`, { method: 'DELETE' });
      if (res.ok) {
        setIsEditModalOpen(false);
        fetchImages();
      } else {
        const errData = await res.json().catch(() => ({ error: 'Server error' }));
        alert(`Failed to remove: ${errData.error}`);
      }
    } catch (err) {
      alert(`Remove failed: ${err.message}`);
    }
  };

  const openAddModal = (defaultOs = 'debian') => {
    setModalMode('add');
    setEditingImageId(null);
    setFormData({
      name: '',
      os: defaultOs,
      version: '',
      arch: 'amd64',
      url: '',
      format: 'qcow2',
      filename: '',
    });
    setIsEditModalOpen(true);
  };

  const openEditModal = (img) => {
    setModalMode('edit');
    setEditingImageId(img.id);
    setFormData({
      name: img.name,
      os: img.os,
      version: img.version,
      arch: img.arch,
      url: img.url,
      format: img.format,
      filename: img.filename,
    });
    setIsEditModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = modalMode === 'edit' ? `/api/base-images/${editingImageId}` : '/api/base-images';
      const method = modalMode === 'edit' ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsEditModalOpen(false);
        fetchImages();
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
      const res = await apiFetch('/api/base-images/catalog-json');
      if (res.ok) {
        const data = await res.json();
        setJsonContent(JSON.stringify(data, null, 2));
        setIsJsonModalOpen(true);
      }
    } catch (err) {
      alert(`Failed to load catalog JSON: ${err.message}`);
    }
  };

  const handleSaveJson = async () => {
    setSubmitting(true);
    try {
      const parsed = JSON.parse(jsonContent);
      const res = await apiFetch('/api/base-images/catalog-json', {
        method: 'PUT',
        body: JSON.stringify(parsed),
      });

      if (res.ok) {
        setIsJsonModalOpen(false);
        fetchImages();
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
      const res = await apiFetch('/api/base-images/reload-catalog', { method: 'POST' });
      if (res.ok) {
        await fetchImages();
      }
    } catch (err) {
      alert(`Reload failed: ${err.message}`);
    } finally {
      setReloadingCatalog(false);
    }
  };

  const [syncingDefaults, setSyncingDefaults] = useState(false);
  const [syncBanner, setSyncBanner] = useState(null);

  const handleSyncDefaults = async () => {
    setSyncingDefaults(true);
    setSyncBanner(null);
    try {
      const res = await apiFetch('/api/base-images/sync-defaults', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncBanner({ type: 'success', text: data.message });
        await fetchImages();
      } else {
        setSyncBanner({ type: 'error', text: data.error || 'Failed to merge official defaults' });
      }
    } catch (err) {
      setSyncBanner({ type: 'error', text: err.message });
    } finally {
      setSyncingDefaults(false);
      setTimeout(() => setSyncBanner(null), 8000);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec === 0) return '';
    const mb = bytesPerSec / (1024 * 1024);
    return `${mb.toFixed(1)} MB/s`;
  };

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  const compareImageVersionsDesc = (a, b) => {
    const verA = String(a.version || '');
    const verB = String(b.version || '');
    const cmp = collator.compare(verA, verB);
    if (cmp !== 0) return -cmp;
    return collator.compare(String(b.name || ''), String(a.name || ''));
  };

  // Group images by OS Family
  const groupedImages = images.reduce((acc, img) => {
    const osKey = img.os?.toLowerCase() || 'other';
    if (!acc[osKey]) acc[osKey] = [];
    acc[osKey].push(img);
    return acc;
  }, {});

  // Pre-defined display order for OS families
  const osOrder = ['debian', 'ubuntu', 'almalinux', 'rocky', 'centos', 'alpine', 'fedora', 'opensuse', 'archlinux'];
  const allGroups = [
    ...osOrder.filter((os) => groupedImages[os]),
    ...Object.keys(groupedImages).filter((os) => !osOrder.includes(os)),
  ];

  const totalMissingCount = images.filter((i) => i.status === 'not_downloaded' || i.status === 'error').length;
  const totalQueuedCount = images.filter((i) => i.status === 'queued').length;
  const totalDownloadingCount = images.filter((i) => i.status === 'downloading').length;

  return (
    <div>
      {/* Top Action Bar */}
      <div className="panel" style={{ padding: '20px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="panel-title" style={{ fontSize: '18px' }}>
              <DownloadCloud size={20} style={{ color: 'var(--accent-cyan)' }} />
              <span>Base OS Images Catalog</span>
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Images grouped by system family with latest versions. Click <strong>Download</strong> to pull an image on-demand into volume storage (<code style={{ color: 'var(--accent-cyan)' }}>/data/downloads</code>).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '32px', width: '200px', height: '36px' }}
                placeholder="Filter versions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleDownloadAll()}
              disabled={totalMissingCount === 0}
              title={
                totalMissingCount > 0
                  ? `Download all ${totalMissingCount} missing base images sequentially in pipeline`
                  : 'All base images are already downloaded'
              }
              style={{
                backgroundColor: totalMissingCount > 0 ? 'var(--accent-cyan)' : 'var(--bg-surface-elevated)',
                borderColor: totalMissingCount > 0 ? 'var(--accent-cyan)' : 'var(--border-color)',
                color: totalMissingCount > 0 ? '#0B1120' : 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              <DownloadCloud size={14} />
              <span>
                {totalMissingCount > 0
                  ? `Download All (${totalMissingCount})`
                  : totalQueuedCount > 0 || totalDownloadingCount > 0
                  ? `Downloading Queue (${totalDownloadingCount + totalQueuedCount})`
                  : 'All Downloaded'}
              </span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSyncDefaults}
              disabled={syncingDefaults}
              title="Check for and merge newly supported official cloud OS releases"
              style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38BDF8' }}
            >
              <RefreshCw size={14} className={syncingDefaults ? 'spin' : ''} />
              <span>{syncingDefaults ? 'Syncing...' : 'Sync Latest Releases'}</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchImages(true)}
              disabled={refreshing || loading}
              title="Refresh images list"
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleReloadCatalog}
              disabled={reloadingCatalog}
              title="Sync/Reload from images_catalog.json"
            >
              <RefreshCw size={14} className={reloadingCatalog ? 'spin' : ''} />
              <span>{reloadingCatalog ? 'Syncing...' : 'Sync from File'}</span>
            </button>

            <button className="btn btn-secondary btn-sm" onClick={openJsonEditor} title="Edit raw images_catalog.json file">
              <FileCode size={14} />
              <span>Edit JSON</span>
            </button>

            <button className="btn btn-primary btn-sm" onClick={() => openAddModal('debian')}>
              <Plus size={15} />
              <span>Add Image</span>
            </button>
          </div>
        </div>
      </div>

      {syncBanner && (
        <div
          style={{
            padding: '12px 18px',
            marginBottom: '20px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: syncBanner.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${syncBanner.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            color: syncBanner.type === 'success' ? '#34D399' : '#F87171',
            fontSize: '13.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {syncBanner.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{syncBanner.text}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Loading operating systems catalog...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {allGroups.map((osKey) => {
            const osImages = [...(groupedImages[osKey] || [])].sort(compareImageVersionsDesc);
            const filteredOsImages = osImages.filter(
              (img) =>
                img.name.toLowerCase().includes(search.toLowerCase()) ||
                img.version.toLowerCase().includes(search.toLowerCase()) ||
                img.filename.toLowerCase().includes(search.toLowerCase())
            );

            if (filteredOsImages.length === 0 && search) return null;

            const readyCount = osImages.filter((i) => i.status === 'ready').length;
            const downloadingCount = osImages.filter((i) => i.status === 'downloading').length;
            const queuedCount = osImages.filter((i) => i.status === 'queued').length;
            const missingCount = osImages.filter((i) => i.status === 'not_downloaded' || i.status === 'error').length;
            const meta = OS_META[osKey] || { name: `${osKey.toUpperCase()} Linux`, color: '#64748B' };

            return (
              <div
                key={osKey}
                className="panel"
                style={{
                  borderLeft: `4px solid ${meta.color}`,
                  padding: '22px 24px',
                  marginBottom: 0,
                }}
              >
                {/* OS Group Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <OsIcon os={osKey} size={40} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>{meta.name}</h3>
                        <span className="badge badge-os" style={{ fontSize: '11px' }}>
                          {osImages.length} {osImages.length === 1 ? 'version' : 'versions'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {readyCount > 0 ? (
                          <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                            {readyCount} ready in cache
                          </span>
                        ) : (
                          <span>0 downloaded</span>
                        )}
                        {downloadingCount > 0 && (
                          <span style={{ color: 'var(--accent-cyan)', marginLeft: '8px', fontWeight: 600 }}>
                            ({downloadingCount} downloading...)
                          </span>
                        )}
                        {queuedCount > 0 && (
                          <span style={{ color: '#FACC15', marginLeft: '8px', fontWeight: 600 }}>
                            ({queuedCount} queued)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {missingCount > 0 && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleDownloadAll(osKey)}
                        style={{ fontSize: '12px', padding: '5px 10px' }}
                        title={`Download all missing ${meta.name} versions sequentially`}
                      >
                        <DownloadCloud size={13} />
                        <span>Download All ({missingCount})</span>
                      </button>
                    )}

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openAddModal(osKey)}
                      style={{ fontSize: '12px', padding: '5px 10px' }}
                    >
                      <Plus size={13} />
                      <span>Add {osKey} version</span>
                    </button>
                  </div>
                </div>

                {/* OS Versions Table */}
                <div className="table-container" style={{ backgroundColor: 'var(--bg-surface)' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '22%' }}>Release / Name</th>
                        <th style={{ width: '10%' }}>Arch</th>
                        <th style={{ width: '28%' }}>Download URL & Local File</th>
                        <th style={{ width: '26%' }}>Status & Live Progress</th>
                        <th style={{ textAlign: 'right', width: '14%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOsImages.map((img) => (
                        <tr key={img.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#fff', fontSize: '13.5px' }}>{img.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Version {img.version} • {img.format.toUpperCase()}
                            </div>
                          </td>

                          <td>
                            <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)' }}>
                              {img.arch}
                            </span>
                          </td>

                          <td>
                            <div
                              style={{
                                fontSize: '11.5px',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                maxWidth: '320px',
                              }}
                              title={img.url}
                            >
                              {img.url}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--accent-cyan)',
                                marginTop: '2px',
                              }}
                            >
                              {img.filename}
                            </div>
                          </td>

                          <td>
                            {img.status === 'ready' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="badge badge-success">
                                  <CheckCircle size={13} />
                                  <span>Ready</span>
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
                                  {formatBytes(img.file_size)}
                                </span>
                              </div>
                            )}

                            {img.status === 'downloading' && (
                              <div style={{ width: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', marginBottom: '3px' }}>
                                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                                    Downloading: {img.download_progress || 0}%
                                  </span>
                                  {img.speed > 0 && (
                                    <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600, fontSize: '11px' }}>
                                      <Zap size={11} /> {formatSpeed(img.speed)}
                                    </span>
                                  )}
                                </div>

                                <div className="progress-container" style={{ margin: '3px 0' }}>
                                  <div className="progress-bar" style={{ width: `${img.download_progress || 0}%` }}></div>
                                </div>

                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {formatBytes(img.downloaded_bytes)} / {formatBytes(img.total_bytes)}
                                </div>
                              </div>
                            )}

                            {img.status === 'queued' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  className="badge badge-warning"
                                  style={{
                                    backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                    color: '#FACC15',
                                    borderColor: 'rgba(234, 179, 8, 0.35)',
                                  }}
                                >
                                  <Clock size={12} />
                                  <span>Queued in pipeline</span>
                                </span>
                              </div>
                            )}

                            {img.status === 'not_downloaded' && (
                              <span className="badge badge-warning">
                                <Clock size={12} />
                                <span>Not Downloaded</span>
                              </span>
                            )}

                            {img.status === 'error' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  {(img.retry_count || 0) > 0 && (img.retry_count || 0) < 3 ? (
                                    <span
                                      className="badge badge-warning"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                        color: '#FACC15',
                                        borderColor: 'rgba(234, 179, 8, 0.35)',
                                      }}
                                      title={`Download will automatically retry in 10s after other queue items (attempt ${img.retry_count}/3)`}
                                    >
                                      <Clock size={11} />
                                      <span>Auto-retrying ({img.retry_count}/3)</span>
                                    </span>
                                  ) : (
                                    <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <AlertTriangle size={11} />
                                      <span>{(img.retry_count || 0) >= 3 ? 'Failed (3/3 retries)' : 'Download Failed'}</span>
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{
                                      fontSize: '10.5px',
                                      padding: '1px 6px',
                                      height: '21px',
                                      lineHeight: '1',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      color: copiedErrorId === img.id ? 'var(--color-success)' : '#fca5a5',
                                      borderColor: copiedErrorId === img.id ? 'var(--color-success)' : 'rgba(239, 68, 68, 0.4)',
                                      background: copiedErrorId === img.id ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    }}
                                    onClick={() => handleCopyError(img.error_message || 'Download failed: Network error, invalid upstream URL, or server unreachable', img.id)}
                                    title="Copy error details to clipboard"
                                  >
                                    {copiedErrorId === img.id ? <Check size={11} /> : <Copy size={11} />}
                                    <span>{copiedErrorId === img.id ? 'Copied' : 'Copy Error'}</span>
                                  </button>
                                </div>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    color: '#f87171',
                                    fontFamily: 'var(--font-mono)',
                                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    borderRadius: '4px',
                                    padding: '5px 8px',
                                    maxWidth: '340px',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.35,
                                  }}
                                  title={img.error_message || 'Download failed: Network error, unreachable upstream host, or bad URL'}
                                >
                                  {img.error_message || 'Download failed: Network error, unreachable upstream host, or bad URL'}
                                </div>
                              </div>
                            )}
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
                              {(img.status === 'not_downloaded' || img.status === 'error') && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleDownload(img.id)}
                                  title={img.status === 'error' ? 'Retry downloading this OS image' : 'Download this OS image to disk'}
                                >
                                  {img.status === 'error' ? <RefreshCw size={13} /> : <DownloadCloud size={13} />}
                                  <span>{img.status === 'error' ? 'Retry Download' : 'Download'}</span>
                                </button>
                              )}

                              {(img.status === 'downloading' || img.status === 'queued') && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleCancelDownload(img.id)}
                                  title={img.status === 'queued' ? 'Cancel queued download' : 'Cancel active download'}
                                >
                                  <XCircle size={13} />
                                  <span>Cancel</span>
                                </button>
                              )}

                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => openEditModal(img)}
                                title="Edit URL or version name"
                                style={{ padding: '6px 8px' }}
                              >
                                <Edit3 size={13} />
                              </button>

                              {(img.status === 'ready' || img.status === 'error') && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDelete(img.id, img.name, img.status)}
                                  title={
                                    img.status === 'error'
                                      ? 'Clear error task and reset status (keeps image in catalog)'
                                      : 'Delete downloaded file from disk (keeps image in catalog)'
                                  }
                                  style={{ padding: '6px 8px' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Image Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={modalMode === 'edit' ? `Edit Image: ${formData.name}` : 'Add OS Image Version'}
        maxWidth="660px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div>
              {modalMode === 'edit' && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handlePurgeFromCatalog}
                  title="Permanently remove this image definition from the catalog"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Trash2 size={13} />
                  <span>Remove from Catalog</span>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleFormSubmit}
                disabled={submitting || !formData.name || !formData.url}
              >
                {submitting ? 'Saving...' : modalMode === 'edit' ? 'Save Changes' : 'Add to Catalog'}
              </button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleFormSubmit}>
          <div className="form-group">
            <label className="form-label">Display Name *</label>
            <input
              type="text"
              className="form-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Debian 12 (Bookworm) GenericCloud"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">OS Family</label>
              <select
                className="form-control"
                value={formData.os}
                onChange={(e) => setFormData({ ...formData, os: e.target.value })}
              >
                <option value="debian">Debian</option>
                <option value="ubuntu">Ubuntu</option>
                <option value="almalinux">AlmaLinux</option>
                <option value="rocky">Rocky Linux</option>
                <option value="centos">CentOS</option>
                <option value="alpine">Alpine</option>
                <option value="fedora">Fedora</option>
                <option value="opensuse">openSUSE</option>
                <option value="archlinux">Arch Linux</option>
                <option value="other">Other Linux</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Version</label>
              <input
                type="text"
                className="form-control"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                placeholder="e.g. 12, 24.04, 9"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Architecture</label>
              <select
                className="form-control"
                value={formData.arch}
                onChange={(e) => setFormData({ ...formData, arch: e.target.value })}
              >
                <option value="amd64">amd64 (x86_64)</option>
                <option value="arm64">arm64 (aarch64)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Upstream Image Download URL *</label>
            <input
              type="url"
              className="form-control"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://cloud.debian.org/.../debian-12-genericcloud-amd64.qcow2"
              required
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Official cloud image download link (.qcow2, .raw, .img).
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Target Local Filename (Optional)</label>
              <input
                type="text"
                className="form-control"
                value={formData.filename}
                onChange={(e) => setFormData({ ...formData, filename: e.target.value })}
                placeholder="auto-derived from URL"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Disk Format</label>
              <select
                className="form-control"
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value })}
              >
                <option value="qcow2">QCOW2</option>
                <option value="raw">RAW</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* JSON File Editor Modal */}
      <Modal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        title="Direct Edit: images_catalog.json"
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
            This configuration is saved in <code style={{ color: 'var(--accent-cyan)' }}>/data/configs/images_catalog.json</code> and mounted on your host at <code style={{ color: '#fff' }}>./data/configs/images_catalog.json</code>. You can edit here or directly in your text editor.
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
