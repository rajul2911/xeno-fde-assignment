const express = require('express');
const { auth } = require('../middleware/auth');
const { ingestAllForTenant } = require('../services/shopify');
const { prisma } = require('../util/prisma');

const router = express.Router();

// Trigger ingestion manually for the current tenant
router.post('/run', async (req, res) => {
  try {
    // Use demo tenant (id=1)
    const tenant = await prisma.tenant.findUnique({ where: { id: 1 } });
    if (!tenant || !tenant.shopDomain || !tenant.accessToken) {
      return res.status(400).json({ error: 'Connect Shopify first' });
    }
    const report = await ingestAllForTenant(tenant);
    res.json({ ok: true, ...report });
  } catch (e) {
    console.error('Ingest error', e);
    const msg = e?.message || 'Internal error';
    // If Shopify auth failed, prefer 401, else 500
    const status = /\(401\)/.test(msg) ? 401 : 500;
    res.status(status).json({ ok: false, error: msg });
  }
});

module.exports = router;
