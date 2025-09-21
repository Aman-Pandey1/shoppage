import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { saveMockData } from '../utils/mockStore.js';

const router = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin', email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

export default router;

// User auth endpoints
export const userAuthRouter = Router();
const isMock = process.env.USE_MOCK_DATA === 'true' || !process.env.MONGO_URI;

userAuthRouter.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (isMock) {
      const db = req.app.locals.mockData || { users: [] };
      const existing = (db.users || []).find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
      if (existing) return res.status(409).json({ error: 'Email already registered' });
      const passwordHash = await bcrypt.hash(password, 10);
      const user = { _id: `u-${Date.now()}`, email, name, passwordHash, createdAt: new Date().toISOString() };
      db.users = Array.isArray(db.users) ? db.users.concat([user]) : [user];
      req.app.locals.mockData = db;
      try { saveMockData(db); } catch {}
      const token = jwt.sign({ role: 'user', email: user.email, userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, email: user.email, name: user.name });
    } else {
      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ error: 'Email already registered' });
      const hash = await bcrypt.hash(password, 10);
      const user = await User.create({ email, name, passwordHash: hash });
      const token = jwt.sign({ role: 'user', email: user.email, userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, email: user.email, name: user.name });
    }
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

userAuthRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (isMock) {
      const db = req.app.locals.mockData || { users: [] };
      const user = (db.users || []).find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ role: 'user', email: user.email, userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, email: user.email, name: user.name });
    } else {
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ role: 'user', email: user.email, userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ token, email: user.email, name: user.name });
    }
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

