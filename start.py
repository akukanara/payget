from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from app.config import Settings


ROOT_DIR = Path(__file__).resolve().parent
ROOT_ENV_PATH = ROOT_DIR / ".env"
FRONTEND_ENV_PATH = ROOT_DIR / "frontend" / ".env.local"
DEFAULT_RUNTIME_DIR = ROOT_DIR / ".runtime"
SERVICE_ALIASES = {
    "api": "backend",
    "backend": "backend",
    "dashboard": "frontend",
    "frontend": "frontend",
}


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def resolve_workdir(base_dir: Path, configured_path: str) -> Path:
    candidate = Path(configured_path).expanduser()
    if not candidate.is_absolute():
        candidate = (base_dir / candidate).resolve()
    return candidate


def next_binary(frontend_dir: Path) -> Path:
    return frontend_dir / "node_modules" / ".bin" / "next"


def next_fallback_binary(frontend_dir: Path) -> Path:
    return frontend_dir / "node_modules" / "next" / "dist" / "bin" / "next"


def build_settings() -> Settings:
    load_env_file(ROOT_ENV_PATH)
    load_env_file(FRONTEND_ENV_PATH)
    return Settings()


def api_command(settings: Settings, host: str | None, port: int | None, reload_enabled: bool | None) -> list[str]:
    command = [
        sys.executable,
        "-m",
        "uvicorn",
        settings.api_app,
        "--host",
        host or settings.api_host,
        "--port",
        str(port or settings.api_port),
    ]
    if settings.api_reload if reload_enabled is None else reload_enabled:
        command.append("--reload")
    return command


def dashboard_command(settings: Settings, frontend_dir: Path, host: str | None, port: int | None, prod: bool) -> list[str]:
    binary = next_binary(frontend_dir)
    if binary.exists():
        launcher = [str(binary)]
    else:
        fallback = next_fallback_binary(frontend_dir)
        if not fallback.exists():
            raise SystemExit(
                f"Dashboard dependency not found: {binary} or {fallback}. Run `npm install` in {frontend_dir} first."
            )
        launcher = [os.environ.get("NODE_BINARY", "node"), str(fallback)]
    return [
        *launcher,
        "start" if prod else "dev",
        "--hostname",
        host or settings.dashboard_host,
        "--port",
        str(port or settings.dashboard_port),
    ]


def runtime_dir() -> Path:
    return Path(os.environ.get("SERVICE_RUNTIME_DIR", DEFAULT_RUNTIME_DIR)).resolve()


def logs_dir() -> Path:
    return Path(os.environ.get("SERVICE_LOG_DIR", runtime_dir() / "logs")).resolve()


def pids_dir() -> Path:
    return Path(os.environ.get("SERVICE_PID_DIR", runtime_dir() / "pids")).resolve()


def ensure_runtime_dirs() -> None:
    runtime_dir().mkdir(parents=True, exist_ok=True)
    logs_dir().mkdir(parents=True, exist_ok=True)
    pids_dir().mkdir(parents=True, exist_ok=True)


def pid_path(service: str) -> Path:
    return pids_dir() / f"{service}.pid"


def log_path(service: str) -> Path:
    return logs_dir() / f"{service}.log"


def resolve_service(name: str) -> str:
    key = name.strip().lower()
    if key not in SERVICE_ALIASES:
        raise SystemExit(f"Unknown service: {name}. Use backend/frontend.")
    return SERVICE_ALIASES[key]


def read_pid(service: str) -> int | None:
    path = pid_path(service)
    if not path.exists():
        return None
    try:
        return int(path.read_text(encoding="utf-8").strip())
    except ValueError:
        path.unlink(missing_ok=True)
        return None


def process_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def service_running(service: str) -> bool:
    pid = read_pid(service)
    if pid is None:
        return False
    if process_running(pid):
        return True
    pid_path(service).unlink(missing_ok=True)
    return False


def service_spec(
    service: str,
    settings: Settings,
    api_dir: Path,
    dashboard_dir: Path,
    args: argparse.Namespace | None = None,
) -> tuple[list[str], Path]:
    if service == "backend":
        host = getattr(args, "host", None) if args else None
        port = getattr(args, "port", None) if args else None
        reload_enabled = getattr(args, "reload_enabled", None) if args else None
        return api_command(settings, host, port, reload_enabled), api_dir

    host = getattr(args, "host", None) if args else None
    port = getattr(args, "port", None) if args else None
    prod = getattr(args, "prod", False) if args else False
    return dashboard_command(settings, dashboard_dir, host, port, prod), dashboard_dir


def run_once(command: list[str], workdir: Path, env: dict[str, str]) -> int:
    return subprocess.run(command, cwd=workdir, env=env, check=False).returncode


