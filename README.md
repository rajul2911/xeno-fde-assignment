# Xeno FDE Internship Assignment – Shopify Data Ingestion & Insights

A multi-tenant service that ingests Customers, Orders, and Products from Shopify into MySQL using Prisma, and displays KPIs and charts in a React dashboard.

## Architecture
- Backend: Node.js + Express + Prisma (MySQL)
- Frontend: React (CRA) + Chart.js
- Multi-tenancy: Row-level using `tenantId` on all business tables; JWT identifies tenant per request
- Sync: Manual trigger endpoint + periodic scheduler

```
[Shopify Admin API] --> [Express Ingest Service] --> [MySQL via Prisma]
                                          ^                    |
                                          |                    v
                                    # Shopify → MySQL Ingestion & Insights (Xeno FDE)

A full‑stack app that ingests Customers, Orders, and Products from a Shopify store into MySQL using Prisma, then visualizes KPIs and charts in a React dashboard. The current build runs in a simple “demo mode” with a single tenant (id=1) and no login.

## Architecture
- Backend: Node.js + Express 5 + Prisma (MySQL)
- Frontend: React (Create React App) + Chart.js (react-chartjs-2)
- Ingestion: Shopify Admin REST API (2024-10), manual trigger + periodic scheduler
- Tenancy: Single demo tenant (id=1); domain and token stored on `tenants` table

```
[Shopify Admin API]
              |
              v
[Express Service] -- Prisma --> [MySQL]
              ^                             |
              |                             v
      [React UI]  <----- JSON -----  [Insights API]
```

## Prerequisites
- Node.js 18+
- MySQL (cloud) used railway for cloud database
# Xeno FDE: Shopify → MySQL Ingestion & Insights

A full‑stack app that ingests Customers, Orders, and Products from a Shopify store into MySQL using Prisma, then visualizes KPIs and charts in a modern React dashboard. Runs locally out of the box and supports a simple demo tenant by default.

---

## 🔗 Deployment Links

- Frontend (React): https://xeno-fde-assignment-gamma.vercel.app/
- Backend (API): https://xeno-fde-assignment.onrender.com/

---

## 🏗 Architecture

```
[Shopify Admin API]
                  |
                  v
[Express API] ── Prisma ──> [MySQL]
      ^                          |
      |                          v
  [React UI]  <── JSON ───  [Insights API]
```

- Backend: Node.js + Express (v5) + Prisma (MySQL)
- Frontend: React (Create React App) + Chart.js (react-chartjs-2)
- Ingestion: Shopify Admin REST API, manual trigger + periodic scheduler
- Tenancy: Demo single-tenant (id=1) by default; JWT hooks ready for multi-tenant

Editable diagram: Excalidraw / Draw.io
- Excalidraw: docs/architecture.excalidraw (optional)
- Draw.io: docs/architecture.drawio (optional)

---

## 🛠 Prerequisites

- Node.js 18+
- MySQL 8+ with a database (e.g., `xeno_fde`)
- Shopify store with a Custom App and Admin API Access Token (shpat_…)

Recommended Shopify scopes: `read_customers`, `read_products`, `read_orders` (add `read_all_orders` for full historical data)
and u can add write also as per your needs.
But don't give too much access until u have a good security

---

## ⚙️ Setup & Run Locally (Windows cmd)

1) Backend: install, configure, migrate, run

```bat
cd backend
npm install
```
REM Create .env from example and fill values
REM DATABASE_URL example for local MySQL
REM DATABASE_URL="mysql://root:YOURPASS@127.0.0.1:3306/railway"
<!-- As i have used railway cloud mysql database that's why railway -->

npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Backend defaults to http://localhost:4000

2) Frontend: install and run

```bat
cd frontend
npm install
npm start
```

Frontend runs at http://localhost:3000 (proxy to backend is configured in `frontend/package.json`).

---

## 🚦 First Run Walkthrough

1. Open the UI at http://localhost:3000
2. In “Connect Shopify”, enter:
    - Shop domain: `example.myshopify.com`
    - Admin Access Token: `shpat_...`
3. Click “Check Shopify” to validate; then “Save Connection”
4. Click “Sync Now” to ingest Customers, Orders, Products
5. View KPIs and charts; use date filters to refine

---

## 📡 API Reference (Base: `/api`)

Health
- GET `/health` → `{ ok: true, time }`

Tenants
- POST `/tenants/shopify` — Save Shopify domain + token for demo tenant
- GET  `/tenants/shopify/check` — Validate stored credentials against Shopify
- GET  `/tenants/me` — Current tenant profile (demo id=1)

Ingestion
- POST `/ingest/run` — Manually trigger ingestion for the tenant

Insights
- GET `/insights/summary` — `{ customers, orders, revenue }`
- GET `/insights/orders-by-date?[start=YYYY-MM-DD]&[end=YYYY-MM-DD]` → `{ data: [{ date, revenue }] }`
- GET `/insights/top-customers` → `{ data: [{ name, total }] }`

Notes
- All endpoints operate on demo tenant id=1 by default. JWT middleware is scaffolded but not enforced for the demo path.

---

## 🗄 Database Schema (Prisma → MySQL)

Tables
- `tenants` — Shopify credentials + optional auth fields
- `customers` — Customer profiles; unique per tenant+shopifyId
- `products` — Product catalog; unique per tenant+shopifyId
- `orders` — Orders (optionally linked to a customer)
- `order_items` — Line items connecting orders and products

Key relations
- Tenant 1—N Customers, Products, Orders
- Order N—1 Tenant, 0/1 Customer
- OrderItem N—1 Order, N—1 Product

Important fields
- Orders: `created_at` (nullable) is used for date aggregation
- Monetary fields use DECIMAL(12,2)

---

## 🔒 Security & Tenancy

- Demo mode: single tenant (id=1) with no login
- JWT endpoints exist (`/api/auth/register`, `/api/auth/login`) but aren’t wired in by default
- Row-level isolation by `tenant_id` across business tables
- Consistent JSON error handling middleware

---

## ⚠️ Known Limitations & Assumptions

- Demo mode single-tenant only; multi-tenant JWT wiring is not enforced
- Ingestion uses Shopify REST; cursors/pagination are basic and may need expansion for very large stores
- Orders date aggregation uses `created_at`; ensure this field is populated during ingest
- No retries/backoff on transient Shopify errors out of the box
- UI is a single-page dashboard with essential filters; advanced segmentation not included

---

## 📦 Scripts

Backend
- `npm run dev` — Start backend in watch mode
- `npm start` — Start backend
- `npm run prisma:generate` — Generate Prisma client
- `npm run prisma:migrate` — Run development migration

Frontend
- `npm start` — CRA dev server
- `npm build` — Production build
- `npm test` — Tests via CRA

---

## 🧭 Project Structure

```
backend/
  src/
      routes/ (auth, tenants, ingest, insights)
      services/ (scheduler, shopify)
      util/ (prisma client)
  prisma/ (schema + migrations)

frontend/
  src/ (React app, Chart.js, styles)
```

