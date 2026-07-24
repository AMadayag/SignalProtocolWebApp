import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const registerRouter = Router();

interface RegisterBody {
  deviceId: number;
  registrationId: number;
  identityKey: string; // base64
  signedPreKey: { id: number; publicKey: string; signature: string };
  // Batch, not singular: each Kyber prekey is single-use (consumed on
  // bundle fetch), so a device needs a real supply, not just one — the
  // same reasoning as oneTimePreKeys below.
  kyberPreKeys: Array<{ id: number; publicKey: string; signature: string }>;
  oneTimePreKeys: Array<{ id: number; publicKey: string }>;
}

/**
 * POST /register
 *
 * Registers a device's Signal Protocol key material against the CALLING
 * user's account (identified by their login JWT, not by a username in the
 * body — otherwise anyone could attach device keys to anyone else's account
 * just by guessing usernames).
 */
registerRouter.post('/register', requireAuth, async (req, res) => {
  const body = req.body as RegisterBody;

  if (
    typeof body?.deviceId !== 'number' ||
    typeof body.registrationId !== 'number' ||
    !body.identityKey ||
    !body.signedPreKey ||
    !Array.isArray(body.kyberPreKeys) ||
    body.kyberPreKeys.length === 0 ||
    !Array.isArray(body.oneTimePreKeys)
  ) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const userId = req.user!.userId;

  const existing = await prisma.device.findFirst({
    where: { userId, deviceId: body.deviceId },
  });
  if (existing) {
    res.status(409).json({ error: 'This deviceId is already registered for this user' });
    return;
  }

  const authToken = crypto.randomBytes(32).toString('hex');

  const device = await prisma.device.create({
    data: {
      userId,
      deviceId: body.deviceId,
      registrationId: body.registrationId,
      identityKey: body.identityKey,
      authToken,
    },
  });

  await prisma.signedPreKey.create({
    data: {
      deviceId: device.id,
      keyId: body.signedPreKey.id,
      publicKey: body.signedPreKey.publicKey,
      signature: body.signedPreKey.signature,
    },
  });

  await prisma.kyberPreKey.createMany({
    data: body.kyberPreKeys.map((pk) => ({
      deviceId: device.id,
      keyId: pk.id,
      publicKey: pk.publicKey,
      signature: pk.signature,
    })),
  });

  if (body.oneTimePreKeys.length > 0) {
    await prisma.oneTimePreKey.createMany({
      data: body.oneTimePreKeys.map((pk) => ({
        deviceId: device.id,
        keyId: pk.id,
        publicKey: pk.publicKey,
      })),
    });
  }

  res.status(201).json({ authToken });
});
