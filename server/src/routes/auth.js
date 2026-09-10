import express from 'express';
import jwt from 'jsonwebtoken';
import { ADMIN_USER, ADMIN_PASSWORD, JWT_SECRET, JWT_EXPIRES_IN } from '../config.js';

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ username: ADMIN_USER, role: 'admin' }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return res.json({
    token,
    user: {
      username: ADMIN_USER,
      role: 'admin',
    },
  });
});

router.get('/me', (req, res) => {
  res.json({
    user: req.user,
  });
});

router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
