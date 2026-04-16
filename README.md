# Midtrans Payment API + Dashboard

Backend payment menggunakan Python, FastAPI, Midtrans Core API, Supabase, API key per user, serta frontend dashboard Next.js.

## Arsitektur

- Backend FastAPI di folder `app/`
- Frontend Next.js di folder `frontend/`
- Storage user, API key hash, dan transaksi di Supabase
- User baru harus diverifikasi admin sebelum bisa login atau memakai API key
- Endpoint auth user: `/api/auth/*`
- Endpoint auth admin: `/api/admin/auth/*`
- Endpoint admin dashboard: `/api/admin/*`
- Endpoint payment berbasis API key: `/api/payments/*`

## Persiapan Supabase

1. Buat project Supabase.
2. Ambil nilai berikut dari dashboard Supabase:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_DB_URL` atau connection string Postgres Supabase
3. Jalankan migrasi schema dengan `migrate.py`.

## Menjalankan backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Isi `.env`:

```env
APP_SECRET_KEY=change-this-secret-key
ACCESS_TOKEN_EXPIRY_MINUTES=120
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
MIDTRANS_IS_PRODUCTION=false
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_DB_URL=postgresql://postgres:password@db.project-ref.supabase.co:5432/postgres
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=supersecurepassword
ADMIN_NAME=Administrator
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Jalankan migrasi:

```bash
python3 migrate.py
```

`migrate.py` juga akan membuat atau meng-update akun admin dari `ADMIN_EMAIL`, `ADMIN_PASSWORD`, dan `ADMIN_NAME` di `.env`.

Jalankan backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

## Menjalankan frontend Next.js

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Frontend akan aktif di:

```text
http://127.0.0.1:3000
```

Halaman frontend:

- `/register` registrasi user baru
- `/login` login user
- `/dashboard` dashboard user, rotate API key, dan create charge
- `/admin/login` login admin
- `/admin/dashboard` ringkasan admin
- `/admin/users` daftar user
- `/admin/transactions` daftar transaksi

## Menjalankan dengan Docker

Pastikan file `.env` di root project sudah terisi.

Jalankan:

```bash
docker compose up --build
```

Service yang aktif:

- Backend FastAPI: `http://127.0.0.1:8000`
- Swagger UI: `http://127.0.0.1:8000/docs`
- Frontend Next.js: `http://127.0.0.1:3000`

Untuk menjalankan migrasi di container backend:

```bash
docker compose run --rm backend python migrate.py
```

Menjalankan di background:

```bash
docker compose up --build -d
```

Menghentikan service:

```bash
docker compose down
```

## Endpoint utama

- `POST /api/auth/register` buat user baru dengan status pending approval dan generate API key pertama
- `POST /api/auth/login` login user dashboard
- `GET /api/auth/me` profil user dan prefix API key aktif
- `POST /api/auth/api-keys/rotate` generate API key baru dan menonaktifkan key aktif sebelumnya
- `POST /api/admin/auth/login` login admin
- `POST /api/admin/users` create user dari admin
- `GET /api/user/dashboard/summary` ringkasan transaksi user
- `GET /api/user/transactions` daftar transaksi user
- `GET /api/admin/dashboard` ringkasan admin + user terbaru + transaksi terbaru
- `GET /api/admin/users` daftar user
- `GET /api/admin/users/{user_id}` detail user + API key
- `PATCH /api/admin/users/{user_id}` update user
- `POST /api/admin/users/{user_id}/approve` approve user
- `POST /api/admin/users/{user_id}/reject` nonaktifkan approval user
- `DELETE /api/admin/users/{user_id}` hapus user
- `GET /api/admin/users/{user_id}/api-keys` daftar API key user
- `POST /api/admin/users/{user_id}/api-keys` generate API key user
- `PATCH /api/admin/users/{user_id}/api-keys/{api_key_id}` aktif/nonaktif API key
- `DELETE /api/admin/users/{user_id}/api-keys/{api_key_id}` hapus API key
- `GET /api/admin/transactions` daftar semua transaksi
- `POST /api/payments/charge` create charge dengan header `X-API-Key`
- `GET /api/payments/{order_id}/status` cek status transaksi dengan header `X-API-Key`
- `POST /api/payments/{order_id}/cancel` cancel transaksi dengan header `X-API-Key`
- `POST /api/payments/notifications` webhook Midtrans

## Contoh charge

Header:

```text
X-API-Key: ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Body:

```json
{
  "payment_type": "bank_transfer",
  "transaction_details": {
    "order_id": "ORDER-12345",
    "gross_amount": 150000
  },
  "customer_details": {
    "first_name": "Budi",
    "email": "budi@example.com",
    "phone": "08123456789"
  },
  "bank_transfer": {
    "bank": "bca"
  }
}
```

## Catatan keamanan

- Password disimpan dalam bentuk hash PBKDF2.
- API key per user disimpan dalam bentuk hash, bukan plaintext.
- Admin dan user memakai endpoint auth yang terpisah.
- Payment API tidak memakai bearer token, tetapi `X-API-Key` per user.
- Dashboard user/admin memakai bearer token hasil login.
