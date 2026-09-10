import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import BaseImages from './pages/BaseImages';
import Profiles from './pages/Profiles';
import Groups from './pages/Groups';
import Builds from './pages/Builds';
import Repository from './pages/Repository';
import NfsStorage from './pages/NfsStorage';
import Settings from './pages/Settings';
import About from './pages/About';

export default function App() {
  const { isAuthenticated, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-main)', color: 'var(--text-muted)' }}>
        Loading Proxmox OS Builder Console...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard':
        return 'System Overview & Metrics';
      case 'base-images':
        return 'Base OS Images Downloader';
      case 'profiles':
        return 'OS Customization Profiles';
      case 'groups':
        return 'Regional & Localization Groups';
      case 'builds':
        return 'Proxmox Template Build Studio';
      case 'repository':
        return 'Ready Templates Repository';
      case 'nfs-storage':
        return 'Proxmox VE Native Storage (NFS)';
      case 'settings':
        return 'Storage Paths & System Settings';
      case 'about':
        return 'About PUQcloud & PVE OS Builder';
      default:
        return 'Proxmox OS Builder';
    }
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard setCurrentPage={setCurrentPage} />;
      case 'base-images':
        return <BaseImages />;
      case 'profiles':
        return <Profiles />;
      case 'groups':
        return <Groups />;
      case 'builds':
        return <Builds setCurrentPage={setCurrentPage} />;
      case 'repository':
        return <Repository setCurrentPage={setCurrentPage} />;
      case 'nfs-storage':
        return <NfsStorage setCurrentPage={setCurrentPage} />;
      case 'settings':
        return <Settings />;
      case 'about':
        return <About />;
      default:
        return <Dashboard setCurrentPage={setCurrentPage} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="main-wrapper">
        <Header title={getPageTitle()} />
        <main className="content-scrollable">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
