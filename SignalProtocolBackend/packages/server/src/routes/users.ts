import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const usersRouter = Router();

/**
 * GET /users/me
 *
 * Auth required (account-level JWT). Returns the logged-in user's account
 * info plus a list of their registered devices (metadata only — no keys).
 */
usersRouter.get('/users/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const devices = await prisma.device.findMany({ where: { userId: user.id } });

  res.json({
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    devices: devices.map((d) => ({ deviceId: d.deviceId, createdAt: d.createdAt })),
  });
});

/**
 * GET /users/:username
 *
 * Public — lets a client check whether a username exists before trying to
 * message them or fetch a bundle, without exposing anything sensitive.
 */
usersRouter.get('/users/:username', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { username: req.params.username } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const devices = await prisma.device.findMany({ where: { userId: user.id } });

  res.json({
    username: user.username,
    deviceIds: devices.map((d) => d.deviceId),
  });
});
