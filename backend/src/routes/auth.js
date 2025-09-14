const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma } = require('../util/prisma');

const router = express.Router();

// Register a tenant (creates a row in tenants for email login)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const existing = await prisma.tenant.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
    const tenant = await prisma.tenant.create({ data: { name, email, passwordHash } });
  const token = jwt.sign({ tenantId: tenant.id, email: tenant.email || undefined }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, tenant: { id: tenant.id, name: tenant.name, email: tenant.email, shopDomain: tenant.shopDomain || null, hasAccessToken: !!tenant.accessToken } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const tenant = await prisma.tenant.findUnique({ where: { email } });
    if (!tenant) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, tenant.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ tenantId: tenant.id, email: tenant.email || undefined }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, tenant: { id: tenant.id, name: tenant.name, email: tenant.email, shopDomain: tenant.shopDomain || null, hasAccessToken: !!tenant.accessToken } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
