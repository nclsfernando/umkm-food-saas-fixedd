# 🍜 UMKM Food — Aplikasi Laporan Keuangan Online Food

Aplikasi SaaS untuk UMKM kuliner yang berjualan di GoFood, GrabFood, dan ShopeeFood.

## Stack

| Layer      | Tech                                              |
|------------|---------------------------------------------------|
| Frontend   | Next.js 15, TypeScript, Tailwind CSS, Recharts    |
| Backend    | NestJS, Prisma ORM, PostgreSQL                    |
| Deploy FE  | **Vercel** (Root Directory: `frontend`)           |
| Deploy BE  | **Railway**                                       |

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
├── backend/               # NestJS API → deploy ke Railway
│   ├── src/               # Source TypeScript
│   ├── prisma/            # Schema + seed
│   └── package.json
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

**3. Set Environment Variables di Vercel**
```
NEXT_PUBLIC_API_URL = https://nama-backend-kamu.railway.app/api/v1
```

**4. Deploy Settings (auto-detect, tapi pastikan):**
```
Framework Preset: Next.js
Build Command:    npm run build
Output Directory: .next
Install Command:  npm install
```

---

## 🚂 Deploy ke Railway (Backend)

**1. Buat project baru di Railway**
- https://railway.app/new → Deploy from GitHub Repo

**2. Set Root Directory di Railway**
```
Root Directory: backend
```

**3. Set Environment Variables di Railway:**
```
NODE_ENV        = production
PORT            = 4000
DATABASE_URL    = (otomatis dari PostgreSQL service Railway)
JWT_SECRET      = buat-secret-acak-minimal-32-karakter
JWT_EXPIRES_IN  = 7d
FRONTEND_URL    = https://nama-frontend-kamu.vercel.app
```

**4. Tambah PostgreSQL service di Railway**
- Klik "+ New" → Database → PostgreSQL
- Railway otomatis inject `DATABASE_URL`

**5. Jalankan seed setelah deploy:**
```bash
railway run --service backend npx prisma db seed
```

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

## Demo Login

```
Email:    demo@umkmfood.id
Password: Demo1234!
```

---

## API Endpoints

| Method | Endpoint                        | Keterangan           |
|--------|---------------------------------|----------------------|
| POST   | /api/v1/auth/login              | Login                |
| POST   | /api/v1/auth/register           | Register             |
| GET    | /api/v1/auth/me                 | Profile user         |
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
