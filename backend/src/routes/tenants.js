const express = require('express');
const { prisma } = require('../util/prisma');

const router = express.Router();

router.post('/shopify', async (req, res) => {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
    let { domain, adminToken } = req.body || {};
    if (!domain || !adminToken) return res.status(400).json({ error: 'Missing Shopify config' });

    try {
      if (/^https?:\/\//i.test(domain)) {
        const u = new URL(domain);
        domain = u.hostname;
      }
    } catch (_) {}
    domain = String(domain).trim().replace(/^\/*|\/*$/g, '');
    adminToken = String(adminToken).trim();

    // If switching domains, clear existing data for tenantId=1 to avoid mixing shops
    const existing = await prisma.tenant.findUnique({ where: { id: 1 } });
    if (existing?.shopDomain && existing.shopDomain !== domain) {
      await prisma.$transaction([
        prisma.orderItem.deleteMany({ where: { order: { tenantId: 1 } } }),
        prisma.order.deleteMany({ where: { tenantId: 1 } }),
        prisma.product.deleteMany({ where: { tenantId: 1 } }),
        prisma.customer.deleteMany({ where: { tenantId: 1 } }),
      ]);
    }
    const tenant = await prisma.tenant.upsert({
      where: { id: 1 },
      update: { shopDomain: domain, accessToken: adminToken },
      create: { id: 1, shopDomain: domain, accessToken: adminToken },
    });
    res.json({
      id: tenant.id,
      name: tenant.name,
      email: tenant.email,
      shopDomain: tenant.shopDomain,
      hasAccessToken: !!tenant.accessToken,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Disconnect Shopify by clearing credentials
router.delete('/shopify', async (req, res) => {
  try {
    // wipe data for tenantId=1
    await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { order: { tenantId: 1 } } }),
      prisma.order.deleteMany({ where: { tenantId: 1 } }),
      prisma.product.deleteMany({ where: { tenantId: 1 } }),
      prisma.customer.deleteMany({ where: { tenantId: 1 } }),
    ]);
    const tenant = await prisma.tenant.upsert({
      where: { id: 1 },
      update: { shopDomain: null, accessToken: null },
      create: { id: 1, shopDomain: null, accessToken: null },
    });
    res.json({
      id: tenant.id,
      shopDomain: tenant.shopDomain,
      hasAccessToken: !!tenant.accessToken,
      message: 'Shopify disconnected',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Quick Shopify auth check (optional for debugging)
router.get('/shopify/check', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: 1 } });
    if (!tenant?.shopDomain || !tenant?.accessToken) return res.status(400).json({ ok: false, error: 'Connect Shopify first' });
    const { checkCredentials } = require('../services/shopify');
    const result = await checkCredentials(tenant.shopDomain, tenant.accessToken);
    if (!result.ok) return res.status(401).json(result);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// Validate typed Shopify credentials without saving
router.post('/shopify/check', async (req, res) => {
  try {
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json' });
    }
    let { domain, adminToken } = req.body || {};
    if (!domain || !adminToken) return res.status(400).json({ ok: false, error: 'Missing Shopify config' });
    try {
      if (/^https?:\/\//i.test(domain)) {
        const u = new URL(domain);
        domain = u.hostname;
      }
    } catch (_) {}
    domain = String(domain).trim().replace(/^\/*|\/*$/g, '');
    adminToken = String(adminToken).trim();
    const { checkCredentials } = require('../services/shopify');
    const result = await checkCredentials(domain, adminToken);
    const status = result.ok ? 200 : (result.code === 401 ? 401 : 400);
    res.status(status).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

// Get current tenant profile (demo mode id=1)
router.get('/me', async (req, res) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: 1 } });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  res.json({
    id: tenant.id,
    name: tenant.name,
    email: tenant.email,
    shopDomain: tenant.shopDomain,
    hasAccessToken: !!tenant.accessToken,
  });
});

module.exports = router;
