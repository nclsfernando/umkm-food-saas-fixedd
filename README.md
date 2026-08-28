# 🍜 UMKM Food — Aplikasi Laporan Keuangan Online Food

Aplikasi SaaS untuk UMKM kuliner yang berjualan di GoFood, GrabFood, dan ShopeeFood.

## Stack

| Layer      | Tech                                              |
|------------|---------------------------------------------------|
| Frontend   | Next.js 15, TypeScript, Tailwind CSS, Recharts    |
| Backend    | NestJS, Prisma ORM, PostgreSQL                    |
| Deploy FE  | **Vercel** (Root Directory: `frontend`)           |
| Deploy BE  | **Zeabur Free** (Docker) + **Neon** (free Postgres) |

> **Kenapa bukan Render?** Render Blueprint / free web sekarang **meminta kartu pembayaran** bahkan untuk plan gratis. Stack ini memakai **Zeabur Free (tanpa kartu)** + **Neon free Postgres**.

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
├── backend/               # NestJS API → deploy ke Zeabur (Docker)
│   ├── src/               # Source TypeScript
│   ├── prisma/            # Schema + seed
│   ├── Dockerfile         # Dipakai Zeabur
│   └── package.json
├── zbpack.json            # Zeabur: path Dockerfile → backend/Dockerfile
├── docker-compose.yml     # Untuk local development
└── .github/workflows/     # CI/CD (Vercel + opsional hook Zeabur)
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
`frontend/.env.production` sudah berisi placeholder:
```
NEXT_PUBLIC_API_URL=https://umkm-food-saas-api.zeabur.app/api/v1
```
Ganti domain itu setelah service Zeabur aktif (lihat langkah bind domain di bawah). Override di dashboard Vercel hanya jika perlu.

**4. Deploy Settings (auto-detect, tapi pastikan):**
```
Framework Preset: Next.js
Build Command:    npm run build
Output Directory: .next
Install Command:  npm install
```

---

## 🟩 Deploy gratis: Zeabur (API) + Neon (Postgres)

> **Tanpa kartu:** [Zeabur Free](https://zeabur.com) + [Neon free Postgres](https://neon.tech).  
> Jangan pakai Render (minta kartu) atau Render Postgres (berbayar).

### 1. Buat database gratis di Neon
- Daftar/login: https://neon.tech
- Buat project baru (tier gratis)
- Copy **connection string pooled** (host biasanya berisi `-pooler`)

### 2. Deploy API ke Zeabur
- Daftar/login: https://zeabur.com (plan Free — **tidak perlu kartu**)
- Buat Project → Add Service → **Deploy from GitHub**
- Pilih repo: `nclsfernando/umkm-food-saas-fixedd`

**Root Directory (pilih salah satu):**
| Cara | Setting |
|------|---------|
| **Disarankan** | Di service Settings → **Root Directory** = `backend` (Dockerfile di `backend/` terdeteksi otomatis) |
| Alternatif | Root Directory kosong (repo root) + `zbpack.json` mengarah ke `backend/Dockerfile` |

### 3. Environment variables di Zeabur (wajib)

| Variable       | Contoh / catatan |
|----------------|------------------|
| `PORT`         | Biarkan Zeabur inject, atau set `4000` (app membaca `PORT`) |
| `DATABASE_URL` | URL Neon **pooled** (host biasanya berisi `-pooler`) |
| `DIRECT_URL`   | URL Neon **non-pooler** (untuk `prisma migrate deploy`). Jika kosong, Docker fallback ke `DATABASE_URL` |
| `FRONTEND_URL` | `https://umkm-food-saas-fixedd.vercel.app` |
| `NODE_ENV`     | `production` |
| `JWT_SECRET`   | string acak panjang (≥32 karakter) |
| `JWT_EXPIRES_IN` | `7d` |

### 4. Bind domain API
- Di service Zeabur → Domains → generate / bind subdomain
- **Nama yang dituju:** `umkm-food-saas-api.zeabur.app` (bind nama ini di dashboard Zeabur; jika sudah dipakai, pakai domain yang diberikan Zeabur lalu update `.env.production` + Vercel)
- Health check: `https://umkm-food-saas-api.zeabur.app/api/v1/health`

### 5. Frontend mengarah ke API Zeabur
- `frontend/.env.production` → `https://umkm-food-saas-api.zeabur.app/api/v1`
- Setelah domain Zeabur final, redeploy Vercel agar `NEXT_PUBLIC_API_URL` ikut ter-build

### 6. Docker & start (sudah di `backend/Dockerfile`)
- Build context: folder `backend/`
- Start: `npx prisma migrate deploy && node dist/src/main.js`

### 7. Seed setelah deploy pertama (opsional)
```bash
# Via Zeabur shell / one-off command di service:
npx prisma db seed
```

### 8. CI (opsional)
- Zeabur biasanya auto-deploy dari Git setelah service terhubung.
- Opsional: set secret `ZEABUR_DEPLOY_HOOK` di GitHub Actions untuk `curl POST` ke webhook redeploy.

---

## 💻 Local Development

```bash
# 1. Clone repo
git clone https://github.com/nclsfernando/umkm-food-saas-fixedd.git
cd umkm-food-saas-fixedd

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
