import { DEFAULT_CATALOG } from '../services/catalog.js';

export function seedDefaults(db) {
  // Check if base_images table has data
  const baseCount = db.prepare('SELECT count(*) as count FROM base_images').get().count;
  if (baseCount === 0) {
    const insertBase = db.prepare(`
      INSERT INTO base_images (key, name, os, version, arch, url, format, filename, status)
      VALUES (@key, @name, @os, @version, @arch, @url, @format, @filename, 'not_downloaded')
    `);

    const insertMany = db.transaction((images) => {
      for (const img of images) insertBase.run(img);
    });
    insertMany(DEFAULT_CATALOG);
    console.log(`[DB Seed] Inserted ${DEFAULT_CATALOG.length} base OS image presets`);
  }

  // Check profiles table
  const profileCount = db.prepare('SELECT count(*) as count FROM profiles').get().count;
  if (profileCount === 0) {
    const insertProfile = db.prepare(`
      INSERT INTO profiles (
        name, description, os_family, root_password, enable_root_ssh, password_auth,
        install_cloud_init, install_guest_agent, remove_default_users, reset_machine_id,
        clean_ssh_host_keys, target_disk_size_gb, extra_packages, qemu_cores, qemu_memory, qemu_vga, is_default
      ) VALUES (
        @name, @description, @os_family, @root_password, @enable_root_ssh, @password_auth,
        @install_cloud_init, @install_guest_agent, @remove_default_users, @reset_machine_id,
        @clean_ssh_host_keys, @target_disk_size_gb, @extra_packages, @qemu_cores, @qemu_memory, @qemu_vga, @is_default
      )
    `);

    const defaultProfiles = [
      {
        name: 'PUQ WHMCS - Debian Standard',
        description: 'Optimized for Proxmox KVM WHMCS module. Root SSH login enabled, cloud-initramfs-growroot installed, machine-id reset, 5GB disk.',
        os_family: 'debian',
        root_password: 'puqcloud',
        enable_root_ssh: 1,
        password_auth: 1,
        install_cloud_init: 1,
        install_guest_agent: 1,
        remove_default_users: 1,
        reset_machine_id: 1,
        clean_ssh_host_keys: 1,
        target_disk_size_gb: 5,
        extra_packages: 'cloud-init, cloud-initramfs-growroot, cloud-utils, qemu-guest-agent, curl, wget, ca-certificates',
        qemu_cores: 1,
        qemu_memory: 1024,
        qemu_vga: 'std',
        is_default: 1,
      },
      {
        name: 'PUQ WHMCS - Ubuntu Standard',
        description: 'Optimized for Proxmox KVM WHMCS module. Root SSH enabled, cloud-initramfs-growroot, purge ubuntu user, 5GB disk.',
        os_family: 'ubuntu',
        root_password: 'puqcloud',
        enable_root_ssh: 1,
        password_auth: 1,
        install_cloud_init: 1,
        install_guest_agent: 1,
        remove_default_users: 1,
        reset_machine_id: 1,
        clean_ssh_host_keys: 1,
        target_disk_size_gb: 5,
        extra_packages: 'cloud-init, cloud-initramfs-growroot, cloud-utils, qemu-guest-agent, curl, wget, ca-certificates',
        qemu_cores: 1,
        qemu_memory: 1024,
        qemu_vga: 'std',
        is_default: 0,
      },
      {
        name: 'PUQ WHMCS - RHEL / Alma / Rocky',
        description: 'Optimized for Proxmox KVM WHMCS module. Root SSH enabled, cloud-utils-growpart, 10GB disk.',
        os_family: 'rhel',
        root_password: 'puqcloud',
        enable_root_ssh: 1,
        password_auth: 1,
        install_cloud_init: 1,
        install_guest_agent: 1,
        remove_default_users: 1,
        reset_machine_id: 1,
        clean_ssh_host_keys: 1,
        target_disk_size_gb: 10,
        extra_packages: 'cloud-init, cloud-utils-growpart, qemu-guest-agent, curl, wget',
        qemu_cores: 1,
        qemu_memory: 2048,
        qemu_cpu_type: 'host',
        qemu_vga: 'std',
        is_default: 0,
      },
      {
        name: 'PUQ WHMCS - Alpine Standard',
        description: 'Lightweight Alpine cloud template optimized for PUQ WHMCS module with cloud-init and qemu-guest-agent.',
        os_family: 'alpine',
        root_password: 'puqcloud',
        enable_root_ssh: 1,
        password_auth: 1,
        install_cloud_init: 1,
        install_guest_agent: 1,
        remove_default_users: 0,
        reset_machine_id: 1,
        clean_ssh_host_keys: 1,
        target_disk_size_gb: 3,
        extra_packages: 'cloud-init, qemu-guest-agent, curl',
        qemu_cores: 1,
        qemu_memory: 512,
        qemu_vga: 'std',
        is_default: 0,
      },
    ];

    const insertProfiles = db.transaction((profiles) => {
      for (const p of profiles) insertProfile.run(p);
    });
    insertProfiles(defaultProfiles);
    console.log(`[DB Seed] Inserted ${defaultProfiles.length} default profiles`);
  }

  // Check groups table
  const groupCount = db.prepare('SELECT count(*) as count FROM groups').get().count;
  if (groupCount === 0) {
    const insertGroup = db.prepare(`
      INSERT INTO groups (name, description, timezone, locale, nameservers, apt_mirror, region_code, package_mirrors)
      VALUES (@name, @description, @timezone, @locale, @nameservers, @apt_mirror, @region_code, @package_mirrors)
    `);

    const defaultGroups = [
      {
        name: 'Central Europe',
        description: 'Standard Central European preset (CET/CEST) with fast European routing and Cloudflare/Google DNS.',
        timezone: 'Europe/Warsaw',
        locale: 'en_US.UTF-8',
        nameservers: '1.1.1.1, 8.8.8.8',
        region_code: 'EU',
        apt_mirror: 'http://deb.debian.org/debian/',
        package_mirrors: JSON.stringify({
          debian: 'http://deb.debian.org/debian/',
          ubuntu: 'http://archive.ubuntu.com/ubuntu/',
          rhel: '',
          alpine: 'http://dl-cdn.alpinelinux.org/alpine/',
          archlinux: 'https://geo.mirror.pkgbuild.com/$repo/os/$arch',
          opensuse: 'http://download.opensuse.org/'
        }),
      },
      {
        name: 'US Central / North America',
        description: 'Central & Eastern United States preset (CST/CDT) with low-latency North American routing.',
        timezone: 'America/Chicago',
        locale: 'en_US.UTF-8',
        nameservers: '1.1.1.1, 8.8.8.8',
        region_code: 'US',
        apt_mirror: 'http://us.archive.ubuntu.com/ubuntu/',
        package_mirrors: JSON.stringify({
          debian: 'http://ftp.us.debian.org/debian/',
          ubuntu: 'http://us.archive.ubuntu.com/ubuntu/',
          rhel: '',
          alpine: 'http://dl-cdn.alpinelinux.org/alpine/',
          archlinux: 'https://geo.mirror.pkgbuild.com/$repo/os/$arch',
          opensuse: 'http://download.opensuse.org/'
        }),
      },
      {
        name: 'Canada Central',
        description: 'Central Canadian regional preset (Winnipeg / Toronto) with Canadian English/French support.',
        timezone: 'America/Winnipeg',
        locale: 'en_CA.UTF-8',
        nameservers: '1.1.1.1, 8.8.8.8',
        region_code: 'CA',
        apt_mirror: 'http://ca.archive.ubuntu.com/ubuntu/',
        package_mirrors: JSON.stringify({
          debian: 'http://ftp.ca.debian.org/debian/',
          ubuntu: 'http://ca.archive.ubuntu.com/ubuntu/',
          rhel: '',
          alpine: 'http://dl-cdn.alpinelinux.org/alpine/',
          archlinux: 'https://geo.mirror.pkgbuild.com/$repo/os/$arch',
          opensuse: 'http://download.opensuse.org/'
        }),
      },
      {
        name: 'China Mainland',
        description: 'Optimized for Mainland China: CST timezone, Alibaba/Tencent DNS (223.5.5.5, 119.29.29.29), and Aliyun mirrors.',
        timezone: 'Asia/Shanghai',
        locale: 'en_US.UTF-8',
        nameservers: '223.5.5.5, 119.29.29.29',
        region_code: 'CN',
        apt_mirror: 'http://mirrors.aliyun.com/debian/',
        package_mirrors: JSON.stringify({
          debian: 'http://mirrors.aliyun.com/debian/',
          ubuntu: 'http://mirrors.aliyun.com/ubuntu/',
          rhel: 'http://mirrors.aliyun.com/centos/',
          alpine: 'http://mirrors.aliyun.com/alpine/',
          archlinux: 'http://mirrors.aliyun.com/archlinux/$repo/os/$arch',
          opensuse: 'http://mirrors.aliyun.com/opensuse/'
        }),
      },
      {
        name: 'India',
        description: 'Indian Standard Time (IST UTC+5:30) with Indian regional mirrors and Cloudflare/Google DNS.',
        timezone: 'Asia/Kolkata',
        locale: 'en_IN.UTF-8',
        nameservers: '1.1.1.1, 8.8.8.8',
        region_code: 'IN',
        apt_mirror: 'http://in.archive.ubuntu.com/ubuntu/',
        package_mirrors: JSON.stringify({
          debian: 'http://deb.debian.org/debian/',
          ubuntu: 'http://in.archive.ubuntu.com/ubuntu/',
          rhel: '',
          alpine: 'http://dl-cdn.alpinelinux.org/alpine/',
          archlinux: 'https://geo.mirror.pkgbuild.com/$repo/os/$arch',
          opensuse: 'http://download.opensuse.org/'
        }),
      },
      {
        name: 'Global Standard (UTC)',
        description: 'Universal standard UTC preset recommended for cross-datacenter multi-cloud clusters.',
        timezone: 'UTC',
        locale: 'en_US.UTF-8',
        nameservers: '1.1.1.1, 8.8.8.8',
        region_code: 'GLOBAL',
        apt_mirror: '',
        package_mirrors: JSON.stringify({
          debian: '',
          ubuntu: '',
          rhel: '',
          alpine: '',
          archlinux: '',
          opensuse: ''
        }),
      },
    ];

    const insertGroups = db.transaction((groups) => {
      for (const g of groups) insertGroup.run(g);
    });
    insertGroups(defaultGroups);
    console.log(`[DB Seed] Inserted ${defaultGroups.length} default groups`);
  }
}
