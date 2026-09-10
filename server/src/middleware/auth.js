import jwt from 'jsonwebtoken';
import { ADMIN_USER, ADMIN_PASSWORD, JWT_SECRET } from '../config.js';

export function authenticate(req, res, next) {
  // Allow login endpoint
  if (req.path.startsWith('/api/auth/login') || req.path === '/auth/login') {
    return next();
  }

  // Allow open public template downloads and repository inspection (GET and HEAD only)
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (
      req.path.startsWith('/repository') ||
      req.path.startsWith('/download') ||
      req.path.startsWith('/repo') ||
      req.path === '/api/repository' ||
      req.path.startsWith('/api/repository/download')
    ) {
      return next();
    }
  }

  // Allow token via header, query parameter, or HTTP Basic Auth
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const b64 = authHeader.split(' ')[1];
      const credentials = Buffer.from(b64, 'base64').toString('ascii');
      const [u, p] = credentials.split(':');
      if (u === ADMIN_USER && p === ADMIN_PASSWORD) {
        req.user = { username: ADMIN_USER, role: 'admin' };
        return next();
      }
    } catch (_) {}
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.username !== ADMIN_USER) {
      return res.status(403).json({ error: 'Forbidden: Invalid user' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}
