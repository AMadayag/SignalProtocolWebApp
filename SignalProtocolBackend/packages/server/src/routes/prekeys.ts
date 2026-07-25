import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { requireDeviceAuth, requireSelf } from '../middleware/auth.js';
import { sendToDevice } from '../websocket/connections.js';

export const prekeysRouter = Router();

/** Below this many remaining, we proactively tell the device (if connected) to top up. */
const ONE_TIME_PREKEY_LOW_WATERMARK = 5;
const KYBER_PREKEY_LOW_WATERMARK = 2;

// Keyed by the TARGET device being fetched, not the requester's IP —
// prevents an attacker from draining one specific person's prekey supply
// by hammering their bundle endpoint, without limiting a legitimate user
// who fetches many different people's bundles (starting several new chats).
const bundleFetchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.params.username}:${req.params.deviceId}`,
  message: { error: 'Too many bundle requests for this device. Try again shortly.' },
});

/**
 * Checks remaining prekey counts for a device and, if connected via
 * WebSocket, pushes a `topupNeeded` notification so the client can generate
 * and upload more without the user having to do anything. This is the
 * "automatic top-up" trigger — the actual key generation still has to
 * happen client-side, since the server never has private keys to make more.
 */
async function checkAndNotifyLowPreKeys(deviceDbId: string) {
  const [oneTimeRemaining, kyberRemaining] = await Promise.all([
    prisma.oneTimePreKey.findMany({ where: { deviceId: deviceDbId, used: false } }),
    prisma.kyberPreKey.findMany({ where: { deviceId: deviceDbId, used: false } }),
  ]);

  const needsOneTime = oneTimeRemaining.length <= ONE_TIME_PREKEY_LOW_WATERMARK;
  const needsKyber = kyberRemaining.length <= KYBER_PREKEY_LOW_WATERMARK;

  if (needsOneTime || needsKyber) {
    sendToDevice(deviceDbId, {
      type: 'topupNeeded',
      oneTimePreKeysRemaining: oneTimeRemaining.length,
      kyberPreKeysRemaining: kyberRemaining.length,
    });
  }
}

/**
 * GET /users/:username/:deviceId/bundle
 *
 * Public — anyone can fetch a bundle to start a session with this device,
 * the same way anyone can look someone up to start a Signal chat with them.
 * Consumes one one-time prekey (marks it used) and one Kyber prekey, since
 * both are meant to be used exactly once per session establishment.
 */
prekeysRouter.get('/users/:username/:deviceId/bundle', bundleFetchLimiter, async (req, res) => {
  const { username } = req.params;
  const deviceId = Number(req.params.deviceId);
  if (typeof username !== 'string') {
    res.status(400).json({ error: 'Invalid route parameters' });
    return;
  }

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

  // Fire-and-forget: don't block the response on this, and don't fail the
  // request if the device happens to not be connected right now.
  checkAndNotifyLowPreKeys(device.id).catch((err) =>
    console.error('Failed to check/notify low prekeys:', err)
  );

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
