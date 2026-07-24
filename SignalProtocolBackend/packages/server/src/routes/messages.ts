import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireDeviceAuth, requireSelf } from '../middleware/auth.js';

export const messagesRouter = Router();

/**
 * GET /messages/:username/:deviceId/with/:peerUsername/:peerDeviceId
 *
 * Auth required (self only). Returns the ciphertext history between this
 * device and a specific peer device, oldest first. This is separate from
 * the WebSocket, which only handles live delivery and offline queueing —
 * this route is what a client calls to load prior conversation history
 * (e.g. on opening a chat, or after clearing local storage).
 *
 * Note: this returns ciphertext only. Decryption happens client-side, same
 * as live messages — the server has no way to decrypt these even if it
 * wanted to.
 */
messagesRouter.get(
  '/messages/:username/:deviceId/with/:peerUsername/:peerDeviceId',
  requireDeviceAuth,
  requireSelf('username', 'deviceId'),
  async (req, res) => {
    const device = req.device!;
    const { peerUsername, peerDeviceId } = req.params;
    if (typeof peerUsername !== 'string' || typeof peerDeviceId !== 'string') {
      res.status(400).json({ error: 'Invalid route parameters' });
      return;
    }

    const peerUser = await prisma.user.findUnique({ where: { username: peerUsername } });
    const peerDevice = peerUser
      ? await prisma.device.findFirst({
          where: { userId: peerUser.id, deviceId: Number(peerDeviceId) },
        })
      : null;

    if (!peerDevice) {
      res.status(404).json({ error: 'Peer device not found' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { fromDeviceId: device.id, toDeviceId: peerDevice.id },
          { fromDeviceId: peerDevice.id, toDeviceId: device.id },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(
      messages.map((m) => ({
        fromSelf: m.fromDeviceId === device.id,
        ciphertextType: m.ciphertextType,
        ciphertext: m.ciphertext,
        sentAt: m.createdAt.getTime(),
      }))
    );
  }
);

/**
 * GET /messages/:username/:deviceId/conversations
 *
 * Auth required (self only). Lists which peer devices this device has
 * exchanged messages with, so a client can build a conversation list
 * without fetching full history for every possible peer.
 */
messagesRouter.get(
  '/messages/:username/:deviceId/conversations',
  requireDeviceAuth,
  requireSelf('username', 'deviceId'),
  async (req, res) => {
    const device = req.device!;

    const messages = await prisma.message.findMany({
      where: {
        OR: [{ fromDeviceId: device.id }, { toDeviceId: device.id }],
      },
      orderBy: { createdAt: 'desc' },
    });

    const peerDeviceIds = new Set<string>();
    for (const m of messages) {
      peerDeviceIds.add(m.fromDeviceId === device.id ? m.toDeviceId : m.fromDeviceId);
    }

    const peers: Array<{ username: string; deviceId: number }> = [];
    for (const peerDbId of peerDeviceIds) {
      const peerDevice = await prisma.device.findUnique({ where: { id: peerDbId } });
      if (!peerDevice) continue;
      const peerUser = await prisma.user.findUnique({ where: { id: peerDevice.userId } });
      if (!peerUser) continue;
      peers.push({ username: peerUser.username, deviceId: peerDevice.deviceId });
    }

    res.json(peers);
  }
);
