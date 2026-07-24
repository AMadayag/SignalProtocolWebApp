import type { WebSocket } from 'ws';
import { WebSocket as WS } from 'ws';

/** Registry of currently-connected devices, keyed by their DB device id. */
export const connections = new Map<string, WebSocket>();

/** Sends a JSON payload to a device if it's currently connected. Returns whether it was sent. */
export function sendToDevice(deviceDbId: string, payload: unknown): boolean {
  const socket = connections.get(deviceDbId);
  if (socket && socket.readyState === WS.OPEN) {
    socket.send(JSON.stringify(payload));
    return true;
  }
  return false;
}
