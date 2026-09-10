import Database from 'better-sqlite3';
import { DB_PATH } from '../config.js';
import { seedDefaults } from './seed.js';
import { syncCatalogWithDatabase } from '../services/catalog.js';
import { syncGroupsWithDatabase } from '../services/groupsCatalog.js';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS base_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      os TEXT NOT NULL,
      version TEXT NOT NULL,
      arch TEXT NOT NULL DEFAULT 'amd64',
      url TEXT NOT NULL,
      checksum TEXT,
      format TEXT NOT NULL DEFAULT 'qcow2',
      filename TEXT NOT NULL,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'not_downloaded',
      download_progress INTEGER DEFAULT 0,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      auto_update INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      os_family TEXT NOT NULL,
      root_password TEXT DEFAULT 'puqcloud',
      enable_root_ssh INTEGER DEFAULT 1,
      password_auth INTEGER DEFAULT 1,
      install_cloud_init INTEGER DEFAULT 1,
      install_guest_agent INTEGER DEFAULT 1,
      remove_default_users INTEGER DEFAULT 1,
      reset_machine_id INTEGER DEFAULT 1,
      clean_ssh_host_keys INTEGER DEFAULT 1,
      target_disk_size_gb INTEGER DEFAULT 5,
      extra_packages TEXT DEFAULT '',
      custom_script TEXT DEFAULT '',
      qemu_cores INTEGER DEFAULT 1,
      qemu_memory INTEGER DEFAULT 1024,
      qemu_net_model TEXT DEFAULT 'virtio',
      qemu_scsihw TEXT DEFAULT 'virtio-scsi-single',
      qemu_cpu_type TEXT DEFAULT 'host',
      qemu_bios TEXT DEFAULT 'seabios',
      qemu_machine TEXT DEFAULT 'pc',
      qemu_async_io TEXT DEFAULT 'io_uring',
      qemu_disk_cache TEXT DEFAULT 'none',
      qemu_discard INTEGER DEFAULT 1,
      qemu_ssd INTEGER DEFAULT 1,
      qemu_net_queues INTEGER DEFAULT 0,
      qemu_firewall INTEGER DEFAULT 1,
      qemu_vga TEXT DEFAULT 'std',
      qemu_watchdog INTEGER DEFAULT 0,
      cloud_init_user TEXT DEFAULT 'root',
      provider_ssh_key TEXT DEFAULT '',
      optimize_cloud_init_sources INTEGER DEFAULT 1,
      force_ssh_regen INTEGER DEFAULT 1,
      disable_password_expiry INTEGER DEFAULT 1,
      sysctl_tcp_bbr INTEGER DEFAULT 0,
      sysctl_file_limits INTEGER DEFAULT 0,
      sysctl_swappiness INTEGER DEFAULT 0,
      sysctl_syn_flood INTEGER DEFAULT 0,
      disable_ipv6 INTEGER DEFAULT 0,
      auto_security_updates INTEGER DEFAULT 0,
      enable_fail2ban INTEGER DEFAULT 0,
      ssh_custom_port INTEGER DEFAULT 22,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      timezone TEXT DEFAULT 'Europe/Warsaw',
      locale TEXT DEFAULT 'en_US.UTF-8',
      nameservers TEXT DEFAULT '1.1.1.1, 8.8.8.8',
      apt_mirror TEXT DEFAULT '',
      region_code TEXT DEFAULT 'GLOBAL',
      package_mirrors TEXT DEFAULT '{}',
      custom_script TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      build_number INTEGER UNIQUE,
      template_name TEXT NOT NULL,
      vmid INTEGER DEFAULT 9000,
      base_image_id INTEGER REFERENCES base_images(id),
      profile_id INTEGER REFERENCES profiles(id),
      group_id INTEGER REFERENCES groups(id),
      status TEXT NOT NULL DEFAULT 'queued',
      progress INTEGER DEFAULT 0,
      current_step TEXT DEFAULT 'Initialized',
      log TEXT DEFAULT '',
      output_filename TEXT,
      output_path TEXT,
      output_size INTEGER DEFAULT 0,
      output_sha256 TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  migrateProfilesSchema(db);
  migrateBaseImagesSchema(db);
  migrateGroupsSchema(db);
  seedDefaults(db);
  syncCatalogWithDatabase(db);
  syncGroupsWithDatabase(db);
  console.log(`[DB] Database initialized successfully at ${DB_PATH}`);
}

