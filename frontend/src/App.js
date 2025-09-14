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

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.linkShopify({ domain, adminToken });
      onConnected();
    } catch (err) {
      setError(err.message || 'Failed');
    }
  }

  return (
    <div className="card">
      <h2>Connect Shopify</h2>
      <form onSubmit={submit}>
        <input placeholder="Shop domain (example.myshopify.com)" value={domain} onChange={e => setDomain(e.target.value)} />
        <input placeholder="Admin access token (shpat_...)" value={adminToken} onChange={e => setAdminToken(e.target.value)} />
        {error && <div className="error">{error}</div>}
        <button type="submit">Save Connection</button>
        <button type="button" onClick={async () => {
          setError('');
          setCheckStatus('');
          try {
            const res = await api.checkShopify();
            const okFlags = [res.orders?.ok, res.customers?.ok, res.products?.ok].filter(Boolean).length;
            setCheckStatus(`OK: ${res.shop} | Access: ${okFlags>0 ? 'some' : 'none'} (orders:${res.orders?.code||'200'} customers:${res.customers?.code||'200'} products:${res.products?.code||'200'})`);
          } catch (e) {
            setCheckStatus(`Check failed: ${e.message}`);
          }
        }}>Check Shopify</button>
      </form>
      {checkStatus && <div style={{ marginTop: 8 }}>{checkStatus}</div>}
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

  async function load() {
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
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  async function syncNow() {
    setError('');
    try {
      await api.ingestRun();
      await load();
    } catch (e) {
      setError(e.message || 'Sync failed');
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
      </div>

      <div className="filters">
        <input type="date" value={start} onChange={e => setStart(e.target.value)} />
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} />
        <button onClick={load}>Apply</button>
        <button onClick={() => { setStart(''); setEnd(''); load(); }}>Clear</button>
        <button onClick={syncNow}>Sync Now</button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="chart">
        <h3>Revenue over time</h3>
        <Line data={lineData} />
      </div>

      <div className="chart">
        <h3>Top customers by spend</h3>
        <Bar data={barData} />
      </div>
    </div>
  );
}

function App() {
  const [connected, setConnected] = useState(false);

  // Optionally, check if already connected (e.g., via /tenants/me)
  // For now, always show connect form first

  return (
    <div className="container">
      <header>
        <h1>Xeno FDE: Shopify Insights</h1>
      </header>
      {!connected ? (
        <ConnectShopify onConnected={() => setConnected(true)} />
      ) : (
        <Dashboard />
      )}
    </div>
  );
}

export default App;
