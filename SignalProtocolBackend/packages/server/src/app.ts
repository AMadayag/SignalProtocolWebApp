import express from 'express';
import cors from 'cors';
import { registerRouter } from './routes/register.js';
import { prekeysRouter } from './routes/prekeys.js';
import { authRouter } from './routes/auth.js';
import { messagesRouter } from './routes/messages.js';
import { usersRouter } from './routes/users.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.use(registerRouter);
app.use(prekeysRouter);
app.use('/auth', authRouter);
app.use(messagesRouter);
app.use(usersRouter)

export default app;
