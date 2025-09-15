const express = require('express');
const { prisma } = require('../util/prisma');

const router = express.Router();

router.get('/summary', async (req, res) => {
  const tenantId = 1;
  const [customers, orders, revenueAgg] = await Promise.all([
    prisma.customer.count({ where: { tenantId } }),
    prisma.order.count({ where: { tenantId } }),
    prisma.order.aggregate({ where: { tenantId }, _sum: { totalPrice: true } }),
  ]);
  res.json({
    customers,
    orders,
    revenue: Number(revenueAgg._sum.totalPrice || 0),
  });
});

router.get('/orders-by-date', async (req, res) => {
  const tenantId = 1;
  const { start, end } = req.query;
  const where = { tenantId };
  if (start || end) {
    where.createdAt = {};
    if (start) where.createdAt.gte = new Date(start);
    if (end) where.createdAt.lte = new Date(end);
  }
  const orders = await prisma.order.findMany({ where, select: { createdAt: true, totalPrice: true } });
  const byDate = {};
  for (const o of orders) {
    const dateObj = o.createdAt;
    if (!dateObj) continue;
    const d = dateObj.toISOString().slice(0, 10);
    byDate[d] = (byDate[d] || 0) + Number(o.totalPrice);
  }
  const data = Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, revenue]) => ({ date, revenue }));
  res.json({ data });
});

router.get('/top-customers', async (req, res) => {
  const tenantId = 1;
  const orders = await prisma.order.findMany({
    where: { tenantId, customerId: { not: null } },
    select: { totalPrice: true, customerId: true },
  });
  const spend = {};
  for (const o of orders) {
    const cid = o.customerId;
    spend[cid] = (spend[cid] || 0) + Number(o.totalPrice);
  }
  const top = Object.entries(spend)
    .map(([customerId, total]) => ({ customerId: Number(customerId), total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  if (top.length === 0) return res.json({ data: [] });
  const ids = top.map(t => Number(t.customerId)).filter(n => Number.isFinite(n));
  if (!ids.length) return res.json({ data: [] });
  const customers = await prisma.customer.findMany({ where: { id: { in: ids } } });
  const joined = top.map(t => {
    const c = customers.find(x => x.id === t.customerId);
    return { name: `${c?.firstName || ''} ${c?.lastName || ''}`.trim() || c?.email || 'Unknown', total: t.total };
  });
  res.json({ data: joined });
});

module.exports = router;
