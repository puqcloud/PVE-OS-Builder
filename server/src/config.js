import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Default to /data in container, or ./data in local development
const defaultDataDir = process.env.NODE_ENV === 'production'
  ? '/data'
  : path.join(projectRoot, 'data');

export const DATA_DIR = process.env.DATA_DIR || defaultDataDir;
export const DB_DIR = process.env.DB_DIR || path.join(DATA_DIR, 'db');
export const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'pve-builder.db');
export const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(DATA_DIR, 'downloads');
export const CONFIGS_DIR = process.env.CONFIGS_DIR || path.join(DATA_DIR, 'configs');
export const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(DATA_DIR, 'repository');
export const SCRATCH_DIR = process.env.SCRATCH_DIR || path.join(DATA_DIR, 'scratch');
export const CATALOG_CONFIG_PATH = process.env.CATALOG_CONFIG_PATH || path.join(CONFIGS_DIR, 'images_catalog.json');

export const PORT = parseInt(process.env.PORT || '8080', 10);
export const ADMIN_USER = process.env.ADMIN_USER || 'admin';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
export const JWT_SECRET = process.env.JWT_SECRET || 'pve-os-builder-jwt-secret-key-2026';
export const JWT_EXPIRES_IN = '7d';

// Ensure all essential storage directories exist on startup
[DATA_DIR, DB_DIR, DOWNLOADS_DIR, CONFIGS_DIR, OUTPUT_DIR, SCRATCH_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
