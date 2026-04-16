# Repository Guidelines

## Project Structure & Module Organization
`app/` contains the FastAPI backend. `app/main.py` defines routes and app startup, while `config.py`, `security.py`, `midtrans.py`, and `supabase.py` hold integrations and shared logic. `frontend/` contains the Next.js dashboard under `frontend/app/` with route folders such as `login/`, `register/`, `dashboard/`, and `admin/`. Database schema lives in `supabase/schema.sql`. Root-level runtime files include `requirements.txt`, `migrate.py`, `docker-compose.yml`, and `.env.example`.

## Build, Test, and Development Commands
Backend setup:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 migrate.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Frontend setup:
```bash
cd frontend
npm install
npm run dev
```
Container workflow:
```bash
docker compose up --build
docker compose run --rm backend python migrate.py
```
Use `npm run build` in `frontend/` before merging UI changes.

## Coding Style & Naming Conventions
Follow the existing style in the repo: Python uses 4-space indentation, type hints, and `snake_case` for functions and variables. JavaScript uses 2-space indentation, semicolons, and `PascalCase` for React components. Keep FastAPI helpers small and colocated in `app/`. Prefer descriptive route/page names such as `frontend/app/admin/login/page.js`. No formatter or linter config is committed yet, so keep changes consistent with surrounding code.

## Testing Guidelines
There is no configured automated test suite yet. For backend changes, add focused tests under a future `tests/` package using `test_*.py` naming and FastAPI request-level coverage where practical. For frontend changes, at minimum verify `npm run build` succeeds and manually smoke-test login, dashboard, and admin flows against a local backend. Document any uncovered risk in the PR.

## Commit & Pull Request Guidelines
Git history currently starts with a single `initial` commit, so adopt short imperative commit subjects going forward, for example `Add admin transaction filter`. Keep commits scoped to one change. PRs should include a clear summary, affected areas (`app/`, `frontend/`, `supabase/`), environment or schema changes, and screenshots for UI updates. Link the relevant issue when one exists.

## Security & Configuration Tips
Never commit populated `.env` files, Midtrans keys, or Supabase service-role credentials. Keep API key handling hashed only, preserve admin/user auth separation, and update `.env.example` when adding required configuration.
