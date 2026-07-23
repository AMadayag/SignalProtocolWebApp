import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { prisma } from '../db/prisma.js';

interface ClientSendMessage {
  type: 'send';
  to: string; // recipient username
  toDeviceId: number;
  ciphertextType: number;
  ciphertext: string; // base64
}

/** Registry of currently-connected devices, keyed by their DB device id. */
const connections = new Map<string, WebSocket>();

export function initializeSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const username = url.searchParams.get('name');
    const deviceIdParam = url.searchParams.get('deviceId');
    const token = url.searchParams.get('token');

    if (!username || !deviceIdParam || !token) {
      ws.send(JSON.stringify({ type: 'error', message: 'Missing name, deviceId, or token' }));
      ws.close();
      return;
    }

    const user = await prisma.user.findUnique({ where: { username } });
    const device = user
      ? await prisma.device.findFirst({
          where: { userId: user.id, deviceId: Number(deviceIdParam) },
        })
      : null;

    if (!device || device.authToken !== token) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid credentials' }));
      ws.close();
      return;
    }

    connections.set(device.id, ws);
    console.log(`Device connected: ${username}.${device.deviceId}`);

    // Flush any messages that arrived while this device was offline.
    const queued = await prisma.message.findMany({
      where: { toDeviceId: device.id, delivered: false },
    });
    for (const envelope of queued) {
      const fromDevice = await prisma.device.findUnique({ where: { id: envelope.fromDeviceId } });
      const fromUser = fromDevice
        ? await prisma.user.findUnique({ where: { id: fromDevice.userId } })
        : null;

      ws.send(
        JSON.stringify({
          type: 'message',
          envelope: {
            from: fromUser?.username ?? 'unknown',
            fromDeviceId: fromDevice?.deviceId ?? 0,
            ciphertextType: envelope.ciphertextType,
            ciphertext: envelope.ciphertext,
            sentAt: envelope.createdAt.getTime(),
          },
        })
      );
      await prisma.message.update({ where: { id: envelope.id }, data: { delivered: true } });
    }

    ws.on('message', async (raw) => {
      let msg: ClientSendMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      if (msg.type !== 'send') {
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
        return;
      }

      const recipientUser = await prisma.user.findUnique({ where: { username: msg.to } });
      const recipientDevice = recipientUser
        ? await prisma.device.findFirst({
            where: { userId: recipientUser.id, deviceId: msg.toDeviceId },
          })
        : null;

      if (!recipientDevice) {
        ws.send(JSON.stringify({ type: 'error', message: `No such device: ${msg.to}.${msg.toDeviceId}` }));
        return;
      }

      const sentAt = new Date();
      const recipientSocket = connections.get(recipientDevice.id);
      const isRecipientOnline = recipientSocket?.readyState === WebSocket.OPEN;

      const stored = await prisma.message.create({
        data: {
          fromDeviceId: device.id,
          toDeviceId: recipientDevice.id,
          ciphertextType: msg.ciphertextType,
          ciphertext: msg.ciphertext,
          delivered: isRecipientOnline,
          createdAt: sentAt,
        },
      });

      if (isRecipientOnline) {
        recipientSocket!.send(
          JSON.stringify({
            type: 'message',
            envelope: {
              from: username,
              fromDeviceId: device.deviceId,
              ciphertextType: msg.ciphertextType,
              ciphertext: msg.ciphertext,
              sentAt: stored.createdAt.getTime(),
            },
          })
        );
      }
      // If offline, it stays in the `message` table with delivered: false
      // and gets flushed to them the next time they connect.

      ws.send(JSON.stringify({ type: 'ack', sentAt: stored.createdAt.getTime() }));
    });

    ws.on('close', () => {
      connections.delete(device.id);
      console.log(`Device disconnected: ${username}.${device.deviceId}`);
    });
  });

  console.log('WebSocket server initialized');
  return wss;
}
