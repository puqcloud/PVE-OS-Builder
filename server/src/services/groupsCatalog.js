import fs from 'fs';
import path from 'path';
import { CONFIGS_DIR } from '../config.js';

export const GROUPS_CONFIG_PATH = path.join(CONFIGS_DIR, 'localization_groups.json');

export const DEFAULT_GROUPS = [
  {
    key: 'central-europe',
    name: 'Central Europe',
    description: 'Standard Central European preset (CET/CEST) with fast European routing and Cloudflare/Google DNS.',
    timezone: 'Europe/Warsaw',
    locale: 'en_US.UTF-8',
    nameservers: '1.1.1.1, 8.8.8.8',
    region_code: 'EU',
    apt_mirror: 'http://deb.debian.org/debian/',
    package_mirrors: {
      debian: 'http://deb.debian.org/debian/',
      ubuntu: 'http://archive.ubuntu.com/ubuntu/',
      rhel: '',
      alpine: 'http://dl-cdn.alpinelinux.org/alpine/',
      archlinux: 'https://geo.mirror.pkgbuild.com/$repo/os/$arch',
      opensuse: 'http://download.opensuse.org/'
    },
    custom_script: '',
  },
  {
    key: 'us-central',
    name: 'US Central / North America',
    description: 'Central & Eastern United States preset (CST/CDT) with low-latency North American routing.',
    timezone: 'America/Chicago',
    locale: 'en_US.UTF-8',
    nameservers: '1.1.1.1, 8.8.8.8',
    region_code: 'US',
    apt_mirror: 'http://us.archive.ubuntu.com/ubuntu/',
    package_mirrors: {
      debian: 'http://ftp.us.debian.org/debian/',
      ubuntu: 'http://us.archive.ubuntu.com/ubuntu/',
      rhel: '',
      alpine: 'http://dl-cdn.alpinelinux.org/alpine/',
      archlinux: 'https://geo.mirror.pkgbuild.com/$repo/os/$arch',
      opensuse: 'http://download.opensuse.org/'
    },
    custom_script: '',
  },
  {
    key: 'canada-central',
    name: 'Canada Central',
    description: 'Central Canadian regional preset (Winnipeg / Toronto) with Canadian English/French support.',
    timezone: 'America/Winnipeg',
    locale: 'en_CA.UTF-8',
    nameservers: '1.1.1.1, 8.8.8.8',
    region_code: 'CA',
    apt_mirror: 'http://ca.archive.ubuntu.com/ubuntu/',
    package_mirrors: {
      debian: 'http://ftp.ca.debian.org/debian/',
      ubuntu: 'http://ca.archive.ubuntu.com/ubuntu/',
      rhel: '',
      alpine: 'http://dl-cdn.alpinelinux.org/alpine/',
      archlinux: 'https://geo.mirror.pkgbuild.com/$repo/os/$arch',
      opensuse: 'http://download.opensuse.org/'
    },
    custom_script: '',
  },
  {
    key: 'china-mainland',
    name: 'China Mainland',
    description: 'Optimized for Mainland China: CST timezone, Alibaba/Tencent DNS (223.5.5.5, 119.29.29.29), and Aliyun mirrors.',
    timezone: 'Asia/Shanghai',
    locale: 'en_US.UTF-8',
    nameservers: '223.5.5.5, 119.29.29.29',
    region_code: 'CN',
    apt_mirror: 'http://mirrors.aliyun.com/debian/',
    package_mirrors: {
      debian: 'http://mirrors.aliyun.com/debian/',
      ubuntu: 'http://mirrors.aliyun.com/ubuntu/',
      rhel: 'http://mirrors.aliyun.com/centos/',
      alpine: 'http://mirrors.aliyun.com/alpine/',
      archlinux: 'http://mirrors.aliyun.com/archlinux/$repo/os/$arch',
      opensuse: 'http://mirrors.aliyun.com/opensuse/'
    },
    custom_script: '',
  },
  {
    key: 'india',
    name: 'India',
    description: 'Indian Standard Time (IST UTC+5:30) with Indian regional mirrors and Cloudflare/Google DNS.',
    timezone: 'Asia/Kolkata',
    locale: 'en_IN.UTF-8',
    nameservers: '1.1.1.1, 8.8.8.8',
    region_code: 'IN',
    apt_mirror: 'http://in.archive.ubuntu.com/ubuntu/',
    package_mirrors: {
      debian: 'http://deb.debian.org/debian/',
      ubuntu: 'http://in.archive.ubuntu.com/ubuntu/',
      rhel: '',
      alpine: 'http://dl-cdn.alpinelinux.org/alpine/',
      archlinux: 'https://geo.mirror.pkgbuild.com/$repo/os/$arch',
      opensuse: 'http://download.opensuse.org/'
    },
    custom_script: '',
  },
  {
    key: 'global-utc',
    name: 'Global Standard (UTC)',
    description: 'Universal standard UTC preset recommended for cross-datacenter multi-cloud clusters.',
    timezone: 'UTC',
    locale: 'en_US.UTF-8',
    nameservers: '1.1.1.1, 8.8.8.8',
    region_code: 'GLOBAL',
    apt_mirror: '',
    package_mirrors: {
      debian: '',
      ubuntu: '',
      rhel: '',
      alpine: '',
      archlinux: '',
      opensuse: ''
    },
    custom_script: '',
  },
];

