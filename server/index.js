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
app.use(express.json());

app.use('/api/triggers', requireAuth, triggerRoutes);
app.use('/api/push', requireAuth, pushRoutes);

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: error.message || 'Something went wrong.' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Trigger server listening on port ${port}`));
