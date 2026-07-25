import express from 'express';
import cors from 'cors';
import { registerRouter } from './routes/register.js';
import { prekeysRouter } from './routes/prekeys.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { messagesRouter } from './routes/messages.js';

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173', 'null'];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  })
);
app.use(express.json());

app.use('/auth', authRouter);
app.use(registerRouter);
app.use(prekeysRouter);
app.use(usersRouter);
app.use(messagesRouter);

export default app;