export function syncGroupsWithDatabase(db) {
  if (!fs.existsSync(CONFIGS_DIR)) {
    fs.mkdirSync(CONFIGS_DIR, { recursive: true });
  }

  let groups = [];

  if (fs.existsSync(GROUPS_CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(GROUPS_CONFIG_PATH, 'utf-8');
      groups = JSON.parse(raw);
      console.log(`[Groups] Loaded ${groups.length} localization groups from ${GROUPS_CONFIG_PATH}`);
    } catch (err) {
      console.error(`[Groups] Error reading ${GROUPS_CONFIG_PATH}, fallback to defaults:`, err.message);
      groups = DEFAULT_GROUPS;
      fs.writeFileSync(GROUPS_CONFIG_PATH, JSON.stringify(DEFAULT_GROUPS, null, 2), 'utf-8');
    }
  } else {
    groups = DEFAULT_GROUPS;
    fs.writeFileSync(GROUPS_CONFIG_PATH, JSON.stringify(DEFAULT_GROUPS, null, 2), 'utf-8');
    console.log(`[Groups] Initialized ${GROUPS_CONFIG_PATH} with default regional standards`);
  }

  // Ensure region_code and package_mirrors columns exist in groups table
  try {
    db.exec(`ALTER TABLE groups ADD COLUMN region_code TEXT DEFAULT 'GLOBAL';`);
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE groups ADD COLUMN package_mirrors TEXT DEFAULT '{}';`);
  } catch (_) {}

  const findByName = db.prepare('SELECT * FROM groups WHERE name = ?');
  const insertStmt = db.prepare(`
    INSERT INTO groups (name, description, timezone, locale, nameservers, apt_mirror, region_code, package_mirrors, custom_script)
    VALUES (@name, @description, @timezone, @locale, @nameservers, @apt_mirror, @region_code, @package_mirrors, @custom_script)
  `);
  const updateStmt = db.prepare(`
    UPDATE groups SET
      description = @description,
      timezone = @timezone,
      locale = @locale,
      nameservers = @nameservers,
      apt_mirror = @apt_mirror,
      region_code = @region_code,
      package_mirrors = @package_mirrors,
      custom_script = @custom_script,
      updated_at = CURRENT_TIMESTAMP
    WHERE name = @name
  `);

  const syncTx = db.transaction((items) => {
    for (const item of items) {
      const existing = findByName.get(item.name);
      let mirrorsStr = '{}';
      if (item.package_mirrors) {
        mirrorsStr = typeof item.package_mirrors === 'string' ? item.package_mirrors : JSON.stringify(item.package_mirrors);
      } else if (item.apt_mirror) {
        mirrorsStr = JSON.stringify({ debian: item.apt_mirror, ubuntu: item.apt_mirror });
      }

      const params = {
        name: item.name,
        description: item.description || '',
        timezone: item.timezone || 'UTC',
        locale: item.locale || 'en_US.UTF-8',
        nameservers: item.nameservers || '1.1.1.1, 8.8.8.8',
        apt_mirror: item.apt_mirror || '',
        region_code: item.region_code || 'GLOBAL',
        package_mirrors: mirrorsStr,
        custom_script: item.custom_script || '',
      };
      if (existing) {
        updateStmt.run(params);
      } else {
        insertStmt.run(params);
      }
    }
  });

  syncTx(groups);
  console.log(`[Groups] Synchronized ${groups.length} regional groups into SQLite database`);
}

export function saveDatabaseGroupsToFile(db) {
  try {
    const groups = db.prepare(`
      SELECT name, description, timezone, locale, nameservers, apt_mirror, region_code, package_mirrors, custom_script
      FROM groups
      ORDER BY id ASC
    `).all().map((g) => {
      let mirrors = {};
      try {
        mirrors = g.package_mirrors ? JSON.parse(g.package_mirrors) : {};
      } catch (_) {
        mirrors = {};
      }
      return {
        name: g.name,
        description: g.description || '',
        timezone: g.timezone || 'UTC',
        locale: g.locale || 'en_US.UTF-8',
        nameservers: g.nameservers || '1.1.1.1, 8.8.8.8',
        region_code: g.region_code || 'GLOBAL',
        apt_mirror: g.apt_mirror || '',
        package_mirrors: mirrors,
        custom_script: g.custom_script || '',
      };
    });

    fs.writeFileSync(GROUPS_CONFIG_PATH, JSON.stringify(groups, null, 2), 'utf-8');
    console.log(`[Groups] Saved ${groups.length} groups to ${GROUPS_CONFIG_PATH}`);
  } catch (err) {
    console.error(`[Groups] Failed to save groups JSON:`, err.message);
  }
}
