import React from 'react';
import {
  ExternalLink,
  BookOpen,
  Github,
  Globe,
  Youtube,
  Send,
  Facebook,
  Linkedin,
  Server,
  Layers,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  Zap,
  Terminal,
  ArrowRight,
  Code2,
} from 'lucide-react';

export default function About() {
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Hero Banner */}
      <div
        className="panel"
        style={{
          padding: '32px 36px',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
          borderColor: 'var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src="/logo.png"
              alt="PUQ Logo"
              style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
                PUQ PVE OS Builder
              </h1>
              <span className="badge badge-cyan" style={{ fontSize: '11px', padding: '3px 8px' }}>
                Docker Edition v1.0.0
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px', maxWidth: '620px', lineHeight: 1.6 }}>
              Production-ready Proxmox VE cloud template automation engine, built specifically to power the{' '}
              <strong style={{ color: '#fff' }}>PUQ Proxmox KVM WHMCS &amp; WISECP Modules</strong>.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href="https://puqcloud.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ textDecoration: 'none' }}
          >
            <Globe size={15} />
            <span>PUQcloud.com</span>
            <ExternalLink size={13} style={{ opacity: 0.7 }} />
          </a>
          <a
            href="https://puqsoftware.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            <Code2 size={15} />
            <span>PUQsoftware.com</span>
            <ExternalLink size={13} style={{ opacity: 0.7 }} />
          </a>
        </div>
      </div>

      {/* Why We Built This Tool (Problem & Solution) */}
      <div className="panel" style={{ padding: '28px 32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Zap size={20} style={{ color: 'var(--accent-cyan)' }} />
          <span>Why We Created PVE OS Builder</span>
        </h2>

        <div style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p>
            Operating a multi-datacenter hosting company or cloud service with WHMCS and Proxmox VE requires consistent, hardened, and highly localized virtual machine templates. Historically, system administrators had to manually download generic cloud images, configure serial consoles, install <code style={{ color: 'var(--accent-cyan)' }}>qemu-guest-agent</code>, inject <code style={{ color: 'var(--accent-cyan)' }}>cloud-init</code> packages, configure growroot modules, reset machine IDs, clear SSH host keys, and invoke low-level Proxmox CLI utilities (<code style={{ color: '#38bdf8' }}>vma create</code>) directly on individual hypervisors.
          </p>
          <p>
            This manual workflow was repetitive, prone to configuration drift, and difficult to standardize across global regions with differing timezones, DNS resolvers, and mirror repositories.
          </p>
          <p>
            <strong style={{ color: '#fff' }}>PUQ PVE OS Builder</strong> packages the entire toolchain into a self-contained Docker container. It downloads upstream vendor cloud images (Debian, Ubuntu, AlmaLinux, Rocky, CentOS, Alpine), customizes them automatically to the strict standards required by the <strong style={{ color: 'var(--accent-cyan)' }}>PUQ Proxmox KVM WHMCS Module</strong>, packages genuine <code style={{ color: '#38bdf8' }}>.vma.zst</code> archives, and serves them over an open HTTP mirror for instant 1-command deployment onto any Proxmox VE node.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '24px' }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#fff', fontSize: '14px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
              <span>Zero-Touch Hardening</span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Automatically installs QEMU guest agent, cloud-initramfs-growroot, resets machine IDs, and prepares clean SSH keys.
            </div>
          </div>

          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#fff', fontSize: '14px', marginBottom: '6px' }}>
              <Layers size={16} style={{ color: 'var(--accent-cyan)' }} />
              <span>Regional Standardization</span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Configures timezones, locales, regional fast mirrors, and DNS resolvers for Central Europe, North America, Canada, China, India, and Global UTC.
            </div>
          </div>

          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#fff', fontSize: '14px', marginBottom: '6px' }}>
              <Cpu size={16} style={{ color: 'var(--accent-blue)' }} />
              <span>Batch Matrix Pipeline</span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Generate dozens of OS and regional combinations with sequential background queuing and real-time live terminal streaming.
            </div>
          </div>

          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#fff', fontSize: '14px', marginBottom: '6px' }}>
              <Terminal size={16} style={{ color: '#eab308' }} />
              <span>Open Proxmox HTTP Mirror</span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Public download repository with byte-range resume (<code style={{ color: 'var(--accent-cyan)' }}>wget -c</code>) allowing direct hypervisor imports without tokens.
            </div>
          </div>
        </div>
      </div>

      {/* Official Portals & Documentation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* PUQcloud Card */}
        <div className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #0be0c7, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0f19' }}>
                <Globe size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>PUQcloud</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hosting &amp; Automation Modules</span>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
              Specialized developer of premium WHMCS and WISECP automation modules: Proxmox KVM, WireGuard VPN, MinIO S3, Nextcloud, Mikrotik, and Hetzner Datacenter.
            </p>
          </div>
          <a
            href="https://puqcloud.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
          >
            <span>Visit PUQcloud.com</span>
            <ExternalLink size={13} />
          </a>
        </div>

        {/* PUQ Software Card */}
        <div className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #38bdf8, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Code2 size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>PUQ Software</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Software Solutions &amp; Development</span>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
              Custom enterprise software engineering, integrations, licensing infrastructure, and high-performance server automation products.
            </p>
          </div>
          <a
            href="https://puqsoftware.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
          >
            <span>Visit PUQsoftware.com</span>
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Documentation Hub */}
        <div className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <BookOpen size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Documentation Hub</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Guides, Specs &amp; Tutorials</span>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
              Complete technical documentation for the WHMCS Proxmox KVM module, template guidelines, troubleshooting, and API specifications.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a
              href="https://doc.puq.info/books/proxmoxkvm-whmcs-module"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
            >
              <span>Proxmox KVM WHMCS Guide</span>
              <ExternalLink size={13} />
            </a>
            <a
              href="https://doc.puq.info/books/proxmoxkvm-whmcs-module/page/virtual-machine-templates"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
            >
              <span>VM Templates Specification</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* GitHub Community */}
        <div className="panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: '#1e293b', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Github size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>GitHub Community</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Open Source Repositories</span>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
              Explore open-source repositories, community automation scripts, web proxies, and developer resources by the PUQcloud team.
            </p>
          </div>
          <a
            href="https://github.com/puqcloud"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
          >
            <span>github.com/puqcloud</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Official Social Media & Community Channels */}
      <div className="panel" style={{ padding: '28px 32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Send size={18} style={{ color: 'var(--accent-cyan)' }} />
          <span>Official Social &amp; Community Channels</span>
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Follow PUQcloud across official channels for product releases, video tutorials, community support, and WHMCS module updates:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {/* YouTube */}
          <a
            href="https://www.youtube.com/@PUQCloud"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              color: '#fff',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#ef4444')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <Youtube size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13.5px' }}>YouTube</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@PUQCloud Guides</div>
            </div>
          </a>

          {/* Telegram */}
          <a
            href="https://t.me/puqcloud"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              color: '#fff',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#38bdf8')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <Send size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Telegram</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@puqcloud Community</div>
            </div>
          </a>

          {/* Facebook */}
          <a
            href="https://www.facebook.com/puqcloud"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              color: '#fff',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1877f2')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(24, 119, 242, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1877f2' }}>
              <Facebook size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Facebook</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>facebook.com/puqcloud</div>
            </div>
          </a>

          {/* LinkedIn */}
          <a
            href="https://www.linkedin.com/company/puqcloud"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              color: '#fff',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#0a66c2')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(10, 102, 194, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a66c2' }}>
              <Linkedin size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13.5px' }}>LinkedIn</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PUQcloud Professional</div>
            </div>
          </a>
        </div>
      </div>

      {/* Proxmox Restore One-Liner Quick Guide */}
      <div
        style={{
          padding: '20px 24px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: '#fff' }}>
          <Terminal size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span>Quick Proxmox CLI Import Command</span>
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
          To download and restore any template generated by this builder onto any Proxmox VE hypervisor:
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-main)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', color: '#38bdf8', fontSize: '12.5px', overflowX: 'auto' }}>
          wget -c http://&lt;builder-ip&gt;:8080/repository/&lt;filename.vma.zst&gt; -P /var/lib/vz/dump/ &amp;&amp; qmrestore /var/lib/vz/dump/&lt;filename.vma.zst&gt; &lt;vmid&gt; --storage local-lvm
        </div>
      </div>
    </div>
  );
}
