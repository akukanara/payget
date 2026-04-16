from pathlib import Path
import sys

import psycopg

from app.security import hash_secret


ROOT_DIR = Path(__file__).resolve().parent
ENV_PATH = ROOT_DIR / ".env"
SCHEMA_PATH = ROOT_DIR / "supabase" / "schema.sql"


def load_env_file() -> None:
    if not ENV_PATH.exists():
        return

    for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in __import__("os").environ:
            __import__("os").environ[key] = value


def main() -> int:
    load_env_file()

    import os

    db_url = os.getenv("SUPABASE_DB_URL", "").strip()
    if not db_url:
        print("SUPABASE_DB_URL belum diisi di .env.", file=sys.stderr)
        return 1

    if not SCHEMA_PATH.exists():
        print(f"File schema tidak ditemukan: {SCHEMA_PATH}", file=sys.stderr)
        return 1

    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    admin_email = os.getenv("ADMIN_EMAIL", "").strip()
    admin_password = os.getenv("ADMIN_PASSWORD", "").strip()
    admin_name = os.getenv("ADMIN_NAME", "Administrator").strip() or "Administrator"

    try:
        with psycopg.connect(db_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                if admin_email and admin_password:
                    cur.execute(
                        """
                        insert into public.app_users (full_name, email, password_hash, is_admin)
                        values (%s, %s, %s, true)
                        on conflict (email)
                        do update set
                          full_name = excluded.full_name,
                          password_hash = excluded.password_hash,
                          is_admin = true,
                          is_approved = true
                        """,
                        (
                            admin_name,
                            admin_email,
                            hash_secret(admin_password),
                        ),
                    )
    except psycopg.Error as exc:
        print(f"Migrasi gagal: {exc}", file=sys.stderr)
        return 1

    print(f"Migrasi berhasil dijalankan dari {SCHEMA_PATH}")
    if admin_email and admin_password:
        print(f"Admin siap dipakai: {admin_email}")
    else:
        print("ADMIN_EMAIL atau ADMIN_PASSWORD kosong, seed admin dilewati.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
