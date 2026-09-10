import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, ShieldCheck } from 'lucide-react';

export default function Header({ title }) {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-title-box">
        <h1 className="page-title">{title}</h1>
      </div>

      <div className="header-actions">
        <div className="header-badge">
          <span className="status-dot"></span>
          <span>Proxmox Engine Ready</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
          <ShieldCheck size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{user?.username || 'admin'}</span>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={logout}
          title="Log out of Admin Console"
        >
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
