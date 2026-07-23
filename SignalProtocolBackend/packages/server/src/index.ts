import 'dotenv/config'; // MUST be the first import — see earlier dotenv-ordering issue

import http from 'node:http';
import app from './app.js';
import { initializeSocketServer } from './websocket/socket.js';
import { prisma } from './db/prisma.js';

const PORT = Number(process.env.PORT ?? 3000);

async function startServer() {
  await prisma.$connect();

  const server = http.createServer(app);
  initializeSocketServer(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