def run_dev(api_cmd: list[str], dashboard_cmd: list[str], api_dir: Path, dashboard_dir: Path, env: dict[str, str]) -> int:
    processes = [
        subprocess.Popen(api_cmd, cwd=api_dir, env=env),
        subprocess.Popen(dashboard_cmd, cwd=dashboard_dir, env=env),
    ]

    def stop_all() -> None:
        for process in processes:
            if process.poll() is None:
                process.terminate()
        deadline = time.time() + 5
        while time.time() < deadline and any(process.poll() is None for process in processes):
            time.sleep(0.1)
        for process in processes:
            if process.poll() is None:
                process.kill()

    def handle_signal(_: int, __: object) -> None:
        stop_all()
        raise SystemExit(130)

    previous_sigint = signal.signal(signal.SIGINT, handle_signal)
    previous_sigterm = signal.signal(signal.SIGTERM, handle_signal)
    try:
        while True:
            for process in processes:
                code = process.poll()
                if code is not None:
                    stop_all()
                    return code
            time.sleep(0.2)
    finally:
        signal.signal(signal.SIGINT, previous_sigint)
        signal.signal(signal.SIGTERM, previous_sigterm)


def start_background(service: str, command: list[str], workdir: Path, env: dict[str, str]) -> int:
    ensure_runtime_dirs()
    if service_running(service):
        print(f"{service} already running with PID {read_pid(service)}")
        return 0

    with log_path(service).open("a", encoding="utf-8") as log_file:
        log_file.write(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] starting {service}: {' '.join(command)}\n")
        log_file.flush()
        process = subprocess.Popen(
            command,
            cwd=workdir,
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )

    pid_path(service).write_text(f"{process.pid}\n", encoding="utf-8")
    time.sleep(0.4)
    if process.poll() is not None:
        pid_path(service).unlink(missing_ok=True)
        print(f"{service} failed to start. Check {log_path(service)}")
        return process.returncode or 1

    print(f"{service} started in background with PID {process.pid}")
    print(f"log: {log_path(service)}")
    return 0


def stop_background(service: str) -> int:
    pid = read_pid(service)
    if pid is None:
        print(f"{service} is not running")
        return 0

    try:
        os.killpg(pid, signal.SIGTERM)
    except ProcessLookupError:
        pid_path(service).unlink(missing_ok=True)
        print(f"{service} already stopped")
        return 0
    except OSError:
        os.kill(pid, signal.SIGTERM)

    deadline = time.time() + 5
    while time.time() < deadline:
        if not process_running(pid):
            pid_path(service).unlink(missing_ok=True)
            print(f"{service} stopped")
            return 0
        time.sleep(0.2)

    try:
        os.killpg(pid, signal.SIGKILL)
    except OSError:
        os.kill(pid, signal.SIGKILL)
    pid_path(service).unlink(missing_ok=True)
    print(f"{service} killed")
    return 0


def print_status(service: str) -> None:
    pid = read_pid(service)
    if pid is not None and process_running(pid):
        print(f"{service}: running (PID {pid})")
    else:
        if pid is not None:
            pid_path(service).unlink(missing_ok=True)
        print(f"{service}: stopped")
    print(f"log: {log_path(service)}")


def print_logs(service: str, lines: int, follow: bool) -> int:
    path = log_path(service)
    if not path.exists():
        print(f"No log file for {service} yet: {path}")
        return 1

    content = path.read_text(encoding="utf-8", errors="replace").splitlines()
    for line in content[-lines:]:
        print(line)

    if not follow:
        return 0

    position = path.stat().st_size
    try:
        while True:
            time.sleep(0.5)
            current_size = path.stat().st_size
            if current_size < position:
                position = 0
            if current_size == position:
                continue
            with path.open("r", encoding="utf-8", errors="replace") as handle:
                handle.seek(position)
                chunk = handle.read()
                if chunk:
                    print(chunk, end="")
                position = handle.tell()
    except KeyboardInterrupt:
        return 0


