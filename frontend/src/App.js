import React, { useEffect, useState } from 'react';
import './App.css';
import { api } from './api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function ConnectShopify({ onConnected }) {
  const [domain, setDomain] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [error, setError] = useState('');
  const [checkStatus, setCheckStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const showOverlay = saving || checking;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.linkShopify({ domain, adminToken });
      onConnected();
    } catch (err) {
      setError(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2>Connect Shopify</h2>
      <form onSubmit={submit}>
        <div className="form-row">
          <input placeholder="Shop domain (example.myshopify.com)" value={domain} onChange={e => setDomain(e.target.value)} />
          <input placeholder="Admin access token (shpat_...)" value={adminToken} onChange={e => setAdminToken(e.target.value)} />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Connection'}</button>
          <button type="button" className="button-ghost" onClick={async () => {
            setError('');
            setCheckStatus('');
            setChecking(true);
            try {
              const res = await api.checkShopifyTyped({ domain, adminToken });
              const okFlags = [res.orders?.ok, res.customers?.ok, res.products?.ok].filter(Boolean).length;
              setCheckStatus(`OK: ${res.shop} | Access: ${okFlags>0 ? 'some' : 'none'} (orders:${res.orders?.code||'200'} customers:${res.customers?.code||'200'} products:${res.products?.code||'200'})`);
            } catch (e) {
              setCheckStatus(`Check failed: ${e.message}`);
            } finally {
              setChecking(false);
            }
          }}>{checking ? 'Checking…' : 'Check Shopify'}</button>
        </div>
      </form>
      {checkStatus && <div style={{ marginTop: 8 }}>{checkStatus}</div>}
      {showOverlay && (
        <div className="overlay">
          <div className="overlay-card">
            <div className="overlay-spinner" />
            <div>{saving ? 'Saving connection…' : 'Checking credentials…'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const [summary, setSummary] = useState({ customers: 0, orders: 0, revenue: 0 });
  const [orders, setOrders] = useState([]);
  const [top, setTop] = useState([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const showOverlay = loading && !syncing; // initial dashboard load

  async function load() {
    setLoading(true);
    try {
      setError('');
      const [sum, ob, tc] = await Promise.all([
        api.summary(),
        api.ordersByDate(start || undefined, end || undefined),
        api.topCustomers(),
      ]);
      setSummary(sum);
      setOrders(ob.data || []);
      setTop(tc.data || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => { await load(); })();
    // eslint-disable-next-line
  }, []);

  async function syncNow() {
    setError('');
    setSyncing(true);
    setLoading(true);
    try {
      await api.ingestRun();
      await load();
    } catch (e) {
      setError(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  const lineData = {
    labels: orders.map(d => d.date),
    datasets: [
      {
        label: 'Revenue',
        data: orders.map(d => d.revenue),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      },
    ],
  };

  const barData = {
    labels: top.map(t => t.name),
    datasets: [
      {
        label: 'Total Spend',
        data: top.map(t => t.total),
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
    ],
  };

  return (
    <div>
      <div className="kpis">
        {loading ? (
          <>
            <div className="kpi skeleton sk-kpi" />
            <div className="kpi skeleton sk-kpi" />
            <div className="kpi skeleton sk-kpi" />
          </>
        ) : (
          <>
            <div className="kpi">
              <div className="kpi-label">Customers</div>
              <div className="kpi-value">{summary.customers}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Orders</div>
              <div className="kpi-value">{summary.orders}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Revenue</div>
              <div className="kpi-value">₹ {summary.revenue.toFixed(2)}</div>
            </div>
          </>
        )}
      </div>

      <div className="filters">
        <input type="date" value={start} onChange={e => setStart(e.target.value)} />
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} />
        <button onClick={load} disabled={syncing}>Apply</button>
        <button onClick={() => { setStart(''); setEnd(''); load(); }} disabled={syncing}>Clear</button>
        <button onClick={syncNow} disabled={syncing}>
          {syncing ? (<><span className="loading-spinner" />Syncing...</>) : 'Sync Now'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="chart">
        <h3>Revenue over time</h3>
        {loading ? <div className="skeleton sk-chart" /> : <Line data={lineData} />}
      </div>

      <div className="chart">
        <h3>Top customers by spend</h3>
        {loading ? <div className="skeleton sk-chart" /> : <Bar data={barData} />}
      </div>

      {showOverlay && (
        <div className="overlay">
          <div className="overlay-card">
            <div className="overlay-spinner" />
            <div>Loading dashboard…</div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Checking connection…');
  const [booting, setBooting] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        if (me?.shopDomain && me?.hasAccessToken) {
          setConnected(true);
          setStatus(`Connected: ${me.shopDomain}`);
        } else {
          setStatus('Not connected');
        }
      } catch (_) {
        setStatus('Not connected');
      }
      setBooting(false);
    })();
  }, []);

  return (
    <div className="container">
      <header>
        <h1>Xeno FDE: Shopify Insights</h1>
        <div className="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{status}</span>
          {connected && (
            <button
              className="button-ghost"
              onClick={async () => {
                setDisconnecting(true);
                try {
                  await api.unlinkShopify();
                } catch (_) {
                  // even if it fails, allow user to try reconnecting
                }
                setConnected(false);
                setStatus('Not connected');
                setDisconnecting(false);
              }}
            >
              Disconnect / Switch shop
            </button>
          )}
        </div>
      </header>
      {!connected ? (
        <ConnectShopify onConnected={() => { setConnected(true); setStatus('Connected'); }} />
      ) : (
        <Dashboard />
      )}
      {booting && (
        <div className="overlay">
          <div className="overlay-card">
            <div className="overlay-spinner" />
            <div>Checking connection…</div>
          </div>
        </div>
      )}
      {disconnecting && (
        <div className="overlay">
          <div className="overlay-card">
            <div className="overlay-spinner" />
            <div>Disconnecting…</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
