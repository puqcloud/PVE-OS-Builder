import fs from 'fs';
import path from 'path';
import { CATALOG_CONFIG_PATH, CONFIGS_DIR, DOWNLOADS_DIR } from '../config.js';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function compareImageVersionsDesc(a, b) {
  const verA = String(a.version || '');
  const verB = String(b.version || '');
  const cmp = collator.compare(verA, verB);
  if (cmp !== 0) return -cmp;
  return collator.compare(String(b.name || ''), String(a.name || ''));
}

export const OS_SORT_ORDER = [
  'debian',
  'ubuntu',
  'almalinux',
  'rocky',
  'centos',
  'alpine',
  'fedora',
  'opensuse',
  'archlinux',
];

export function sortImagesCanonical(images) {
  return images.sort((a, b) => {
    const osA = String(a.os || '').toLowerCase();
    const osB = String(b.os || '').toLowerCase();
    const idxA = OS_SORT_ORDER.indexOf(osA);
    const idxB = OS_SORT_ORDER.indexOf(osB);
    const orderA = idxA !== -1 ? idxA : 999;
    const orderB = idxB !== -1 ? idxB : 999;
    if (orderA !== orderB) return orderA - orderB;
    return compareImageVersionsDesc(a, b);
  });
}

export const DEFAULT_CATALOG = [
  // Debian
  {
    key: 'debian-13-amd64',
    name: 'Debian 13 (Trixie) GenericCloud',
    os: 'debian',
    version: '13',
    arch: 'amd64',
    url: 'https://cloud.debian.org/images/cloud/trixie/latest/debian-13-genericcloud-amd64.qcow2',
    format: 'qcow2',
    filename: 'debian-13-genericcloud-amd64.qcow2',
  },
  {
    key: 'debian-12-amd64',
    name: 'Debian 12 (Bookworm) GenericCloud',
    os: 'debian',
    version: '12',
    arch: 'amd64',
    url: 'https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-genericcloud-amd64.qcow2',
    format: 'qcow2',
    filename: 'debian-12-genericcloud-amd64.qcow2',
  },
  {
    key: 'debian-11-amd64',
    name: 'Debian 11 (Bullseye) GenericCloud',
    os: 'debian',
    version: '11',
    arch: 'amd64',
    url: 'https://cloud.debian.org/images/cloud/bullseye/latest/debian-11-genericcloud-amd64.qcow2',
    format: 'qcow2',
    filename: 'debian-11-genericcloud-amd64.qcow2',
  },
  {
    key: 'debian-10-amd64',
    name: 'Debian 10 (Buster) GenericCloud',
    os: 'debian',
    version: '10',
    arch: 'amd64',
    url: 'https://cloud.debian.org/images/cloud/buster/latest/debian-10-genericcloud-amd64.qcow2',
    format: 'qcow2',
    filename: 'debian-10-genericcloud-amd64.qcow2',
  },

  // Ubuntu (latest releases including 26.10, 26.04 LTS, 24.10, 24.04 LTS)
  {
    key: 'ubuntu-2610-amd64',
    name: 'Ubuntu 26.10 (Stonking Stingray)',
    os: 'ubuntu',
    version: '26.10',
    arch: 'amd64',
    url: 'https://cloud-images.ubuntu.com/stonking/current/stonking-server-cloudimg-amd64.img',
    format: 'qcow2',
    filename: 'ubuntu-26.10-server-cloudimg-amd64.qcow2',
  },
  {
    key: 'ubuntu-2604-amd64',
    name: 'Ubuntu 26.04 LTS (Resolute Raccoon)',
    os: 'ubuntu',
    version: '26.04',
    arch: 'amd64',
    url: 'https://cloud-images.ubuntu.com/resolute/current/resolute-server-cloudimg-amd64.img',
    format: 'qcow2',
    filename: 'ubuntu-26.04-server-cloudimg-amd64.qcow2',
  },
  {
    key: 'ubuntu-2410-amd64',
    name: 'Ubuntu 24.10 (Oracular Oriole)',
    os: 'ubuntu',
    version: '24.10',
    arch: 'amd64',
    url: 'https://cloud-images.ubuntu.com/releases/24.10/release/ubuntu-24.10-server-cloudimg-amd64.img',
    format: 'qcow2',
    filename: 'ubuntu-24.10-server-cloudimg-amd64.qcow2',
  },
  {
    key: 'ubuntu-2404-amd64',
    name: 'Ubuntu 24.04 LTS (Noble Numbat)',
    os: 'ubuntu',
    version: '24.04',
    arch: 'amd64',
    url: 'https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img',
    format: 'qcow2',
    filename: 'ubuntu-24.04-server-cloudimg-amd64.qcow2',
  },
  {
    key: 'ubuntu-2204-amd64',
    name: 'Ubuntu 22.04 LTS (Jammy Jellyfish)',
    os: 'ubuntu',
    version: '22.04',
    arch: 'amd64',
    url: 'https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img',
    format: 'qcow2',
    filename: 'ubuntu-22.04-server-cloudimg-amd64.qcow2',
  },
  {
    key: 'ubuntu-2004-amd64',
    name: 'Ubuntu 20.04 LTS (Focal Fossa)',
    os: 'ubuntu',
    version: '20.04',
    arch: 'amd64',
    url: 'https://cloud-images.ubuntu.com/focal/current/focal-server-cloudimg-amd64.img',
    format: 'qcow2',
    filename: 'ubuntu-20.04-server-cloudimg-amd64.qcow2',
  },
  {
    key: 'ubuntu-1804-amd64',
    name: 'Ubuntu 18.04 LTS (Bionic Beaver)',
    os: 'ubuntu',
    version: '18.04',
    arch: 'amd64',
    url: 'https://cloud-images.ubuntu.com/bionic/current/bionic-server-cloudimg-amd64.img',
    format: 'qcow2',
    filename: 'ubuntu-18.04-server-cloudimg-amd64.qcow2',
  },

  // AlmaLinux (including latest AlmaLinux 10)
  {
    key: 'almalinux-10-amd64',
    name: 'AlmaLinux 10 GenericCloud',
    os: 'almalinux',
    version: '10',
    arch: 'amd64',
    url: 'https://repo.almalinux.org/almalinux/10/cloud/x86_64/images/AlmaLinux-10-GenericCloud-latest.x86_64.qcow2',
    format: 'qcow2',
    filename: 'almalinux-10-genericcloud-amd64.qcow2',
  },
  {
    key: 'almalinux-9-amd64',
    name: 'AlmaLinux 9 GenericCloud',
    os: 'almalinux',
    version: '9',
    arch: 'amd64',
    url: 'https://repo.almalinux.org/almalinux/9/cloud/x86_64/images/AlmaLinux-9-GenericCloud-latest.x86_64.qcow2',
    format: 'qcow2',
    filename: 'almalinux-9-genericcloud-amd64.qcow2',
  },
  {
    key: 'almalinux-8-amd64',
    name: 'AlmaLinux 8 GenericCloud',
    os: 'almalinux',
    version: '8',
    arch: 'amd64',
    url: 'https://repo.almalinux.org/almalinux/8/cloud/x86_64/images/AlmaLinux-8-GenericCloud-latest.x86_64.qcow2',
    format: 'qcow2',
    filename: 'almalinux-8-genericcloud-amd64.qcow2',
  },

  // Rocky Linux (including latest Rocky Linux 10)
  {
    key: 'rocky-10-amd64',
    name: 'Rocky Linux 10 GenericCloud',
    os: 'rocky',
    version: '10',
    arch: 'amd64',
    url: 'https://download.rockylinux.org/pub/rocky/10/images/x86_64/Rocky-10-GenericCloud-Base.latest.x86_64.qcow2',
    format: 'qcow2',
    filename: 'rocky-10-genericcloud-amd64.qcow2',
  },
  {
    key: 'rocky-9-amd64',
    name: 'Rocky Linux 9 GenericCloud',
    os: 'rocky',
    version: '9',
    arch: 'amd64',
    url: 'https://download.rockylinux.org/pub/rocky/9/images/x86_64/Rocky-9-GenericCloud-Base.latest.x86_64.qcow2',
    format: 'qcow2',
    filename: 'rocky-9-genericcloud-amd64.qcow2',
  },
  {
    key: 'rocky-8-amd64',
    name: 'Rocky Linux 8 GenericCloud',
    os: 'rocky',
    version: '8',
    arch: 'amd64',
    url: 'https://download.rockylinux.org/pub/rocky/8/images/x86_64/Rocky-8-GenericCloud-Base.latest.x86_64.qcow2',
    format: 'qcow2',
    filename: 'rocky-8-genericcloud-amd64.qcow2',
  },

  // CentOS Stream (including latest CentOS Stream 10)
  {
    key: 'centos-10-amd64',
    name: 'CentOS Stream 10 GenericCloud',
    os: 'centos',
    version: '10',
    arch: 'amd64',
    url: 'https://cloud.centos.org/centos/10-stream/x86_64/images/CentOS-Stream-GenericCloud-10-latest.x86_64.qcow2',
    format: 'qcow2',
    filename: 'centos-stream-10-genericcloud-amd64.qcow2',
  },
  {
    key: 'centos-9-amd64',
    name: 'CentOS Stream 9 GenericCloud',
    os: 'centos',
    version: '9',
    arch: 'amd64',
    url: 'https://cloud.centos.org/centos/9-stream/x86_64/images/CentOS-Stream-GenericCloud-9-latest.x86_64.qcow2',
    format: 'qcow2',
    filename: 'centos-stream-9-genericcloud-amd64.qcow2',
  },
  {
    key: 'centos-8-amd64',
    name: 'CentOS Stream 8 GenericCloud',
    os: 'centos',
    version: '8',
    arch: 'amd64',
    url: 'https://cloud.centos.org/centos/8-stream/x86_64/images/CentOS-Stream-GenericCloud-8-latest.x86_64.qcow2',
    format: 'qcow2',
    filename: 'centos-stream-8-genericcloud-amd64.qcow2',
  },

  // Alpine Linux (including latest Alpine 3.24, 3.23, 3.22, 3.21)
  {
    key: 'alpine-324-amd64',
    name: 'Alpine Linux 3.24 Cloud',
    os: 'alpine',
    version: '3.24',
    arch: 'amd64',
    url: 'https://dl-cdn.alpinelinux.org/alpine/v3.24/releases/cloud/generic_alpine-3.24.1-x86_64-bios-cloudinit-r0.qcow2',
    format: 'qcow2',
    filename: 'alpine-3.24-cloud-amd64.qcow2',
  },
  {
    key: 'alpine-323-amd64',
    name: 'Alpine Linux 3.23 Cloud',
    os: 'alpine',
    version: '3.23',
    arch: 'amd64',
    url: 'https://dl-cdn.alpinelinux.org/alpine/v3.23/releases/cloud/generic_alpine-3.23.0-x86_64-bios-cloudinit-r0.qcow2',
    format: 'qcow2',
    filename: 'alpine-3.23-cloud-amd64.qcow2',
  },
  {
    key: 'alpine-322-amd64',
    name: 'Alpine Linux 3.22 Cloud',
    os: 'alpine',
    version: '3.22',
    arch: 'amd64',
    url: 'https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/cloud/nocloud_alpine-3.22.0-x86_64-bios-cloudinit-r0.qcow2',
    format: 'qcow2',
    filename: 'alpine-3.22-cloud-amd64.qcow2',
  },
  {
    key: 'alpine-321-amd64',
    name: 'Alpine Linux 3.21 Cloud',
    os: 'alpine',
    version: '3.21',
    arch: 'amd64',
    url: 'https://dl-cdn.alpinelinux.org/alpine/v3.21/releases/cloud/nocloud_alpine-3.21.0-x86_64-bios-cloudinit-r0.qcow2',
    format: 'qcow2',
    filename: 'alpine-3.21-cloud-amd64.qcow2',
  },
  {
    key: 'alpine-320-amd64',
    name: 'Alpine Linux 3.20 Cloud',
    os: 'alpine',
    version: '3.20',
    arch: 'amd64',
    url: 'https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/cloud/nocloud_alpine-3.20.0-x86_64-bios-cloudinit-r0.qcow2',
    format: 'qcow2',
    filename: 'alpine-3.20-cloud-amd64.qcow2',
  },
  {
    key: 'alpine-319-amd64',
    name: 'Alpine Linux 3.19 Cloud',
    os: 'alpine',
    version: '3.19',
    arch: 'amd64',
    url: 'https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/cloud/nocloud_alpine-3.19.0-x86_64-bios-cloudinit-r0.qcow2',
    format: 'qcow2',
    filename: 'alpine-3.19-cloud-amd64.qcow2',
  },

  // Fedora Cloud (including latest Fedora 43, 42, 41)
  {
    key: 'fedora-43-amd64',
    name: 'Fedora 43 Cloud Base',
    os: 'fedora',
    version: '43',
    arch: 'amd64',
    url: 'https://download.fedoraproject.org/pub/fedora/linux/releases/43/Cloud/x86_64/images/Fedora-Cloud-Base-Generic-43-1.6.x86_64.qcow2',
    format: 'qcow2',
    filename: 'fedora-43-cloud-amd64.qcow2',
  },
  {
    key: 'fedora-42-amd64',
    name: 'Fedora 42 Cloud Base',
    os: 'fedora',
    version: '42',
    arch: 'amd64',
    url: 'https://download.fedoraproject.org/pub/fedora/linux/releases/42/Cloud/x86_64/images/Fedora-Cloud-Base-Generic-42-1.1.x86_64.qcow2',
    format: 'qcow2',
    filename: 'fedora-42-cloud-amd64.qcow2',
  },
  {
    key: 'fedora-41-amd64',
    name: 'Fedora 41 Cloud Base',
    os: 'fedora',
    version: '41',
    arch: 'amd64',
    url: 'https://download.fedoraproject.org/pub/fedora/linux/releases/41/Cloud/x86_64/images/Fedora-Cloud-Base-Generic-41-1.4.x86_64.qcow2',
    format: 'qcow2',
    filename: 'fedora-41-cloud-amd64.qcow2',
  },

  // openSUSE Leap (3 latest versions: 15.6, 15.5, 15.4)
  {
    key: 'opensuse-156-amd64',
    name: 'openSUSE Leap 15.6 Cloud',
    os: 'opensuse',
    version: '15.6',
    arch: 'amd64',
    url: 'https://download.opensuse.org/repositories/Cloud:/Images:/Leap_15.6/images/openSUSE-Leap-15.6.x86_64-NoCloud.qcow2',
    format: 'qcow2',
    filename: 'opensuse-15.6-cloud-amd64.qcow2',
  },
  {
    key: 'opensuse-155-amd64',
    name: 'openSUSE Leap 15.5 Cloud',
    os: 'opensuse',
    version: '15.5',
    arch: 'amd64',
    url: 'https://download.opensuse.org/repositories/Cloud:/Images:/Leap_15.5/images/openSUSE-Leap-15.5.x86_64-NoCloud.qcow2',
    format: 'qcow2',
    filename: 'opensuse-15.5-cloud-amd64.qcow2',
  },
  {
    key: 'opensuse-154-amd64',
    name: 'openSUSE Leap 15.4 Cloud',
    os: 'opensuse',
    version: '15.4',
    arch: 'amd64',
    url: 'https://download.opensuse.org/repositories/Cloud:/Images:/Leap_15.4/images/openSUSE-Leap-15.4.x86_64-NoCloud.qcow2',
    format: 'qcow2',
    filename: 'opensuse-15.4-cloud-amd64.qcow2',
  },

  // Arch Linux (3 latest official snapshot releases)
  {
    key: 'archlinux-20260901-amd64',
    name: 'Arch Linux 2026.09.01 Cloud',
    os: 'archlinux',
    version: '2026.09.01',
    arch: 'amd64',
    url: 'https://geo.mirror.pkgbuild.com/images/v20260901.583572/Arch-Linux-x86_64-cloudimg.qcow2',
    format: 'qcow2',
    filename: 'archlinux-2026.09.01-cloud-amd64.qcow2',
  },
  {
    key: 'archlinux-20260815-amd64',
    name: 'Arch Linux 2026.08.15 Cloud',
    os: 'archlinux',
    version: '2026.08.15',
    arch: 'amd64',
    url: 'https://geo.mirror.pkgbuild.com/images/v20260815.573966/Arch-Linux-x86_64-cloudimg.qcow2',
    format: 'qcow2',
    filename: 'archlinux-2026.08.15-cloud-amd64.qcow2',
  },
  {
    key: 'archlinux-20260801-amd64',
    name: 'Arch Linux 2026.08.01 Cloud',
    os: 'archlinux',
    version: '2026.08.01',
    arch: 'amd64',
    url: 'https://geo.mirror.pkgbuild.com/images/v20260801.566320/Arch-Linux-x86_64-cloudimg.qcow2',
    format: 'qcow2',
    filename: 'archlinux-2026.08.01-cloud-amd64.qcow2',
  },
];

