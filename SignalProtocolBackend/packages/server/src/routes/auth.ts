import { Router } from 'express';
import { hashPassword, verifyPassword, generateToken } from '../services/authServices.js';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRouter = Router();

authRouter.post('/signup', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const hashed = await hashPassword(password);

  let user;
  try {
    user = await prisma.user.create({ data: { username, password: hashed } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create user' });
    return;
  }

  const token = generateToken({ userId: user.id, username: user.username });
  res.status(201).json({ token });
});

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    // Same error as a wrong password, so we don't leak which usernames exist.
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const token = generateToken({ userId: user.id, username: user.username });
  res.json({ token });
});

/** Lets the frontend confirm a stored token is still valid on app load. */
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ userId: req.user!.userId, username: req.user!.username });
});
