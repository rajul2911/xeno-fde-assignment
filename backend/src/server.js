require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { prisma } = require('./util/prisma');

const authRoutes = require('./routes/auth');
const tenantRoutes = require('./routes/tenants');
const ingestRoutes = require('./routes/ingest');
const insightsRoutes = require('./routes/insights');
const { startScheduler } = require('./services/scheduler');

const app = express();
app.use(cors());
app.use(express.json());

// Friendly root route
app.get('/', (req, res) => {
  res.send('Xeno FDE API is running. Try GET /health or use the React app on http://localhost:3000.');
});

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/insights', insightsRoutes);

// Global JSON error handler to avoid HTML error responses
// Ensures body parser errors and unhandled errors return JSON consistently
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err) {
    const isJsonParse = err.type === 'entity.parse.failed' || /JSON/.test(err.message || '');
    const status = err.status || err.statusCode || (isJsonParse ? 400 : 500);
    console.error('Unhandled error:', err);
    return res.status(status).json({ ok: false, error: isJsonParse ? 'Invalid JSON body' : (err.message || 'Internal error') });
  }
  next();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  startScheduler();
});