/**
 * Merges official default base images into the current images_catalog.json file on disk.
 * Preserves existing custom entries and user modifications while adding newly supported versions
 * and repairing known broken default URLs.
 */
export function mergeDefaultCatalog(db) {
  if (!fs.existsSync(CONFIGS_DIR)) {
    fs.mkdirSync(CONFIGS_DIR, { recursive: true });
  }

  let catalog = [];
  if (fs.existsSync(CATALOG_CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CATALOG_CONFIG_PATH, 'utf-8');
      catalog = JSON.parse(raw);
      if (!Array.isArray(catalog)) catalog = [];
    } catch (err) {
      console.error(`[Catalog] Error reading existing catalog: ${err.message}`);
      catalog = [];
    }
  }

  let addedCount = 0;
  let updatedCount = 0;

  // Known obsolete or broken URLs to automatically correct
  const obsoleteUrlPatches = {
    'debian-13-amd64': {
      matchSubstring: 'cloud.debian.org/images/cloud/trixie/daily/latest',
      newUrl: 'https://cloud.debian.org/images/cloud/trixie/latest/debian-13-genericcloud-amd64.qcow2',
    },
  };

  const existingKeys = new Set(catalog.map((i) => i.key));

  for (const defaultItem of DEFAULT_CATALOG) {
    if (!existingKeys.has(defaultItem.key)) {
      catalog.push({ ...defaultItem });
      existingKeys.add(defaultItem.key);
      addedCount++;
      console.log(`[Catalog Auto-Merge] Added new OS version: ${defaultItem.name} (${defaultItem.key})`);
    } else {
      // Check if URL needs auto-correction
      const patch = obsoleteUrlPatches[defaultItem.key];
      const existingItem = catalog.find((i) => i.key === defaultItem.key);
      if (patch && existingItem && existingItem.url?.includes(patch.matchSubstring)) {
        existingItem.url = patch.newUrl;
        updatedCount++;
        console.log(`[Catalog Auto-Merge] Updated obsolete URL for: ${existingItem.name}`);
      }
    }
  }

  // Sort catalog so that within each OS, newer version is ALWAYS above older version
  sortImagesCanonical(catalog);

  if (addedCount > 0 || updatedCount > 0 || !fs.existsSync(CATALOG_CONFIG_PATH)) {
    fs.writeFileSync(CATALOG_CONFIG_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
    console.log(`[Catalog Auto-Merge] Updated ${CATALOG_CONFIG_PATH} (Added: ${addedCount}, Fixed: ${updatedCount})`);
  }

  // Synchronize with database
  syncCatalogItemsWithDatabase(db, catalog);

  return { addedCount, updatedCount, totalCount: catalog.length };
}

