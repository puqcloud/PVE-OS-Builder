import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import {
  Cpu,
  Play,
  Terminal,
  CheckCircle,
  AlertTriangle,
  Clock,
  Trash2,
  ExternalLink,
  Download,
  Layers,
  CheckSquare,
  Square,
  XCircle,
  RefreshCw,
  Sliders,
  List,
  Grid,
  Filter,
  Copy,
  Check,
} from 'lucide-react';

export default function Builds({ setCurrentPage }) {
  const { apiFetch, token } = useAuth();
  const [builds, setBuilds] = useState([]);
  const [baseImages, setBaseImages] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal mode: 'batch' (Matrix Builder) vs 'single' (Single Template)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [buildMode, setBuildMode] = useState('batch');

  // Single build form state
  const [singleBuildData, setSingleBuildData] = useState({
    template_name: 'vma-debian-12-standard',
    vmid: 9000,
    base_image_id: '',
    profile_id: '',
    group_id: '',
  });

  // Batch / Matrix build form state
  const [selectedImageIds, setSelectedImageIds] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [familyFilter, setFamilyFilter] = useState('all');
  const [profileMode, setProfileMode] = useState('auto'); // 'auto' or specific profileId
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [startVmid, setStartVmid] = useState(9000);
  const [submitting, setSubmitting] = useState(false);

  // Terminal log modal state
  const [activeBuildId, setActiveBuildId] = useState(null);
  const [terminalLog, setTerminalLog] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [copiedErrorId, setCopiedErrorId] = useState(null);
  const [copiedTerminalLog, setCopiedTerminalLog] = useState(false);
  const terminalBottomRef = useRef(null);

  const handleCopyError = (errMsg, id) => {
    if (!errMsg) return;
    navigator.clipboard.writeText(errMsg).then(() => {
      setCopiedErrorId(id);
      setTimeout(() => setCopiedErrorId(null), 2500);
    }).catch((err) => {
      console.error('Failed to copy error to clipboard:', err);
    });
  };

  const handleCopyTerminalLog = () => {
    if (!terminalLog) return;
    navigator.clipboard.writeText(terminalLog).then(() => {
      setCopiedTerminalLog(true);
      setTimeout(() => setCopiedTerminalLog(false), 2500);
    }).catch((err) => {
      console.error('Failed to copy terminal log to clipboard:', err);
    });
  };

  const fetchBuilds = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch('/api/builds');
      if (res.ok) {
        const data = await res.json();
        setBuilds(data);
      }
    } catch (err) {
      console.error('Failed to fetch builds:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  const fetchPrerequisites = async () => {
    try {
      const [imgRes, profRes, grpRes] = await Promise.all([
        apiFetch('/api/base-images'),
        apiFetch('/api/profiles'),
        apiFetch('/api/groups'),
      ]);

      if (imgRes.ok) {
        const data = await imgRes.json();
        setBaseImages(data);
        const readyImgs = data.filter((i) => i.status === 'ready');
        if (readyImgs.length > 0) {
          setSingleBuildData((prev) => ({ ...prev, base_image_id: readyImgs[0].id }));
          setSelectedImageIds(readyImgs.map((i) => i.id));
        }
      }

      if (profRes.ok) {
        const data = await profRes.json();
        setProfiles(data);
        if (data.length > 0) {
          setSingleBuildData((prev) => ({ ...prev, profile_id: data[0].id }));
          setSelectedProfileId(data[0].id);
        }
      }

      if (grpRes.ok) {
        const data = await grpRes.json();
        setGroups(data);
        if (data.length > 0) {
          setSingleBuildData((prev) => ({ ...prev, group_id: data[0].id }));
          // Select all 6 regional standards by default
          setSelectedGroupIds(data.map((g) => g.id));
        }
      }
    } catch (err) {
      console.error('Failed to fetch prerequisites:', err);
    }
  };

  const hasActiveJobs = builds.some((b) => b.status === 'building' || b.status === 'queued');

  useEffect(() => {
    fetchBuilds();
    fetchPrerequisites();
  }, []);

  useEffect(() => {
    const pollInterval = hasActiveJobs ? 1000 : 3500;
    const interval = setInterval(fetchBuilds, pollInterval);
    return () => clearInterval(interval);
  }, [hasActiveJobs]);

  // SSE and resilient log loader for live build log
  useEffect(() => {
    if (!activeBuildId) return;

    let isSubscribed = true;

    // 1. Instantly fetch current log snapshot via REST API so terminal never hangs on proxy
    apiFetch(`/api/builds/${activeBuildId}`)
      .then((data) => {
        if (!isSubscribed) return;
        if (data && data.log) {
          setTerminalLog(data.log);
        } else if (data && data.status === 'queued') {
          setTerminalLog(`Build #${data.build_number || activeBuildId} is queued, waiting to start...\n`);
        } else {
          setTerminalLog('Connecting to live build output...\n');
        }
      })
      .catch((err) => {
        if (!isSubscribed) return;
        setTerminalLog((prev) => prev || `Failed to load initial log: ${err.message}\n`);
      });

    // 2. Connect to Server-Sent Events (SSE) for real-time live streaming
    let eventSource = null;
    try {
      eventSource = new EventSource(`/api/builds/${activeBuildId}/events?token=${token}`);

      eventSource.onmessage = (e) => {
        if (!isSubscribed) return;
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'initial_log') {
            setTerminalLog(data.text || '');
          } else if (data.type === 'log') {
            setTerminalLog((prev) => (prev ? prev + data.text : data.text));
          } else if (data.type === 'status') {
            fetchBuilds();
          }
        } catch (_) {}
      };

      eventSource.onerror = () => {
        // In case reverse proxy disconnects or buffers SSE, fallback polling ensures continuous updates
      };
    } catch (_) {}

    // 3. Fallback polling every 2s while build is active in case reverse proxy blocks or buffers SSE
    const pollInterval = setInterval(async () => {
      if (!isSubscribed) return;
      try {
        const build = await apiFetch(`/api/builds/${activeBuildId}`);
        if (build && build.log) {
          setTerminalLog((current) => {
            return build.log.length > (current || '').length ? build.log : current;
          });
        }
        if (build && (build.status === 'completed' || build.status === 'failed')) {
          clearInterval(pollInterval);
        }
      } catch (_) {}
    }, 2000);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [activeBuildId, token]);

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLog]);

  // Helper to auto-match profile by OS family
  const getProfileForImage = (image) => {
    if (!image || !profiles || profiles.length === 0) return null;
    const os = (image.os || '').toLowerCase();
    if (os === 'debian') {
      return profiles.find((p) => p.os_family === 'debian') || profiles[0];
    } else if (os === 'ubuntu') {
      return profiles.find((p) => p.os_family === 'ubuntu') || profiles[0];
    } else if (os === 'alpine') {
      return profiles.find((p) => p.os_family === 'alpine') || profiles[0];
    } else {
      return profiles.find((p) => p.os_family === 'rhel') || profiles[0];
    }
  };

  // Compute generated jobs for Matrix preview
  const generateMatrixJobs = () => {
    const jobs = [];
    let currentVmid = parseInt(startVmid || 9000, 10);

    for (const imgId of selectedImageIds) {
      const img = baseImages.find((i) => i.id === imgId);
      if (!img || img.status !== 'ready') continue;

      for (const grpId of selectedGroupIds) {
        const grp = groups.find((g) => g.id === grpId);
        if (!grp) continue;

        const prof =
          profileMode === 'auto'
            ? getProfileForImage(img)
            : profiles.find((p) => p.id === parseInt(selectedProfileId, 10)) || profiles[0];

        const cleanGroup = (grp.region_code || grp.name || 'std').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const cleanOs = `${img.os}-${img.version}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const template_name = `vma-${cleanOs}-${cleanGroup}`;

        jobs.push({
          template_name,
          vmid: currentVmid++,
          base_image_id: img.id,
          profile_id: prof?.id || profiles[0]?.id,
          group_id: grp.id,
          imageName: img.name,
          groupName: grp.name,
          profileName: prof?.name || 'Default',
        });
      }
    }
    return jobs;
  };

  const matrixJobs = generateMatrixJobs();

  // Launch Single Build
  const handleStartSingleBuild = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/builds', {
        method: 'POST',
        body: JSON.stringify(singleBuildData),
      });

      if (res.ok) {
        const data = await res.json();
        setIsNewModalOpen(false);
        setActiveBuildId(data.buildId);
        fetchBuilds();
      } else {
        const err = await res.json();
        alert(`Build launch error: ${err.error}`);
      }
    } catch (err) {
      alert(`Failed to launch build: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Launch Batch / Matrix Build
  const handleStartBatchBuild = async () => {
    if (matrixJobs.length === 0) {
      alert('Please select at least one ready base image and one regional group.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/builds/batch', {
        method: 'POST',
        body: JSON.stringify({ jobs: matrixJobs }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsNewModalOpen(false);
        if (data.firstBuildId) {
          setActiveBuildId(data.firstBuildId);
        }
        fetchBuilds();
      } else {
        const err = await res.json();
        alert(`Batch launch error: ${err.error}`);
      }
    } catch (err) {
      alert(`Failed to launch batch: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel build (queued or active)
  const handleCancelBuild = async (id) => {
    if (!window.confirm(`Cancel build #${id}?`)) return;
    try {
      const res = await apiFetch(`/api/builds/${id}/cancel`, { method: 'POST' });
      if (res.ok) {
        fetchBuilds();
      }
    } catch (err) {
      alert(`Cancel failed: ${err.message}`);
    }
  };

  // Retry / rebuild failed or existing build
  const handleRetryBuild = async (id) => {
    try {
      const res = await apiFetch(`/api/builds/${id}/retry`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        fetchBuilds();
        if (data.buildId) {
          setActiveBuildId(data.buildId);
        }
      } else {
        alert(data.error || 'Failed to retry build');
      }
    } catch (err) {
      alert(`Retry failed: ${err.message}`);
    }
  };

  const [clearingCompleted, setClearingCompleted] = useState(false);
  const [clearingFailed, setClearingFailed] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);

  // Retry all failed builds in batch
  const handleRetryFailed = async () => {
    if (!window.confirm(`Retry all ${failedCount} failed builds? They will be queued into the build pipeline.`)) return;
    setRetryingFailed(true);
    try {
      const res = await apiFetch('/api/builds/retry-failed', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        fetchBuilds();
      } else {
        alert(`Failed to retry builds: ${data.error || 'Server error'}`);
      }
    } catch (err) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetryingFailed(false);
    }
  };

  const handleClearFailed = async () => {
    if (!window.confirm(`Delete all ${failedCount} failed build error records from history?`)) return;
    setClearingFailed(true);
    try {
      const res = await apiFetch('/api/builds/clear-failed', { method: 'DELETE' });
      if (res.ok) {
        fetchBuilds();
      } else {
        const err = await res.json();
        alert(`Failed to delete error records: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      alert(`Clear failed: ${err.message}`);
    } finally {
      setClearingFailed(false);
    }
  };

  const handleClearCompleted = async () => {
    if (!window.confirm(`Clear all ${completedCount} completed build history records? Finished template archives in repository will remain safe.`)) return;
    setClearingCompleted(true);
    try {
      const res = await apiFetch('/api/builds/clear-completed', { method: 'DELETE' });
      if (res.ok) {
        fetchBuilds();
      } else {
        const err = await res.json();
        alert(`Failed to clear completed builds: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      alert(`Clear failed: ${err.message}`);
    } finally {
      setClearingCompleted(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this build history record?')) return;
    try {
      await apiFetch(`/api/builds/${id}`, { method: 'DELETE' });
      fetchBuilds();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Queue analytics
  const activeBuild = builds.find((b) => b.status === 'building');
  const queuedBuilds = builds.filter((b) => b.status === 'queued');
  const completedCount = builds.filter((b) => b.status === 'completed').length;
  const failedCount = builds.filter((b) => b.status === 'failed').length;
  const currentModalBuild = builds.find((b) => b.id === activeBuildId);

  // Filtered base images for the modal
  const filteredBaseImages =
    familyFilter === 'all'
      ? baseImages
      : baseImages.filter((img) => (img.os || '').toLowerCase() === familyFilter);

  return (
    <div>
      {/* Active Queue Banner */}
      {(activeBuild || queuedBuilds.length > 0) && (
        <div
          style={{
            backgroundColor: 'rgba(0, 192, 243, 0.08)',
            border: '1px solid rgba(0, 192, 243, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <RefreshCw className="spin" size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontWeight: 600, color: '#fff', fontSize: '15px' }}>
                {activeBuild ? `Building: ${activeBuild.template_name} (VMID ${activeBuild.vmid})` : 'Queue Processing'}
              </span>
              <span className="badge badge-cyan" style={{ fontSize: '11px' }}>
                {queuedBuilds.length} queued in pipeline
              </span>
            </div>

            {activeBuild && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveBuildId(activeBuild.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Terminal size={14} />
                <span>Live Console</span>
              </button>
            )}
          </div>

          {activeBuild && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <span>Step: <strong style={{ color: '#fff' }}>{activeBuild.current_step || 'Processing...'}</strong></span>
                <span>{activeBuild.progress}%</span>
              </div>
              <div className="progress-container" style={{ height: '8px' }}>
                <div className="progress-bar progress-bar-animated" style={{ width: `${activeBuild.progress}%` }}></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interrupted / Failed Builds Banner */}
      {failedCount > 0 && !activeBuild && queuedBuilds.length === 0 && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 20px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />
            <div>
              <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px' }}>
                {failedCount} Build(s) Interrupted or Failed
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Builds were interrupted by server restart or encountered errors. Click Retry All to resume the queue.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRetryFailed}
              disabled={retryingFailed}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} className={retryingFailed ? 'spin' : ''} />
              <span>{retryingFailed ? 'Queueing...' : `Retry All Failed (${failedCount})`}</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleClearFailed}
              disabled={clearingFailed}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={13} />
              <span>Clear Errors</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              <Cpu size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span>Proxmox Template Build Studio</span>
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Generate customized Proxmox VM templates (.vma.zst) individually or in batch matrix across all regional groups.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleRetryFailed}
              disabled={failedCount === 0 || retryingFailed || loading}
              title={failedCount > 0 ? `Retry all ${failedCount} failed builds in pipeline` : "No failed builds to retry"}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: failedCount > 0 ? 'rgba(0, 192, 243, 0.45)' : undefined,
                backgroundColor: failedCount > 0 ? 'rgba(0, 192, 243, 0.12)' : undefined,
                color: failedCount > 0 ? '#38bdf8' : undefined,
              }}
            >
              <RefreshCw size={13} className={retryingFailed ? 'spin' : ''} style={{ color: failedCount > 0 ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
              <span>{retryingFailed ? 'Queueing...' : `Retry Failed (${failedCount})`}</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleClearFailed}
              disabled={failedCount === 0 || clearingFailed || loading}
              title={failedCount > 0 ? `Delete all ${failedCount} failed build error records` : "No failed builds to clear"}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={13} style={{ color: failedCount > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }} />
              <span>{clearingFailed ? 'Deleting...' : `Clear Errors (${failedCount})`}</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleClearCompleted}
              disabled={completedCount === 0 || clearingCompleted || loading}
              title={completedCount > 0 ? `Clear ${completedCount} completed build records` : "No completed builds to clear"}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={13} style={{ color: completedCount > 0 ? 'var(--color-success)' : 'var(--text-muted)' }} />
              <span>{clearingCompleted ? 'Clearing...' : `Clear Completed (${completedCount})`}</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchBuilds(true)}
              disabled={refreshing || loading}
              title="Refresh builds"
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setIsNewModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Play size={15} />
              <span>Create New Build</span>
            </button>
          </div>
        </div>

        {/* Status Summary Pills */}
        <div style={{ display: 'flex', gap: '12px', padding: '0 24px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '12.5px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            Total Builds: <strong style={{ color: '#fff' }}>{builds.length}</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: 'var(--accent-cyan)' }}>
            Active: <strong>{activeBuild ? 1 : 0}</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: '#facc15' }}>
            Queued: <strong>{queuedBuilds.length}</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: 'var(--color-success)' }}>
            Completed: <strong>{completedCount}</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: 'var(--color-danger)' }}>
            Failed: <strong>{failedCount}</strong>
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <RefreshCw className="spin" size={24} style={{ margin: '0 auto 12px' }} />
            <div>Loading build records...</div>
          </div>
        ) : builds.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <Cpu size={40} style={{ margin: '0 auto 14px', opacity: 0.4 }} />
            <div style={{ fontSize: '15px', color: '#fff', marginBottom: '6px' }}>No template builds launched yet</div>
            <div style={{ fontSize: '13px' }}>
              Click <strong>Create New Build</strong> to start an individual or batch matrix build job.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Build #</th>
                  <th>Template Name & VMID</th>
                  <th>Base OS Image</th>
                  <th>Regional Group</th>
                  <th>Profile</th>
                  <th>Status & Current Step</th>
                  <th>Output Archive</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {builds.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        #{b.build_number || b.id}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{b.template_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        VMID: <code style={{ color: 'var(--accent-cyan)' }}>{b.vmid}</code>
                      </div>
                    </td>
                    <td>{b.base_image_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>
                      {b.group_name ? (
                        <span className="badge badge-cyan">{b.group_name}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>{b.profile_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ minWidth: '220px', maxWidth: '300px' }}>
                      {b.status === 'building' && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span className="badge badge-cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <RefreshCw className="spin" size={10} />
                              Building ({b.progress}%)
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              {b.progress}%
                            </span>
                          </div>
                          <div className="progress-container" style={{ height: '7px', margin: '4px 0', background: 'rgba(255,255,255,0.1)' }}>
                            <div
                              className="progress-bar progress-bar-animated"
                              style={{ width: `${Math.max(b.progress, 5)}%`, boxShadow: '0 0 8px rgba(0, 192, 243, 0.6)' }}
                            />
                          </div>
                          <div
                            style={{ fontSize: '11px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={b.current_step}
                          >
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-cyan)', flexShrink: 0 }} />
                            <span>{b.current_step || 'Processing build pipeline...'}</span>
                          </div>
                        </div>
                      )}

                      {b.status === 'queued' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span className="badge" style={{ backgroundColor: 'rgba(250, 204, 21, 0.15)', color: '#facc15', border: '1px solid rgba(250, 204, 21, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={10} />
                              Queued
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#facc15', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>Waiting in sequential build queue...</span>
                          </div>
                        </div>
                      )}

                      {b.status === 'completed' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle size={10} />
                              Completed
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {b.current_step || 'Build finished successfully'}
                          </div>
                        </div>
                      )}

                      {b.status === 'failed' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={10} />
                              Failed
                            </span>
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
                                color: copiedErrorId === b.id ? 'var(--color-success)' : '#fca5a5',
                                borderColor: copiedErrorId === b.id ? 'var(--color-success)' : 'rgba(239, 68, 68, 0.4)',
                                background: copiedErrorId === b.id ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'
                              }}
                              onClick={() => handleCopyError(b.error_message || b.current_step || 'Unknown error occurred during build', b.id)}
                              title="Copy error details to clipboard"
                            >
                              {copiedErrorId === b.id ? <Check size={11} /> : <Copy size={11} />}
                              <span>{copiedErrorId === b.id ? 'Copied Error' : 'Copy Error'}</span>
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
                              maxWidth: '300px',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.35,
                            }}
                            title={b.error_message || b.current_step}
                          >
                            {b.error_message || b.current_step || 'Build failed'}
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {b.output_filename ? (
                        <span style={{ color: 'var(--accent-cyan)' }}>{b.output_filename}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setActiveBuildId(b.id)}
                          title="View Live Terminal Log"
                        >
                          <Terminal size={13} />
                          <span>Console</span>
                        </button>

                        {b.status === 'completed' && b.output_filename && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setCurrentPage('repository')}
                            title="Go to Ready Repository"
                          >
                            <ExternalLink size={13} />
                          </button>
                        )}

                        {(b.status === 'queued' || b.status === 'building') && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleCancelBuild(b.id)}
                            title="Cancel build"
                          >
                            <XCircle size={13} />
                          </button>
                        )}

                        {b.status === 'failed' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleRetryBuild(b.id)}
                            title="Retry / Rebuild template with same parameters"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <RefreshCw size={13} />
                            <span>Retry</span>
                          </button>
                        )}

                        {b.status !== 'building' && b.status !== 'queued' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(b.id)}
                            title="Delete build record"
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
        )}
      </div>

      {/* Launch New Build Modal */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Launch Template Build Pipeline"
        maxWidth="820px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {buildMode === 'batch' ? (
                <span>
                  Will queue <strong style={{ color: 'var(--accent-cyan)' }}>{matrixJobs.length}</strong> template build{matrixJobs.length !== 1 ? 's' : ''}.
                </span>
              ) : (
                <span>Single template build</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsNewModalOpen(false)}>
                Cancel
              </button>

              {buildMode === 'batch' ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleStartBatchBuild}
                  disabled={submitting || matrixJobs.length === 0}
                >
                  {submitting ? 'Starting Batch...' : `Launch Batch (${matrixJobs.length} Jobs)`}
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleStartSingleBuild}
                  disabled={submitting || !singleBuildData.base_image_id || !singleBuildData.profile_id}
                >
                  {submitting ? 'Starting Build...' : 'Start Single Build'}
                </button>
              )}
            </div>
          </div>
        }
      >
        {/* Mode Selector Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
            marginBottom: '18px',
          }}
        >
          <button
            className={`btn btn-sm ${buildMode === 'batch' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setBuildMode('batch')}
            type="button"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Grid size={14} />
            <span>Batch & Matrix Builder (Recommended)</span>
          </button>

          <button
            className={`btn btn-sm ${buildMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setBuildMode('single')}
            type="button"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <List size={14} />
            <span>Single Template Build</span>
          </button>
        </div>

        {buildMode === 'batch' ? (
          /* BATCH / MATRIX BUILDER */
          <div>
            {/* Step 1: Base Images Selection */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ marginBottom: 0, fontWeight: 600, color: '#fff' }}>
                  1. Select Base OS Images * ({selectedImageIds.length} selected)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => {
                      const readyIds = baseImages.filter((i) => i.status === 'ready').map((i) => i.id);
                      setSelectedImageIds(readyIds);
                    }}
                  >
                    Select All Ready
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => setSelectedImageIds([])}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* OS Family Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {['all', 'debian', 'ubuntu', 'almalinux', 'rocky', 'centos', 'alpine'].map((fam) => (
                  <button
                    key={fam}
                    type="button"
                    onClick={() => setFamilyFilter(fam)}
                    className="btn btn-sm"
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      textTransform: 'capitalize',
                      backgroundColor: familyFilter === fam ? 'var(--accent-cyan)' : 'var(--bg-main)',
                      color: familyFilter === fam ? '#0b0f19' : 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                      fontWeight: familyFilter === fam ? 600 : 400,
                    }}
                  >
                    {fam}
                  </button>
                ))}
              </div>

              {/* Images Grid */}
              <div
                style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-main)',
                  padding: '8px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '8px',
                }}
              >
                {filteredBaseImages.map((img) => {
                  const isReady = img.status === 'ready';
                  const isSelected = selectedImageIds.includes(img.id);

                  return (
                    <div
                      key={img.id}
                      onClick={() => {
                        if (!isReady) return;
                        if (isSelected) {
                          setSelectedImageIds(selectedImageIds.filter((id) => id !== img.id));
                        } else {
                          setSelectedImageIds([...selectedImageIds, img.id]);
                        }
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'rgba(0, 192, 243, 0.08)' : 'var(--bg-surface)',
                        cursor: isReady ? 'pointer' : 'not-allowed',
                        opacity: isReady ? 1 : 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isReady}
                        onChange={() => {}} // Handled by div click
                        style={{ cursor: isReady ? 'pointer' : 'not-allowed' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {img.name}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{img.filename}</span>
                          <span
                            className="badge"
                            style={{
                              fontSize: '9.5px',
                              padding: '1px 5px',
                              backgroundColor: isReady ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: isReady ? 'var(--color-success)' : 'var(--color-danger)',
                            }}
                          >
                            {isReady ? 'Ready' : 'Not Downloaded'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Regional Groups Selection */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ marginBottom: 0, fontWeight: 600, color: '#fff' }}>
                  2. Select Regional Groups * ({selectedGroupIds.length} selected)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => setSelectedGroupIds(groups.map((g) => g.id))}
                  >
                    Select All 6 Standards
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => setSelectedGroupIds([])}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '8px',
                }}
              >
                {groups.map((grp) => {
                  const isSelected = selectedGroupIds.includes(grp.id);
                  return (
                    <div
                      key={grp.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedGroupIds(selectedGroupIds.filter((id) => id !== grp.id));
                        } else {
                          setSelectedGroupIds([...selectedGroupIds, grp.id]);
                        }
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'rgba(0, 192, 243, 0.08)' : 'var(--bg-main)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{grp.name}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          {grp.timezone} • {grp.region_code || 'GLOBAL'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Profile & Starting VMID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, color: '#fff' }}>
                  3. OS Profile Assignment
                </label>
                <select
                  className="form-control"
                  value={profileMode === 'auto' ? 'auto' : selectedProfileId}
                  onChange={(e) => {
                    if (e.target.value === 'auto') {
                      setProfileMode('auto');
                    } else {
                      setProfileMode('specific');
                      setSelectedProfileId(e.target.value);
                    }
                  }}
                >
                  <option value="auto">Auto-Match by OS Family (Recommended)</option>
                  <optgroup label="Or force specific profile across all:">
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.target_disk_size_gb}GB Disk)
                      </option>
                    ))}
                  </optgroup>
                </select>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Auto-match automatically links Debian templates to Debian Standard, Alpine to Alpine Standard, etc.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, color: '#fff' }}>
                  4. Starting Proxmox VMID *
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={startVmid}
                  onChange={(e) => setStartVmid(parseInt(e.target.value, 10))}
                  placeholder="9000"
                  min="100"
                  max="999999"
                  required
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  VMID automatically increments by 1 for each queued template.
                </div>
              </div>
            </div>

            {/* Step 4: Matrix Execution Summary */}
            <div
              style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#fff' }}>
                  Matrix Jobs Preview ({matrixJobs.length} Builds)
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--accent-cyan)' }}>
                  {selectedImageIds.length} Images × {selectedGroupIds.length} Groups
                </span>
              </div>

              {matrixJobs.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--color-warning)', padding: '6px 0' }}>
                  Please select at least 1 ready base image and 1 regional group above.
                </div>
              ) : (
                <div style={{ maxHeight: '130px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '4px 6px' }}>VMID</th>
                        <th style={{ padding: '4px 6px' }}>Template Name</th>
                        <th style={{ padding: '4px 6px' }}>Base OS Image</th>
                        <th style={{ padding: '4px 6px' }}>Region Group</th>
                        <th style={{ padding: '4px 6px' }}>Profile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixJobs.map((j) => (
                        <tr key={`${j.vmid}-${j.template_name}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '4px 6px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{j.vmid}</td>
                          <td style={{ padding: '4px 6px', fontWeight: 600, color: '#fff' }}>{j.template_name}</td>
                          <td style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>{j.imageName}</td>
                          <td style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>{j.groupName}</td>
                          <td style={{ padding: '4px 6px', color: 'var(--text-muted)' }}>{j.profileName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* SINGLE TEMPLATE BUILD MODE */
          <form onSubmit={handleStartSingleBuild}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Template Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={singleBuildData.template_name}
                  onChange={(e) => setSingleBuildData({ ...singleBuildData, template_name: e.target.value })}
                  placeholder="e.g. vma-debian-12-custom"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Proxmox VMID *</label>
                <input
                  type="number"
                  className="form-control"
                  value={singleBuildData.vmid}
                  onChange={(e) => setSingleBuildData({ ...singleBuildData, vmid: parseInt(e.target.value, 10) })}
                  placeholder="9000"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Base OS Image *</label>
              <select
                className="form-control"
                value={singleBuildData.base_image_id}
                onChange={(e) => setSingleBuildData({ ...singleBuildData, base_image_id: e.target.value })}
                required
              >
                <option value="">Select downloaded base image...</option>
                {baseImages.map((img) => (
                  <option key={img.id} value={img.id} disabled={img.status !== 'ready'}>
                    {img.name} ({img.filename}) {img.status === 'ready' ? '— [Ready]' : '— [NOT DOWNLOADED]'}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">OS Customization Profile *</label>
                <select
                  className="form-control"
                  value={singleBuildData.profile_id}
                  onChange={(e) => setSingleBuildData({ ...singleBuildData, profile_id: e.target.value })}
                  required
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.target_disk_size_gb}GB Disk)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Localization Group *</label>
                <select
                  className="form-control"
                  value={singleBuildData.group_id}
                  onChange={(e) => setSingleBuildData({ ...singleBuildData, group_id: e.target.value })}
                  required
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.timezone})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Terminal Log Modal */}
      <Modal
        isOpen={!!activeBuildId}
        onClose={() => setActiveBuildId(null)}
        title={`Build Console Terminal #${activeBuildId}`}
        maxWidth="840px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCopyTerminalLog}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: copiedTerminalLog ? 'var(--color-success)' : 'inherit'
                }}
                title="Copy terminal output to clipboard"
              >
                {copiedTerminalLog ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedTerminalLog ? 'Copied Log' : 'Copy Console Log'}</span>
              </button>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveBuildId(null)}>
              Close Console
            </button>
          </div>
        }
      >
        {currentModalBuild?.status === 'failed' && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              <AlertTriangle size={15} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
              <span
                style={{
                  fontSize: '12px',
                  color: '#fca5a5',
                  fontFamily: 'var(--font-mono)',
                  wordBreak: 'break-word',
                  lineHeight: 1.35,
                }}
                title={currentModalBuild.error_message}
              >
                {currentModalBuild.error_message || 'Build failed'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: copiedErrorId === currentModalBuild.id ? 'var(--color-success)' : '#fca5a5',
                borderColor: copiedErrorId === currentModalBuild.id ? 'var(--color-success)' : 'rgba(239, 68, 68, 0.4)',
                background: copiedErrorId === currentModalBuild.id ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                flexShrink: 0
              }}
              onClick={() => handleCopyError(currentModalBuild.error_message || 'Unknown error', currentModalBuild.id)}
              title="Copy error details to clipboard"
            >
              {copiedErrorId === currentModalBuild.id ? <Check size={11} /> : <Copy size={11} />}
              <span>{copiedErrorId === currentModalBuild.id ? 'Copied Error' : 'Copy Error'}</span>
            </button>
          </div>
        )}

        <div className="terminal-window">
          {terminalLog || 'Waiting for output...'}
          <div ref={terminalBottomRef} />
        </div>
      </Modal>
    </div>
  );
}
