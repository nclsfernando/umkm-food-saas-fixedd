# 🍜 UMKM Food — Aplikasi Laporan Keuangan Online Food

Aplikasi SaaS untuk UMKM kuliner yang berjualan di GoFood, GrabFood, dan ShopeeFood.

## Stack

| Layer      | Tech                                              |
|------------|---------------------------------------------------|
| Frontend   | Next.js 15, TypeScript, Tailwind CSS, Recharts    |
| Backend    | NestJS, Prisma ORM, PostgreSQL                    |
| Deploy FE  | **Vercel** (Root Directory: `frontend`)           |
| Deploy BE  | **Render** free web + **Render** free Postgres    |

## Struktur Folder

```
umkm-food-saas/
├── frontend/              # Next.js 15 app → deploy ke Vercel
│   ├── src/
│   │   ├── app/           # Pages (dashboard, orders, products, dll)
│   │   ├── components/    # Sidebar, dll
│   │   └── lib/           # API client, utils
│   ├── vercel.json        # ← KRUSIAL: config Vercel
│   └── package.json
├── backend/               # NestJS API → deploy ke Render (Docker)
│   ├── src/               # Source TypeScript
│   ├── prisma/            # Schema + seed
│   └── package.json
├── render.yaml            # Render Blueprint (free web + free Postgres)
├── docker-compose.yml     # Untuk local development
└── .github/workflows/     # CI/CD otomatis
```

---

## 🚀 Deploy ke Vercel (Frontend)

> **Root Cause Error 404**: Vercel tidak tahu folder `frontend` adalah root app.
> Wajib set **Root Directory** ke `frontend`.

### Langkah-langkah:

**1. Import project di Vercel**
- Pergi ke https://vercel.com/new
- Import repo GitHub kamu

**2. Set Root Directory** ← INI YANG PALING PENTING
```
Root Directory: frontend
```

**3. Environment Variables**
`frontend/.env.production` sudah berisi:
```
NEXT_PUBLIC_API_URL=https://umkm-food-saas-api.onrender.com/api/v1
```
Vercel Git build akan memakai nilai itu. Override di dashboard Vercel hanya jika perlu.

**4. Deploy Settings (auto-detect, tapi pastikan):**
```
Framework Preset: Next.js
Build Command:    npm run build
Output Directory: .next
Install Command:  npm install
```

---

## 🟦 Deploy gratis: Render (API) + Render Postgres

> **Stack gratis:** Web Service Render (`plan: free`) + Render Postgres (`plan: free`), region Singapore.  
> **Batasan free:** Postgres expire setelah **30 hari**; web **cold-start** setelah ~**15 menit** idle. Tidak perlu Neon.

**1. Deploy Blueprint Render (web + Postgres)**
- https://dashboard.render.com/blueprint/new?repo=https://github.com/nclsfernando/umkm-food-saas-fixedd
- File Blueprint: `render.yaml` → `umkm-food-saas-api` (plan **free**, Docker) + `umkm-food-db` (plan **free**, Postgres 16)

**2. `DATABASE_URL` otomatis dari Blueprint**
- Blueprint mengisi `DATABASE_URL` via `fromDatabase` → `umkm-food-db` (`connectionString`)
- Tidak perlu signup Neon atau set manual di dashboard

**3. Environment lain (sudah di Blueprint):**
```
NODE_ENV        = production
PORT            = 4000
FRONTEND_URL    = https://umkm-food-saas-fixedd.vercel.app
JWT_SECRET      = (generateValue di Blueprint)
JWT_EXPIRES_IN  = 7d
```

**4. Frontend sudah mengarah ke API Render**
- `frontend/.env.production` → `https://umkm-food-saas-api.onrender.com/api/v1`
- Health: `https://umkm-food-saas-api.onrender.com/api/v1/health`

**5. Docker & start**
- `dockerfilePath: ./backend/Dockerfile`
- `dockerContext: ./backend`
- Start: `npx prisma migrate deploy && node dist/src/main.js`

**6. Seed setelah deploy pertama (opsional):**
```bash
# Via Render Shell di dashboard service:
npx prisma db seed
```

**7. CI (opsional)**
- Render auto-deploy dari Git setelah Blueprint terhubung.
- Opsional: set secret `RENDER_DEPLOY_HOOK` di GitHub Actions untuk `curl POST` ke deploy hook.

---

## 💻 Local Development

```bash
# 1. Clone repo
git clone https://github.com/yourorg/umkm-food.git
cd umkm-food

# 2. Backend
cd backend
cp .env.example .env     # edit DATABASE_URL & JWT_SECRET
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev        # http://localhost:4000

# 3. Frontend (terminal baru)
cd ../frontend
cp .env.example .env.local  # isi NEXT_PUBLIC_API_URL
npm install
npm run dev              # http://localhost:3000
```

## Docker (semua sekaligus)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- API Docs: http://localhost:4000/api/docs

---

## API Endpoints

| Method | Endpoint                        | Keterangan           |
|--------|---------------------------------|----------------------|
| GET    | /api/v1/dashboard/summary       | Ringkasan dashboard  |
| GET    | /api/v1/dashboard/chart/daily   | Grafik harian        |
| GET    | /api/v1/dashboard/marketplace   | Breakdown marketplace|
| GET    | /api/v1/orders                  | Daftar pesanan       |
| POST   | /api/v1/orders                  | Tambah pesanan       |
| GET    | /api/v1/products                | Daftar produk        |
| POST   | /api/v1/products                | Tambah produk        |
| GET    | /api/v1/expenses                | Daftar biaya         |
| POST   | /api/v1/expenses                | Tambah biaya         |
| GET    | /api/v1/reports/profit-loss     | Laporan laba rugi    |
| GET    | /api/v1/health                  | Health check         |
