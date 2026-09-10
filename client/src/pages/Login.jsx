import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Server, Lock, User, AlertCircle, ArrowRight, Archive, ExternalLink } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo" style={{ textAlign: 'center', marginBottom: '26px' }}>
          <img
            src="/logo.png"
            alt="PUQcloud Logo"
            style={{ height: '42px', width: 'auto', marginBottom: '14px', objectFit: 'contain' }}
          />
          <h1 className="login-title">PVE OS Builder</h1>
          <p className="login-subtitle">Proxmox Cloud Template Generator &bull; Docker Edition</p>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-danger)',
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} />
              <span>Admin Username</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              required
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} />
              <span>Admin Password</span>
            </label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter environment admin password"
              required
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Set via Docker ENV variables: <code style={{ color: 'var(--accent-cyan)' }}>ADMIN_USER</code> and <code style={{ color: 'var(--accent-cyan)' }}>ADMIN_PASSWORD</code>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px' }}
            disabled={loading}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Console</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
          <a
            href="/repo"
            className="btn btn-secondary"
            style={{ width: '100%', padding: '10px', justifyContent: 'center', textDecoration: 'none' }}
          >
            <Archive size={15} style={{ color: 'var(--accent-cyan)' }} />
            <span>Browse Public Template Repository</span>
            <ExternalLink size={13} style={{ opacity: 0.6 }} />
          </a>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Open public downloads for Proxmox VE nodes (no auth required)
          </div>

          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'center', gap: '14px', fontSize: '12px' }}>
            <a
              href="https://puqcloud.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <span>PUQcloud.com</span>
              <ExternalLink size={11} style={{ opacity: 0.6 }} />
            </a>
            <span style={{ color: 'var(--border-color)' }}>&bull;</span>
            <a
              href="https://puqsoftware.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <span>PUQsoftware.com</span>
              <ExternalLink size={11} style={{ opacity: 0.6 }} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
