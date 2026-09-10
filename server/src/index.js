import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { PORT, OUTPUT_DIR } from './config.js';
import { initDatabase } from './db/index.js';
import { authenticate } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import baseImagesRoutes from './routes/baseImages.js';
import profilesRoutes from './routes/profiles.js';
import groupsRoutes from './routes/groups.js';
import buildsRoutes from './routes/builds.js';
import repositoryRoutes from './routes/repository.js';
import settingsRoutes from './routes/settings.js';
import nfsRoutes from './routes/nfs.js';
import publicRepoRoutes from './routes/publicRepo.js';

// Initialize SQLite database and tables
initDatabase();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public Template Repository & Downloads (Open for Proxmox VE wget/curl and HTML browser view)
app.use('/', publicRepoRoutes);

// API Routes
app.use('/api/auth', authRoutes);

// Protected API routes
app.use('/api', authenticate);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/base-images', baseImagesRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/builds', buildsRoutes);
app.use('/api/repository', repositoryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/nfs', nfsRoutes);

// Serve Frontend in production (client/dist)
const clientDist = path.resolve(process.cwd(), '../client/dist');
const altClientDist = path.resolve(process.cwd(), './client/dist');

const activeDist = fs.existsSync(clientDist) ? clientDist : (fs.existsSync(altClientDist) ? altClientDist : null);

if (activeDist) {
  console.log(`[Static] Serving frontend static assets from: ${activeDist}`);
  app.use(express.static(activeDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(activeDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('PVE OS Builder API is running. (Client build not found, start Vite dev server on port 5173)');
  });
}

// Process-level crash prevention
process.on('uncaughtException', (err) => {
  if (err?.code === 'ABORT_ERR' || err?.name === 'AbortError') {
    return; // Expected on user-cancelled download streams
  }
  console.error('[Process Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process Unhandled Rejection]:', reason);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  Proxmox OS Template Builder (pve-os-builder)     `);
  console.log(`  Server running on http://0.0.0.0:${PORT}          `);
  console.log(`====================================================`);
});
