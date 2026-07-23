import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireDeviceAuth, requireSelf } from '../middleware/auth.js';

export const prekeysRouter = Router();

/**
 * GET /users/:username/:deviceId/bundle
 *
 * Public — anyone can fetch a bundle to start a session with this device,
 * the same way anyone can look someone up to start a Signal chat with them.
 * Consumes one one-time prekey (marks it used) and one Kyber prekey, since
 * both are meant to be used exactly once per session establishment.
 */
prekeysRouter.get('/users/:username/:deviceId/bundle', async (req, res) => {
  const { username } = req.params;
  const deviceId = Number(req.params.deviceId);

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const device = await prisma.device.findFirst({
    where: { userId: user.id, deviceId },
    include: { signedPreKey: true },
  });
  if (!device || !device.signedPreKey) {
    res.status(404).json({ error: 'Device not found or not fully registered' });
    return;
  }

  // Grab one unused one-time prekey and mark it used, so it's never handed out twice.
  const oneTimePreKey = await prisma.oneTimePreKey.findFirst({
    where: { deviceId: device.id, used: false },
  });
  if (oneTimePreKey) {
    await prisma.oneTimePreKey.update({
      where: { id: oneTimePreKey.id },
      data: { used: true },
    });
  }

  const kyberPreKey = await prisma.kyberPreKey.findFirst({
    where: { deviceId: device.id, used: false },
  });
  if (!kyberPreKey) {
    // Current libsignal requires a Kyber prekey for PQXDH — no fallback here.
    res.status(503).json({ error: 'Device has no available Kyber prekeys; ask them to top up' });
    return;
  }
  await prisma.kyberPreKey.update({
    where: { id: kyberPreKey.id },
    data: { used: true },
  });

  res.json({
    registrationId: device.registrationId,
    deviceId: device.deviceId,
    identityKey: device.identityKey,
    signedPreKey: {
      id: device.signedPreKey.keyId,
      publicKey: device.signedPreKey.publicKey,
      signature: device.signedPreKey.signature,
    },
    kyberPreKey: {
      id: kyberPreKey.keyId,
      publicKey: kyberPreKey.publicKey,
      signature: kyberPreKey.signature,
    },
    oneTimePreKey: oneTimePreKey
      ? { id: oneTimePreKey.keyId, publicKey: oneTimePreKey.publicKey }
      : null,
  });
});

/**
 * GET /users/:username/:deviceId/prekey-count
 *
 * Auth required (self only). Lets a client check its own remaining supply
 * so it knows when to top up, mirroring what a real client polls for.
 */
prekeysRouter.get(
  '/users/:username/:deviceId/prekey-count',
  requireDeviceAuth,
  requireSelf('username', 'deviceId'),
  async (req, res) => {
    const device = req.device!;
    const [oneTimeCount, kyberCount] = await Promise.all([
      prisma.oneTimePreKey.findMany({ where: { deviceId: device.id, used: false } }),
      prisma.kyberPreKey.findMany({ where: { deviceId: device.id, used: false } }),
    ]);
    res.json({ oneTimePreKeys: oneTimeCount.length, kyberPreKeys: kyberCount.length });
  }
);

interface TopUpBody {
  oneTimePreKeys?: Array<{ id: number; publicKey: string }>;
  kyberPreKeys?: Array<{ id: number; publicKey: string; signature: string }>;
}

/**
 * POST /users/:username/:deviceId/prekeys
 *
 * Auth required (self only) — otherwise anyone could flood another device's
 * prekey supply or exhaust it with junk keys.
 */
prekeysRouter.post(
  '/users/:username/:deviceId/prekeys',
  requireDeviceAuth,
  requireSelf('username', 'deviceId'),
  async (req, res) => {
    const device = req.device!;
    const body = req.body as TopUpBody;

    if (body.oneTimePreKeys?.length) {
      await prisma.oneTimePreKey.createMany({
        data: body.oneTimePreKeys.map((pk) => ({
          deviceId: device.id,
          keyId: pk.id,
          publicKey: pk.publicKey,
        })),
      });
    }

    if (body.kyberPreKeys?.length) {
      await prisma.kyberPreKey.createMany({
        data: body.kyberPreKeys.map((pk) => ({
          deviceId: device.id,
          keyId: pk.id,
          publicKey: pk.publicKey,
          signature: pk.signature,
        })),
      });
    }

    res.status(201).json({ ok: true });
  }
);
