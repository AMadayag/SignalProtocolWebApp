import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../db/prisma.js';

export const registerRouter = Router();

interface RegisterBody {
  username: string; // must already have a User account (via your existing signup route)
  deviceId: number;
  registrationId: number;
  identityKey: string; // base64
  signedPreKey: { id: number; publicKey: string; signature: string };
  kyberPreKey: { id: number; publicKey: string; signature: string };
  oneTimePreKeys: Array<{ id: number; publicKey: string }>;
}

/**
 * POST /register
 *
 * Registers a device's Signal Protocol key material against an existing
 * User account. This is separate from username/password signup — that
 * creates the account; this attaches a device's crypto identity to it.
 * Returns a bearer token used to authenticate this device on future requests
 * (bundle fetches don't need it, since bundles are public; top-ups and the
 * WebSocket connection do).
 */
registerRouter.post('/register', async (req, res) => {
  const body = req.body as RegisterBody;

  if (
    !body?.username ||
    typeof body.deviceId !== 'number' ||
    typeof body.registrationId !== 'number' ||
    !body.identityKey ||
    !body.signedPreKey ||
    !body.kyberPreKey ||
    !Array.isArray(body.oneTimePreKeys)
  ) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { username: body.username } });
  if (!user) {
    res.status(404).json({ error: 'No account found for this username — sign up first' });
    return;
  }

  const existing = await prisma.device.findFirst({
    where: { userId: user.id, deviceId: body.deviceId },
  });
  if (existing) {
    res.status(409).json({ error: 'This deviceId is already registered for this user' });
    return;
  }

  const authToken = crypto.randomBytes(32).toString('hex');

  const device = await prisma.device.create({
    data: {
      userId: user.id,
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

  await prisma.kyberPreKey.create({
    data: {
      deviceId: device.id,
      keyId: body.kyberPreKey.id,
      publicKey: body.kyberPreKey.publicKey,
      signature: body.kyberPreKey.signature,
    },
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
