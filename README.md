# Midtrans API + Dashboard

Repository ini memakai pola dua service dalam satu monorepo:

- `backend` untuk API FastAPI di root project
- `frontend` untuk dashboard Next.js di `frontend/`

Keduanya dipisah pada workdir, port, log, dan proses runtime. `start.py` dipakai sebagai service manager lokal.

## Arsitektur

- API source: `app/`
- Dashboard source: `frontend/app/`
- Schema database: `supabase/schema.sql`
- Migrasi database: `migrate.py`
- Service manager: `start.py`

Endpoint utama:

- User auth: `/api/auth/*`
- Admin auth: `/api/admin/auth/*`
- Admin dashboard: `/api/admin/*`
- Payment API: `/api/payments/*`

## Environment

Salin file env:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

Setting penting di `.env`:

```env
API_HOST=0.0.0.0
API_PORT=8000
API_PUBLIC_BASE_URL=http://127.0.0.1:8000

DASHBOARD_HOST=0.0.0.0
DASHBOARD_PORT=3000
DASHBOARD_PUBLIC_URL=http://127.0.0.1:3000

SERVICE_RUNTIME_DIR=.runtime
SERVICE_LOG_DIR=.runtime/logs
SERVICE_PID_DIR=.runtime/pids

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_DB_URL=postgresql://postgres:password@db.project-ref.supabase.co:5432/postgres
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxx
```

Frontend membaca `NEXT_PUBLIC_API_BASE_URL` dari `frontend/.env.local`.

## Setup

Backend:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Frontend:

```bash
cd frontend
npm install
cd ..
```

Jalankan migrasi:

```bash
python3 start.py migrate
```

`migrate.py` juga akan membuat atau meng-update akun admin dari `ADMIN_EMAIL`, `ADMIN_PASSWORD`, dan `ADMIN_NAME`.

## Menjalankan Service

Foreground:

```bash
python3 start.py api
python3 start.py dashboard
python3 start.py dev
```

Background:

```bash
python3 start.py start backend
python3 start.py start frontend
python3 start.py start all
```

Kontrol service:

```bash
python3 start.py status
python3 start.py stop frontend
python3 start.py restart all
python3 start.py -l frontend
python3 start.py -l backend -f
```

URL default lokal:

- API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- Dashboard: `http://127.0.0.1:3000`

## Docker

Jalankan container terpisah:

```bash
docker compose up --build -d
```

Port mapping saat ini:

- `backend -> 8111:8000`
- `frontend -> 3111:3000`

Migrasi via container:

```bash
docker compose run --rm backend python migrate.py
```

Stop container:

```bash
docker compose down
```

## Halaman Dashboard

- `/register`
- `/login`
- `/dashboard`
- `/admin/login`
- `/admin/dashboard`
- `/admin/users`
- `/admin/transactions`

## Endpoint API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/api-keys/rotate`
- `POST /api/admin/auth/login`
- `POST /api/admin/users`
- `GET /api/user/dashboard/summary`
- `GET /api/user/transactions`
- `GET /api/admin/dashboard`
- `GET /api/admin/users`
- `GET /api/admin/users/{user_id}`
- `PATCH /api/admin/users/{user_id}`
- `POST /api/admin/users/{user_id}/approve`
- `POST /api/admin/users/{user_id}/reject`
- `DELETE /api/admin/users/{user_id}`
- `GET /api/admin/users/{user_id}/api-keys`
- `POST /api/admin/users/{user_id}/api-keys`
- `PATCH /api/admin/users/{user_id}/api-keys/{api_key_id}`
- `DELETE /api/admin/users/{user_id}/api-keys/{api_key_id}`
- `GET /api/admin/transactions`
- `POST /api/payments/charge`
- `GET /api/payments/{order_id}/status`
- `POST /api/payments/{order_id}/cancel`
- `POST /api/payments/notifications`

## Catatan Keamanan

- Password disimpan sebagai hash PBKDF2.
- API key user disimpan dalam bentuk hash.
- Auth admin dan user dipisah.
- Payment API memakai header `X-API-Key`.
- Dashboard memakai bearer token hasil login.
