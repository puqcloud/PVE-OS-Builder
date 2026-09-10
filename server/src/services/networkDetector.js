import os from 'os';
import { execSync } from 'child_process';
import db from '../db/index.js';

/**
 * Check if an IP is a local loopback, internal docker bridge, or placeholder
 */
export function isInternalOrLoopback(ip) {
  if (!ip) return true;
  const clean = ip.trim().toLowerCase();
  if (
    clean === 'localhost' ||
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === 'your_server_ip' ||
    clean === 'server_ip' ||
    clean.startsWith('127.') ||
    clean.startsWith('169.254.') // Link-local
  ) {
    return true;
  }
  // Docker default bridge subnet range: 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Check if a network interface name belongs to a virtual / container / docker interface
 */
export function isVirtualInterface(name) {
  if (!name) return true;
  const lower = name.toLowerCase();
  return (
    lower === 'lo' ||
    lower.startsWith('docker') ||
    lower.startsWith('br-') ||
    lower.startsWith('veth') ||
    lower.startsWith('virbr') ||
    lower.startsWith('cni') ||
    lower.startsWith('flannel') ||
    lower.startsWith('cali') ||
    lower.startsWith('tun') ||
    lower.startsWith('tap')
  );
}

/**
 * Assign a priority score to interface names for physical / host bridge selection
 */
function getInterfacePriority(name) {
  const lower = (name || '').toLowerCase();
  if (lower.startsWith('vmbr')) return 100; // Proxmox VE standard bridge
  if (lower.startsWith('bond') || lower.startsWith('team')) return 90; // Aggregated links
  if (/^(eth|eno|enp|ens|em)[0-9]/.test(lower)) return 80; // Physical Ethernet
  if (lower.startsWith('wl')) return 70; // Physical Wi-Fi
  if (lower.startsWith('br')) return 60; // Generic bridge (non-docker)
  if (!isVirtualInterface(name)) return 50;
  return 10;
}

/**
 * Auto-detect primary Host IP using Linux kernel FIB routing and network interfaces
 */
export function getPrimaryHostIp() {
  // 1. Explicit environment override (if set by administrator)
  const envHostIp = (process.env.HOST_IP || '').trim();
  if (envHostIp && !isInternalOrLoopback(envHostIp)) {
    return { ip: envHostIp, interface: 'env-override', method: 'environment' };
  }

  // 2. Linux Kernel FIB route query (determines default egress IP without sending packets)
  try {
    const routeOut = execSync('ip -4 route get 1.1.1.1 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 800,
    });
    const srcMatch = routeOut.match(/\bsrc\s+([0-9.]+)/);
    const devMatch = routeOut.match(/\bdev\s+(\S+)/);
    if (srcMatch && srcMatch[1] && !isInternalOrLoopback(srcMatch[1])) {
      return {
        ip: srcMatch[1],
        interface: devMatch ? devMatch[1] : 'unknown',
        method: 'kernel-route-fib',
      };
    }
  } catch (_) {}

  // 3. Fallback: inspect default route
  try {
    const defRoute = execSync('ip -4 route show default 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 800,
    });
    const srcMatch = defRoute.match(/\bsrc\s+([0-9.]+)/);
    const devMatch = defRoute.match(/\bdev\s+(\S+)/);

    if (srcMatch && srcMatch[1] && !isInternalOrLoopback(srcMatch[1])) {
      return {
        ip: srcMatch[1],
        interface: devMatch ? devMatch[1] : 'unknown',
        method: 'default-route-src',
      };
    }

    if (devMatch && devMatch[1]) {
      const ifaceName = devMatch[1];
      const ifaces = os.networkInterfaces();
      const addr = (ifaces[ifaceName] || []).find(
        (a) => !a.internal && a.family === 'IPv4' && !isInternalOrLoopback(a.address)
      );
      if (addr) {
        return {
          ip: addr.address,
          interface: ifaceName,
          method: 'default-route-dev',
        };
      }
    }
  } catch (_) {}

  // 4. Scan all host network interfaces with priority scoring
  const ifaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (isVirtualInterface(name)) continue;
    for (const addr of addrs || []) {
      if (!addr.internal && addr.family === 'IPv4' && !isInternalOrLoopback(addr.address)) {
        candidates.push({
          ip: addr.address,
          interface: name,
          priority: getInterfacePriority(name),
        });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.priority - a.priority);
    return {
      ip: candidates[0].ip,
      interface: candidates[0].interface,
      method: 'interface-priority-scan',
    };
  }

  // 5. Any non-internal IPv4 address
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs || []) {
      if (!addr.internal && addr.family === 'IPv4' && addr.address !== '127.0.0.1') {
        return {
          ip: addr.address,
          interface: name,
          method: 'fallback-non-internal',
        };
      }
    }
  }

  return { ip: '127.0.0.1', interface: 'lo', method: 'loopback-fallback' };
}

/**
 * Get all detected host network interfaces with descriptive labels
 */
export function getAllDetectedIps() {
  const primary = getPrimaryHostIp();
  const ifaces = os.networkInterfaces();
  const result = [];
  const seenIps = new Set();

  // First, add the primary host IP if valid
  if (primary.ip && primary.ip !== '127.0.0.1') {
    seenIps.add(primary.ip);
    result.push({
      interface: primary.interface,
      address: primary.ip,
      isPrimary: true,
      isHost: true,
      isDockerBridge: false,
      label: `Host Primary (${primary.interface}) [Auto-detected]`,
    });
  }

  // Scan remaining interfaces
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs || []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (seenIps.has(addr.address)) continue;
      seenIps.add(addr.address);

      const isDocker =
        isVirtualInterface(name) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(addr.address);
      const isPveBridge = name.toLowerCase().startsWith('vmbr');

      let label = `${name} (${addr.address})`;
      if (isPveBridge) {
        label = `Proxmox Bridge (${name})`;
      } else if (/^(eth|eno|enp|ens|em)[0-9]/.test(name.toLowerCase())) {
        label = `Physical Ethernet (${name})`;
      } else if (name.toLowerCase().startsWith('bond')) {
        label = `Bonded Network (${name})`;
      } else if (name.toLowerCase().startsWith('wl')) {
        label = `Host Wireless (${name})`;
      } else if (isDocker) {
        label = `Docker Bridge (Internal)`;
      }

      result.push({
        interface: name,
        address: addr.address,
        netmask: addr.netmask,
        isPrimary: false,
        isHost: !isDocker,
        isDockerBridge: isDocker,
        label,
      });
    }
  }

  return result;
}

/**
 * Resolve the effective server host considering database settings,
 * primary auto-detected IP, and optional request host.
 */
export function getEffectiveServerHost(reqHost = null) {
  // 1. User manual override stored in database
  try {
    const customHostSetting = db
      .prepare("SELECT value FROM settings WHERE key = 'nfs_server_host'")
      .get();
    if (customHostSetting?.value && !isInternalOrLoopback(customHostSetting.value)) {
      return customHostSetting.value.trim();
    }
  } catch (_) {}

  // 2. Auto-detected Primary Host IP
  const primary = getPrimaryHostIp();
  if (primary.ip && !isInternalOrLoopback(primary.ip)) {
    return primary.ip;
  }

  // 3. Request host if valid external domain or IP
  if (reqHost && !isInternalOrLoopback(reqHost)) {
    const cleanHost = reqHost.split(':')[0].trim();
    if (!isInternalOrLoopback(cleanHost)) {
      return cleanHost;
    }
  }

  // 4. Return primary IP or fallback
  return primary.ip || '127.0.0.1';
}
