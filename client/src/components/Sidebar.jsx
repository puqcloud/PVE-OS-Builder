import React from 'react';
import {
  LayoutDashboard,
  DownloadCloud,
  Sliders,
  Globe,
  Cpu,
  Archive,
  Server,
  Settings,
  Info,
} from 'lucide-react';

export default function Sidebar({ currentPage, setCurrentPage }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'base-images', label: 'Base Images', icon: DownloadCloud },
    { id: 'profiles', label: 'OS Profiles', icon: Sliders },
    { id: 'groups', label: 'Groups / Localizations', icon: Globe },
    { id: 'builds', label: 'Build Studio', icon: Cpu },
    { id: 'repository', label: 'Ready Templates', icon: Archive },
    { id: 'nfs-storage', label: 'Proxmox Storage', icon: Server },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'about', label: 'About PUQ', icon: Info },
  ];

  return (
    <aside className="sidebar">
      <div
        className="sidebar-header"
        style={{
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
        }}
        onClick={() => setCurrentPage('about')}
        title="About PUQcloud PVE OS Builder"
      >
        <div
          style={{
            height: '38px',
            width: '38px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <img
            src="/puq-favicon.png"
            alt="PUQ"
            style={{ height: '28px', width: '28px', objectFit: 'contain' }}
          />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <img
              src="/logo.png"
              alt="PUQcloud"
              style={{ height: '18px', width: 'auto', objectFit: 'contain' }}
            />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 600, marginTop: '2px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
            PVE OS Builder
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        onClick={() => setCurrentPage('about')}
        style={{
          padding: '14px 18px',
          borderTop: '1px solid var(--border-color)',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          fontSize: '12px',
          color: currentPage === 'about' ? '#fff' : 'var(--text-muted)',
          backgroundColor: currentPage === 'about' ? 'rgba(11, 224, 199, 0.1)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          width: '100%',
        }}
        title="View About Us & Ecosystem Links"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={14} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontWeight: 500 }}>Docker Edition</span>
        </div>
        <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>v1.1.0</span>
      </button>
    </aside>
  );
}