function migrateGroupsSchema(database) {
  try {
    const existingCols = database.prepare('PRAGMA table_info(groups)').all().map((c) => c.name);
    if (!existingCols.includes('region_code')) {
      database.prepare("ALTER TABLE groups ADD COLUMN region_code TEXT DEFAULT 'GLOBAL'").run();
      console.log('[DB Migration] Added column region_code to groups');
    }
    if (!existingCols.includes('package_mirrors')) {
      database.prepare("ALTER TABLE groups ADD COLUMN package_mirrors TEXT DEFAULT '{}'").run();
      console.log('[DB Migration] Added column package_mirrors to groups');
    }
  } catch (err) {
    console.error(`[DB Migration] Groups migration warning: ${err.message}`);
  }
}

function migrateBaseImagesSchema(database) {
  try {
    const existingCols = database.prepare('PRAGMA table_info(base_images)').all().map((c) => c.name);
    if (!existingCols.includes('retry_count')) {
      database.prepare('ALTER TABLE base_images ADD COLUMN retry_count INTEGER DEFAULT 0').run();
      console.log('[DB Migration] Added column retry_count to base_images');
    }
  } catch (err) {
    console.error(`[DB Migration] Base images migration warning: ${err.message}`);
  }
}

function migrateProfilesSchema(database) {
  const profileColumns = [
    { name: 'qemu_cpu_type', type: 'TEXT', default: "'host'" },
    { name: 'qemu_bios', type: 'TEXT', default: "'seabios'" },
    { name: 'qemu_machine', type: 'TEXT', default: "'pc'" },
    { name: 'qemu_async_io', type: 'TEXT', default: "'io_uring'" },
    { name: 'qemu_disk_cache', type: 'TEXT', default: "'none'" },
    { name: 'qemu_discard', type: 'INTEGER', default: '1' },
    { name: 'qemu_ssd', type: 'INTEGER', default: '1' },
    { name: 'qemu_net_queues', type: 'INTEGER', default: '0' },
    { name: 'qemu_firewall', type: 'INTEGER', default: '1' },
    { name: 'qemu_vga', type: 'TEXT', default: "'std'" },
    { name: 'qemu_watchdog', type: 'INTEGER', default: '0' },
    { name: 'cloud_init_user', type: 'TEXT', default: "'root'" },
    { name: 'provider_ssh_key', type: 'TEXT', default: "''" },
    { name: 'optimize_cloud_init_sources', type: 'INTEGER', default: '1' },
    { name: 'force_ssh_regen', type: 'INTEGER', default: '1' },
    { name: 'disable_password_expiry', type: 'INTEGER', default: '1' },
    { name: 'sysctl_tcp_bbr', type: 'INTEGER', default: '0' },
    { name: 'sysctl_file_limits', type: 'INTEGER', default: '0' },
    { name: 'sysctl_swappiness', type: 'INTEGER', default: '0' },
    { name: 'sysctl_syn_flood', type: 'INTEGER', default: '0' },
    { name: 'disable_ipv6', type: 'INTEGER', default: '0' },
    { name: 'auto_security_updates', type: 'INTEGER', default: '0' },
    { name: 'enable_fail2ban', type: 'INTEGER', default: '0' },
    { name: 'ssh_custom_port', type: 'INTEGER', default: '22' }
  ];

  try {
    const existingCols = database.prepare('PRAGMA table_info(profiles)').all().map((c) => c.name);
    for (const col of profileColumns) {
      if (!existingCols.includes(col.name)) {
        database.prepare(`ALTER TABLE profiles ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`).run();
        console.log(`[DB Migration] Added column ${col.name} to profiles`);
      }
    }

    // Proxmox valid machine types: 'pc' (i440fx) or 'q35'. Migrate any invalid 'i440fx' values to 'pc'
    database.prepare("UPDATE profiles SET qemu_machine = 'pc' WHERE qemu_machine = 'i440fx' OR qemu_machine IS NULL").run();
  } catch (err) {
    console.error(`[DB Migration] Profile migration warning: ${err.message}`);
  }
}

export default db;