def main() -> int:
    settings = build_settings()

    parser = argparse.ArgumentParser(description="Service manager for API and dashboard.")
    parser.add_argument("-l", "--logs", dest="logs_service", help="Show logs for backend/frontend.")
    parser.add_argument("-f", "--follow", action="store_true", help="Follow logs when used with -l/--logs.")
    parser.add_argument("-n", "--lines", type=int, default=80, help="Number of log lines to print with -l.")
    subparsers = parser.add_subparsers(dest="command")

    api_parser = subparsers.add_parser("api", help="Run the FastAPI service.")
    api_parser.add_argument("--host")
    api_parser.add_argument("--port", type=int)
    api_parser.add_argument("--reload", dest="reload_enabled", action="store_true")
    api_parser.add_argument("--no-reload", dest="reload_enabled", action="store_false")
    api_parser.set_defaults(reload_enabled=None)

    dashboard_parser = subparsers.add_parser("dashboard", help="Run the Next.js dashboard.")
    dashboard_parser.add_argument("--host")
    dashboard_parser.add_argument("--port", type=int)
    dashboard_parser.add_argument("--prod", action="store_true", help="Run `next start` instead of `next dev`.")

    dev_parser = subparsers.add_parser("dev", help="Run API and dashboard together.")
    dev_parser.add_argument("--api-host")
    dev_parser.add_argument("--api-port", type=int)
    dev_parser.add_argument("--dashboard-host")
    dev_parser.add_argument("--dashboard-port", type=int)
    dev_parser.add_argument("--no-reload", dest="reload_enabled", action="store_false")
    dev_parser.set_defaults(reload_enabled=None)

    start_parser = subparsers.add_parser("start", help="Start service(s) in background.")
    start_parser.add_argument("service", choices=["backend", "frontend", "all"])
    start_parser.add_argument("--prod", action="store_true", help="Use `next start` for frontend.")

    stop_parser = subparsers.add_parser("stop", help="Stop service(s) running in background.")
    stop_parser.add_argument("service", choices=["backend", "frontend", "all"])

    restart_parser = subparsers.add_parser("restart", help="Restart service(s) in background.")
    restart_parser.add_argument("service", choices=["backend", "frontend", "all"])
    restart_parser.add_argument("--prod", action="store_true", help="Use `next start` for frontend.")

    status_parser = subparsers.add_parser("status", help="Show service status.")
    status_parser.add_argument("service", nargs="?", choices=["backend", "frontend", "all"], default="all")

    subparsers.add_parser("migrate", help="Run the database migration script.")
    subparsers.add_parser("info", help="Print resolved service settings.")

    args = parser.parse_args()

    api_dir = resolve_workdir(ROOT_DIR, settings.api_workdir)
    dashboard_dir = resolve_workdir(ROOT_DIR, settings.dashboard_workdir)

    env = os.environ.copy()
    env.setdefault("API_HOST", settings.api_host)
    env.setdefault("API_PORT", str(settings.api_port))
    env.setdefault("API_RELOAD", "true" if settings.api_reload else "false")
    env.setdefault("API_PUBLIC_BASE_URL", settings.resolved_api_public_base_url)
    env.setdefault("DASHBOARD_HOST", settings.dashboard_host)
    env.setdefault("DASHBOARD_PORT", str(settings.dashboard_port))
    env.setdefault("DASHBOARD_PUBLIC_URL", settings.resolved_dashboard_public_url)
    env.setdefault("NEXT_PUBLIC_API_BASE_URL", settings.resolved_api_public_base_url)
    env.setdefault("NEXT_PUBLIC_DASHBOARD_PORT", str(settings.dashboard_port))

    if args.logs_service:
        return print_logs(resolve_service(args.logs_service), max(args.lines, 1), args.follow)

    if args.command == "api":
        command, workdir = service_spec("backend", settings, api_dir, dashboard_dir, args)
        return run_once(command, workdir, env)

    if args.command == "dashboard":
        command, workdir = service_spec("frontend", settings, api_dir, dashboard_dir, args)
        return run_once(command, workdir, env)

    if args.command == "dev":
        return run_dev(
            api_command(settings, args.api_host, args.api_port, args.reload_enabled),
            dashboard_command(settings, dashboard_dir, args.dashboard_host, args.dashboard_port, False),
            api_dir,
            dashboard_dir,
            env,
        )

    if args.command == "migrate":
        return run_once([sys.executable, "migrate.py"], ROOT_DIR, env)

    if args.command == "info":
        print(f"API service: {settings.api_service_name}")
        print(f"API workdir: {api_dir}")
        print(f"API bind: {settings.api_host}:{settings.api_port}")
        print(f"API public URL: {settings.resolved_api_public_base_url}")
        print(f"Dashboard service: {settings.dashboard_service_name}")
        print(f"Dashboard workdir: {dashboard_dir}")
        print(f"Dashboard bind: {settings.dashboard_host}:{settings.dashboard_port}")
        print(f"Dashboard public URL: {settings.resolved_dashboard_public_url}")
        return 0

    if args.command == "start":
        services = ["backend", "frontend"] if args.service == "all" else [args.service]
        result = 0
        for service in services:
            service_args = argparse.Namespace(prod=getattr(args, "prod", False))
            command, workdir = service_spec(service, settings, api_dir, dashboard_dir, service_args)
            result = start_background(service, command, workdir, env) or result
        return result

    if args.command == "stop":
        services = ["frontend", "backend"] if args.service == "all" else [args.service]
        result = 0
        for service in services:
            result = stop_background(service) or result
        return result

    if args.command == "restart":
        services = ["frontend", "backend"] if args.service == "all" else [args.service]
        for service in services:
            stop_background(service)
        result = 0
        for service in reversed(services):
            service_args = argparse.Namespace(prod=getattr(args, "prod", False))
            command, workdir = service_spec(service, settings, api_dir, dashboard_dir, service_args)
            result = start_background(service, command, workdir, env) or result
        return result

    if args.command == "status":
        services = ["backend", "frontend"] if args.service == "all" else [args.service]
        for service in services:
            print_status(service)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
