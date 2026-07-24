import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authServices.js';

declare global {
  namespace Express {
    interface Request {
      // Account-level identity (from login JWT) — different from `req.device`
      // in middleware/auth.ts, which is device-level identity (from a device's
      // registration authToken). A request can have one, both, or neither
      // depending on which route it hits.
      user?: { userId: string; username: string };
    }
  }
}

/**
 * Verifies the `Authorization: Bearer <jwt>` header issued at login.
 * This proves "this request is from a logged-in account" — it does NOT
 * prove which device, since one account can have several. Routes that act
 * on a specific device still need `requireDeviceAuth`/`requireSelf` on top
 * of this where relevant (e.g. registering a new device to your own account).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = payload;
  next();
}
