import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';

import { requireAuth } from './lib/auth.js';
import triggerRoutes from './routes/triggers.js';
import pushRoutes from './routes/push.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '16kb' }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/triggers', requireAuth, triggerRoutes);
app.use('/api/push', requireAuth, pushRoutes);
app.use('/api', (_req, res) => res.status(404).json({ message: 'API route not found.' }));

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
  res.status(status).json({
    message:
      status < 500 || error.expose ? error.message : 'Something went wrong. Try again later.',
  });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Trigger server listening on port ${port}`));
