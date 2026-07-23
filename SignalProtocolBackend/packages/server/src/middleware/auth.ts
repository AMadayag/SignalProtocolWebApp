import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';

// Augment Express's Request type so downstream handlers get a typed `req.device`.
declare global {
  namespace Express {
    interface Request {
      device?: { id: string; userId: string; deviceId: number };
    }
  }
}

/**
 * Verifies the `Authorization: Bearer <token>` header against a device's
 * stored authToken, and attaches the device to `req.device` on success.
 *
 * This only proves "this request came from whoever holds this device's
 * token" — it does NOT prove anything about the cryptographic identity key.
 * That's a separate, stronger guarantee that comes from the Signal Protocol
 * session itself (safety numbers, etc.), not from this HTTP layer.
 */
export async function requireDeviceAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  const device = await prisma.device.findFirst({ where: { authToken: token } });

  if (!device) {
    res.status(401).json({ error: 'Invalid auth token' });
    return;
  }

  req.device = { id: device.id, userId: device.userId, deviceId: device.deviceId };
  next();
}

/**
 * Stricter variant for routes like "top up my own prekeys" where the caller
 * must be authenticated AND must be the specific device named in the URL —
 * otherwise any registered device could top up anyone else's prekey supply.
 */
export function requireSelf(paramName: string, paramDeviceIdName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.device) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.device.userId } });
    const routeName = req.params[paramName];
    const routeDeviceId = Number(req.params[paramDeviceIdName]);

    if (user?.username !== routeName || req.device.deviceId !== routeDeviceId) {
      res.status(403).json({ error: 'Not authorized for this device' });
      return;
    }
    next();
  };
}
