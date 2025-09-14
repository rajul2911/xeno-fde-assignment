const axios = require('axios');
const { prisma } = require('../util/prisma');

function adminHeaders(token) {
  return {
    'X-Shopify-Access-Token': token,
    'Content-Type': 'application/json',
  };
}

async function fetchAllPaginated(url, headers) {
  let results = [];
  let pageInfo = null;
  let nextUrl = url;
  while (nextUrl) {
    let res;
    try {
      res = await axios.get(nextUrl, { headers });
    } catch (err) {
      const code = err.response?.status;
      const body = err.response?.data;
      const msg = body?.errors || body || err.message;
      const detail = typeof msg === 'string' ? msg : JSON.stringify(msg);
      throw new Error(`Shopify request failed (${code}): ${detail}`);
    }
    results = results.concat(res.data.customers || res.data.orders || res.data.products || []);
    const link = res.headers['link'] || res.headers['Link'];
    if (link && link.includes('rel="next"')) {
      const match = link.match(/<([^>]+)>; rel="next"/);
      nextUrl = match ? match[1] : null;
    } else {
      nextUrl = null;
    }
  }
  return results;
}

// Quick credential and scope check to help debug Unauthorized (401) or Forbidden (403)
async function checkCredentials(domain, token) {
  const result = { ok: false };
  // Always check base auth first
  try {
    const res = await axios.get(`https://${domain}/admin/api/2024-10/shop.json`, { headers: adminHeaders(token) });
    result.shop = res.data?.shop?.name || domain;
    result.baseOk = true;
  } catch (err) {
    const code = err.response?.status;
    const body = err.response?.data;
    const msg = body?.errors || body || err.message;
    const detail = typeof msg === 'string' ? msg : JSON.stringify(msg);
    return { ok: false, baseOk: false, code, error: `Shopify auth check failed (${code}): ${detail}` };
  }

  // Helper to test a resource
  async function test(path) {
    try {
      const r = await axios.get(`https://${domain}/admin/api/2024-10/${path}`, { headers: adminHeaders(token) });
      return { ok: true, code: 200, count: Array.isArray(r.data?.orders || r.data?.customers || r.data?.products) ? (r.data.orders?.length || r.data.customers?.length || r.data.products?.length) : undefined };
    } catch (e) {
      return { ok: false, code: e.response?.status || 0, error: e.response?.data?.errors || e.response?.data || e.message };
    }
  }

  const [orders, customers, products] = await Promise.all([
    test('orders.json?limit=1&status=any'),
    test('customers.json?limit=1'),
    test('products.json?limit=1'),
  ]);
  result.orders = orders;
  result.customers = customers;
  result.products = products;
  // ok if base auth ok and at least customers or orders or products ok
  result.ok = !!(result.baseOk && (orders.ok || customers.ok || products.ok));
  return result;
}

async function ingestCustomers(tenantId, domain, token) {
  const url = `https://${domain}/admin/api/2024-10/customers.json?limit=250`;
  const customers = await fetchAllPaginated(url, adminHeaders(token));
  for (const c of customers) {
    await prisma.customer.upsert({
      where: { tenantId_shopifyId: { tenantId, shopifyId: String(c.id) } },
      update: {
        email: c.email || null,
        firstName: c.first_name || null,
        lastName: c.last_name || null,
        totalSpend: c.total_spent ? c.total_spent : 0,
      },
      create: {
        tenantId,
        shopifyId: String(c.id),
        email: c.email || null,
        firstName: c.first_name || null,
        lastName: c.last_name || null,
        totalSpend: c.total_spent ? c.total_spent : 0,
      },
    });
  }
  return customers.length;
}

async function ingestProducts(tenantId, domain, token) {
  const url = `https://${domain}/admin/api/2024-10/products.json?limit=250`;
  const products = await fetchAllPaginated(url, adminHeaders(token));
  for (const p of products) {
    const price = p.variants && p.variants[0] ? p.variants[0].price : '0';
    await prisma.product.upsert({
      where: { tenantId_shopifyId: { tenantId, shopifyId: String(p.id) } },
      update: { title: p.title, price },
      create: { tenantId, shopifyId: String(p.id), title: p.title, price },
    });
  }
  return products.length;
}

async function ingestOrders(tenantId, domain, token) {
  const url = `https://${domain}/admin/api/2024-10/orders.json?status=any&limit=250`;
  const orders = await fetchAllPaginated(url, adminHeaders(token));
  for (const o of orders) {
    // Ensure customer exists if present
    let customerId = null;
    if (o.customer && o.customer.id) {
      const customer = await prisma.customer.upsert({
        where: { tenantId_shopifyId: { tenantId, shopifyId: String(o.customer.id) } },
        update: {
          email: o.customer.email || null,
          firstName: o.customer.first_name || null,
          lastName: o.customer.last_name || null,
        },
        create: {
          tenantId,
          shopifyId: String(o.customer.id),
          email: o.customer.email || null,
          firstName: o.customer.first_name || null,
          lastName: o.customer.last_name || null,
        },
      });
      customerId = customer.id;
    }

    const order = await prisma.order.upsert({
      where: { tenantId_shopifyId: { tenantId, shopifyId: String(o.id) } },
      update: {
        customerId,
        totalPrice: o.total_price || '0',
        createdAt: o.created_at ? new Date(o.created_at) : (o.processed_at ? new Date(o.processed_at) : null),
      },
      create: {
        tenantId,
        shopifyId: String(o.id),
        customerId,
        totalPrice: o.total_price || '0',
        createdAt: o.created_at ? new Date(o.created_at) : (o.processed_at ? new Date(o.processed_at) : null),
      },
    });

    // Items
    if (o.line_items) {
      // clear existing items to avoid duplicates
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
      for (const li of o.line_items) {
        // ensure product exists
        const prodShopId = String(li.product_id);
        let product = await prisma.product.findUnique({ where: { tenantId_shopifyId: { tenantId, shopifyId: prodShopId } } });
        if (!product) {
          product = await prisma.product.create({ data: { tenantId, shopifyId: prodShopId, title: li.name || 'Item', price: li.price || '0' } });
        }
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            quantity: li.quantity || 1,
            price: li.price || '0',
          },
        });
      }
    }
  }
  return orders.length;
}

async function ingestAllForTenant(tenant) {
  const tenantId = tenant.id;
  if (!tenant.shopDomain || !tenant.accessToken) {
    throw new Error('Shopify not configured for tenant');
  }
  const domain = tenant.shopDomain;
  const token = tenant.accessToken;
  // Optional preflight to fail fast with clear message
  const ping = await checkCredentials(domain, token);
  if (!ping.ok) {
    throw new Error(ping.error);
  }
  const [customers, products, orders] = await Promise.all([
    ingestCustomers(tenantId, domain, token),
    ingestProducts(tenantId, domain, token),
    ingestOrders(tenantId, domain, token),
  ]);
  return { customers, products, orders };
}

module.exports = { ingestCustomers, ingestProducts, ingestOrders, ingestAllForTenant, checkCredentials };
