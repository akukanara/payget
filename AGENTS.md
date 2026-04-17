# Repository Guidelines

## Project Structure & Module Organization
Treat this repository as two services, not one combined app. The API service lives in `app/` with root-level Python files such as `requirements.txt`, `migrate.py`, and `Dockerfile.backend`. The dashboard service lives in `frontend/` with its own `package.json`, `Dockerfile`, and Next.js routes under `frontend/app/`. Shared database SQL stays in `supabase/schema.sql`. Keep backend and frontend changes isolated by service whenever possible.

## Build, Test, and Development Commands
API service (`workdir: /home/kannn/ashelole`):
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 migrate.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Dashboard service (`workdir: /home/kannn/ashelole/frontend`):
```bash
cd frontend
npm install
npm run dev
```
Docker runs them as separate services and ports:
```bash
docker compose up --build
docker compose run --rm backend python migrate.py
```
Current mapping is `backend -> 8111:8000` and `frontend -> 3111:3000`. Do not collapse both runtimes into one container or one workdir.

## Coding Style & Naming Conventions
Follow the existing style in the repo: Python uses 4-space indentation, type hints, and `snake_case` for functions and variables. JavaScript uses 2-space indentation, semicolons, and `PascalCase` for React components. Keep FastAPI helpers small and colocated in `app/`. Prefer descriptive route/page names such as `frontend/app/admin/login/page.js`. No formatter or linter config is committed yet, so keep changes consistent with surrounding code.

## Testing Guidelines
There is no configured automated test suite yet. For API changes, add focused tests under a future `tests/` package using `test_*.py` naming and cover request/response behavior. For dashboard changes, at minimum run `npm run build` in `frontend/` and manually verify login, dashboard, and admin flows against the API. Document service-specific gaps in the PR.

## Commit & Pull Request Guidelines
Git history currently starts with a single `initial` commit, so adopt short imperative commit subjects going forward, for example `Add admin transaction filter`. Keep commits scoped to one service unless the change truly spans API and dashboard. PRs should state which service is affected, note port or env changes, and include screenshots for dashboard updates. Link the relevant issue when one exists.

## Service Boundaries
Preserve a microservice mindset inside this monorepo. API concerns stay in `app/` and should not depend on Next.js files. Dashboard concerns stay in `frontend/` and should talk to the API only through `NEXT_PUBLIC_API_BASE_URL`. If a task touches both services, describe the contract change clearly before editing both sides.

## Security & Configuration Tips
Never commit populated `.env` files, Midtrans keys, or Supabase service-role credentials. Keep API key handling hashed only, preserve admin/user auth separation, and update `.env.example` when adding required configuration.
