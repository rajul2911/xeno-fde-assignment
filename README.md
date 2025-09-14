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
                                    - MySQL (local) with a database named `xeno_fde`
                                    - A Shopify store with a Custom App and an Admin API Access Token (shpat_…)

                                    Recommended Shopify scopes:
                                    - read_customers, read_products, read_orders (add read_all_orders for full historical orders)

                                    ## Setup & Run (Windows cmd.exe)

                                    1) Backend: install, configure env, migrate, run
                                    - Create env: copy `backend/.env.example` to `backend/.env` and fill values. Example:

                                    ```
                                    DATABASE_URL="mysql://root:YOURPASS@127.0.0.1:3306/xeno_fde"
                                    PORT=4000
                                    JWT_SECRET="supersecretjwt"  # not used in demo mode

                                    # Optional defaults (not required in demo mode UI flow)
                                    SHOPIFY_API_KEY=""
                                    SHOPIFY_API_SECRET=""
                                    SHOPIFY_ADMIN_TOKEN=""
                                    SHOPIFY_SHOP_DOMAIN=""

                                    # Scheduler interval (ms), default ~15 minutes
                                    SYNC_INTERVAL_MS=900000
                                    ```

                                    - Install & migrate:
                                    ```
                                    cd backend
                                    npm install
                                    npm run prisma:generate
                                    npm run prisma:migrate
                                    npm run dev
                                    ```

                                    Backend starts on http://localhost:4000

                                    2) Frontend: install & start
                                    ```
                                    cd frontend
                                    npm install
                                    npm start
                                    ```
                                    Frontend runs on http://localhost:3000 and proxies API to http://localhost:4000 (see `frontend/package.json` "proxy").

                                    Optional: If you deploy backend elsewhere, set `REACT_APP_API_BASE` in the frontend environment to your backend URL (e.g., https://api.example.com/api).

                                    ## Using the App
                                    - Open the React UI (http://localhost:3000)
                                    - Connect Shopify: enter your myshopify.com domain and Admin access token (shpat_…)
                                    - Click “Check Shopify” to verify access (orders/customers/products)
                                    - Click “Save Connection”, then “Sync Now” to ingest data
                                    - The dashboard shows:
                                        - KPIs: Customers, Orders, Revenue
                                        - Revenue over time (line chart)
                                        - Top customers by spend (bar chart)

                                    Notes
                                    - Domain is normalized (protocols and paths removed)
                                    - Token is trimmed; both are stored on tenant id=1
                                    - A background scheduler will periodically re-sync if `SYNC_INTERVAL_MS` > 0

                                    ## REST API (prefix /api)
                                    - GET `/health` → { ok, time }
                                    - GET `/tenants/me` → { id, name, email, shopDomain, hasAccessToken }
                                    - POST `/tenants/shopify` → Save credentials on demo tenant
                                        - Content-Type: application/json
                                        - Body: `{ "domain": "example.myshopify.com", "adminToken": "shpat_..." }`
                                    - GET `/tenants/shopify/check` → Validate stored credentials and scope access
                                    - POST `/ingest/run` → Trigger a manual sync (customers, products, orders)
                                    - GET `/insights/summary` → { customers, orders, revenue }
                                    - GET `/insights/orders-by-date?start=YYYY-MM-DD&end=YYYY-MM-DD` → { data: [{ date, revenue }] }
                                    - GET `/insights/top-customers` → { data: [{ name, total }] }

                                    All endpoints return JSON. A global error handler standardizes errors like invalid JSON body or Shopify 401 responses.

                                    ## Database Model (Prisma → MySQL)
                                    Tables map 1:1 to the MySQL schema via `@@map` and `@map`:
                                    - tenants
                                        - id (PK, Int), shop_domain (String, nullable), access_token (String, nullable)
                                        - name/email/passwordHash (nullable, reserved)
                                        - created_at, updated_at
                                    - customers
                                        - id (PK), tenant_id (FK), shopify_id (String, unique per tenant)
                                        - email, first_name, last_name, total_spend (Decimal)
                                        - created_at, updated_at
                                    - products
                                        - id (PK), tenant_id (FK), shopify_id (String, unique per tenant)
                                        - title, sku (nullable), price (Decimal)
                                        - created_at, updated_at
                                    - orders
                                        - id (PK), tenant_id (FK), shopify_id (String, unique per tenant)
                                        - customer_id (nullable FK), total_price (Decimal), created_at (nullable), updated_at
                                    - order_items
                                        - id (PK), order_id (FK), product_id (FK), quantity (Int), price (Decimal)

                                    Key constraints
                                    - Composite uniques on (tenant_id, shopify_id) for Customers, Products, and Orders
                                    - Decimal precision via Prisma @db.Decimal(12,2)

                                    ## Scheduler
                                    - Runs a periodic sync across tenants that have `shop_domain` and `access_token` set (demo: id=1)
                                    - Configure interval with `SYNC_INTERVAL_MS` (default 900000 ms)

                                    ## Troubleshooting
                                    - “Check Shopify” says OK but sync fails
                                        - Ensure at least one product, customer, and order exist in your store
                                        - Verify scopes include read_customers, read_products, read_orders (read_all_orders if needed)
                                    - “Unexpected token '<' … not valid JSON”
                                        - Fixed: the backend always returns JSON even on errors; the frontend also guards non-JSON
                                    - 401 Unauthorized from Shopify
                                        - Token must be the Admin API Access Token (shpat_…), and domain must be your myshopify.com domain
                                        - The token must belong to an app installed on that same store
                                    - Prisma migrate issues / drift
                                        - Use `npx prisma migrate reset --force` in dev (this will clear data) and then re-run migrate
                                    - Windows PowerShell blocks npx
                                        - Use Command Prompt (cmd.exe) or run via npm scripts (e.g., `npm run prisma:migrate`)

                                    ## Scripts
                                    Backend (`backend/package.json`):
                                    - `npm run dev` – start server with nodemon
                                    - `npm start` – start server
                                    - `npm run prisma:generate` – generate Prisma client
                                    - `npm run prisma:migrate` – run dev migration

                                    Frontend (`frontend/package.json`):
                                    - `npm start` – start CRA dev server
                                    - `npm run build` – build production assets
                                    - `npm test` – run tests

                                    ## Security & Scope
                                    - Demo mode has no authentication and writes Shopify credentials to tenant id=1. For production, re-enable auth and per-tenant isolation.
                                    - Consider adding rate limiting, retries, and webhook-driven delta sync for scale.

                                    ## Notes
                                    - The .env values `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` are reserved for a future OAuth flow and are not required in the demo mode.
                                    - API version is pinned to 2024-10; adjust if your store requires another version.

                                    ---

                                    This README describes the code as implemented in this repository for assignment submission: ready-to-run local setup, clear API surface, and a simple connect → sync → visualize flow.
