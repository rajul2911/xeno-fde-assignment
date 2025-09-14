const { prisma } = require('../util/prisma');
const { ingestAllForTenant } = require('./shopify');

function startScheduler() {
  const interval = Number(process.env.SYNC_INTERVAL_MS || 15 * 60 * 1000);
  setInterval(async () => {
    try {
      const tenants = await prisma.tenant.findMany();
      for (const t of tenants) {
        if (!t.shopDomain || !t.accessToken) continue;
        console.log(`[sync] Starting tenant ${t.name}`);
        try {
          const stats = await ingestAllForTenant(t);
          console.log(`[sync] Tenant ${t.name} done`, stats);
        } catch (e) {
          console.error(`[sync] Tenant ${t.name} error`, e.message);
        }
      }
    } catch (e) {
      console.error('[sync] Scheduler tick error', e.message);
    }
  }, interval);
}

module.exports = { startScheduler };