/**
 * Synchronizes the catalog with the SQLite database.
 * Automatically triggers an auto-merge of new default releases.
 */
export function syncCatalogWithDatabase(db) {
  return mergeDefaultCatalog(db);
}

function syncCatalogItemsWithDatabase(db, catalog) {
  const findByKey = db.prepare('SELECT * FROM base_images WHERE key = ?');
  const insertStmt = db.prepare(`
    INSERT INTO base_images (key, name, os, version, arch, url, format, filename, status, file_path, file_size, download_progress)
    VALUES (@key, @name, @os, @version, @arch, @url, @format, @filename, @status, @file_path, @file_size, @download_progress)
  `);
  const updateStmt = db.prepare(`
    UPDATE base_images SET
      name = @name,
      os = @os,
      version = @version,
      arch = @arch,
      url = @url,
      format = @format,
      filename = @filename,
      updated_at = CURRENT_TIMESTAMP
    WHERE key = @key
  `);

  const syncTx = db.transaction((items) => {
    for (const item of items) {
      const diskPath = path.join(DOWNLOADS_DIR, item.filename);
      let isReady = false;
      let size = 0;
      if (fs.existsSync(diskPath)) {
        try {
          const st = fs.statSync(diskPath);
          if (st.size > 1024 * 1024) {
            isReady = true;
            size = st.size;
          }
        } catch (_) {}
      }

      const existing = findByKey.get(item.key);
      if (existing) {
        const urlChanged = existing.url !== item.url;
        updateStmt.run(item);

        // If URL was fixed and status was previously error, reset to not_downloaded
        if (urlChanged && existing.status === 'error') {
          db.prepare(`
            UPDATE base_images 
            SET status = 'not_downloaded', error_message = NULL, download_progress = 0, updated_at = CURRENT_TIMESTAMP
            WHERE key = ?
          `).run(item.key);
        }

        if (isReady && existing.status !== 'ready') {
          db.prepare(`
            UPDATE base_images SET status = 'ready', file_path = ?, file_size = ?, download_progress = 100, updated_at = CURRENT_TIMESTAMP
            WHERE key = ?
          `).run(diskPath, size, item.key);
        }
      } else {
        insertStmt.run({
          ...item,
          status: isReady ? 'ready' : 'not_downloaded',
          file_path: isReady ? diskPath : null,
          file_size: isReady ? size : 0,
          download_progress: isReady ? 100 : 0,
        });
      }
    }
  });

  syncTx(catalog);
  console.log(`[Catalog] Synchronized ${catalog.length} images into SQLite database`);
}

export function saveDatabaseCatalogToFile(db) {
  try {
    const images = db.prepare(`
      SELECT key, name, os, version, arch, url, format, filename
      FROM base_images
    `).all();

    sortImagesCanonical(images);

    fs.writeFileSync(CATALOG_CONFIG_PATH, JSON.stringify(images, null, 2), 'utf-8');
    console.log(`[Catalog] Saved ${images.length} images to ${CATALOG_CONFIG_PATH}`);
  } catch (err) {
    console.error(`[Catalog] Failed to save catalog JSON:`, err.message);
  }
}
