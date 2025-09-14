// Default to local backend; override with REACT_APP_API_BASE for deployed API (e.g., https://xeno-fde-assignment.onrender.com/api)
let API_BASE = process.env.REACT_APP_API_BASE || 'https://xeno-fde-assignment.onrender.com/api';
// Normalize base: if someone sets a bare host without protocol, assume http
if (!/^https?:\/\//i.test(API_BASE)) {
  API_BASE = `http://${API_BASE}`;
}
// Trim trailing slashes for consistency
API_BASE = API_BASE.replace(/\/$/, '');

async function request(path, options = {}) {
  const headers = options.headers || {};
  if (!headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json';
  if (!headers['Accept']) headers['Accept'] = 'application/json';
  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const text = await resp.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      // Surface a clearer error if server returned HTML or plain text
      const preview = text.slice(0, 200);
      throw new Error(`Non-JSON response from API (status ${resp.status}): ${preview}`);
    }
  }
  if (!resp.ok) {
    const msg = data?.error || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  linkShopify: (payload) => request('/tenants/shopify', { method: 'POST', body: JSON.stringify(payload) }),
  ingestRun: () => request('/ingest/run', { method: 'POST' }),
  checkShopify: () => request('/tenants/shopify/check'),
  me: () => request('/tenants/me'),
  summary: () => request('/insights/summary'),
  ordersByDate: (start, end) => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    return request(`/insights/orders-by-date?${params.toString()}`);
  },
  topCustomers: () => request('/insights/top-customers'),
};
