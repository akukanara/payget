from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Midtrans Payment API"
    app_version: str = "2.0.0"
    app_description: str = "Backend payment menggunakan FastAPI, Midtrans Core API, auth terpisah, dan Supabase."

    api_service_name: str = Field("backend", alias="API_SERVICE_NAME")
    api_workdir: str = Field(".", alias="API_WORKDIR")
    api_app: str = Field("app.main:app", alias="API_APP")
    api_host: str = Field("0.0.0.0", alias="API_HOST")
    api_port: int = Field(8000, alias="API_PORT")
    api_reload: bool = Field(True, alias="API_RELOAD")
    api_public_base_url: str = Field("", alias="API_PUBLIC_BASE_URL")

    dashboard_service_name: str = Field("frontend", alias="DASHBOARD_SERVICE_NAME")
    dashboard_workdir: str = Field("frontend", alias="DASHBOARD_WORKDIR")
    dashboard_host: str = Field("0.0.0.0", alias="DASHBOARD_HOST")
    dashboard_port: int = Field(3000, alias="DASHBOARD_PORT")
    dashboard_public_url: str = Field("", alias="DASHBOARD_PUBLIC_URL")

    app_secret_key: str = Field("change-this-secret-key", alias="APP_SECRET_KEY")
    access_token_expiry_minutes: int = Field(120, alias="ACCESS_TOKEN_EXPIRY_MINUTES")

    midtrans_server_key: str = Field("", alias="MIDTRANS_SERVER_KEY")
    midtrans_client_key: str = Field("", alias="MIDTRANS_CLIENT_KEY")
    midtrans_is_production: bool = Field(False, alias="MIDTRANS_IS_PRODUCTION")
    midtrans_sandbox_server_key: str = Field("", alias="MIDTRANS_SANDBOX_SERVER_KEY")
    midtrans_sandbox_client_key: str = Field("", alias="MIDTRANS_SANDBOX_CLIENT_KEY")
    midtrans_production_server_key: str = Field("", alias="MIDTRANS_PRODUCTION_SERVER_KEY")
    midtrans_production_client_key: str = Field("", alias="MIDTRANS_PRODUCTION_CLIENT_KEY")

    supabase_url: str = Field("", alias="SUPABASE_URL")
    supabase_service_role_key: str = Field("", alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_anon_key: str = Field("", alias="SUPABASE_ANON_KEY")

    admin_email: str = Field("", alias="ADMIN_EMAIL")
    admin_password: str = Field("", alias="ADMIN_PASSWORD")
    admin_name: str = Field("Administrator", alias="ADMIN_NAME")

    cors_origins: str = Field(
        "http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ORIGINS",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def midtrans_base_url(self) -> str:
        if self.midtrans_is_production:
            return "https://api.midtrans.com/v2"
        return "https://api.sandbox.midtrans.com/v2"

    def default_midtrans_mode(self) -> str:
        return "production" if self.midtrans_is_production else "sandbox"

    def midtrans_credentials(self, requested_mode: str | None = None) -> tuple[str, str, str]:
        mode = (requested_mode or self.default_midtrans_mode()).strip().lower()
        if mode not in {"sandbox", "production"}:
            mode = self.default_midtrans_mode()

        if mode == "sandbox":
            server_key = self.midtrans_sandbox_server_key or (
                self.midtrans_server_key if not self.midtrans_is_production else ""
            )
            client_key = self.midtrans_sandbox_client_key or (
                self.midtrans_client_key if not self.midtrans_is_production else ""
            )
            return server_key, client_key, "https://api.sandbox.midtrans.com/v2"

        server_key = self.midtrans_production_server_key or (
            self.midtrans_server_key if self.midtrans_is_production else ""
        )
        client_key = self.midtrans_production_client_key or (
            self.midtrans_client_key if self.midtrans_is_production else ""
        )
        return server_key, client_key, "https://api.midtrans.com/v2"

    def available_midtrans_modes(self) -> list[str]:
        modes: list[str] = []
        for mode in ("sandbox", "production"):
            server_key, client_key, _ = self.midtrans_credentials(mode)
            if server_key and client_key:
                modes.append(mode)
        return modes

    @property
    def resolved_api_public_base_url(self) -> str:
        if self.api_public_base_url.strip():
            return self.api_public_base_url.strip()
        return f"http://127.0.0.1:{self.api_port}"

    @property
    def resolved_dashboard_public_url(self) -> str:
        if self.dashboard_public_url.strip():
            return self.dashboard_public_url.strip()
        return f"http://127.0.0.1:{self.dashboard_port}"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip():
            origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        else:
            origins = [
                self.resolved_dashboard_public_url,
                f"http://localhost:{self.dashboard_port}",
                f"http://127.0.0.1:{self.dashboard_port}",
            ]
        seen: set[str] = set()
        unique: list[str] = []
        for origin in origins:
            if origin not in seen:
                seen.add(origin)
                unique.append(origin)
        return unique


@lru_cache
def get_settings() -> Settings:
    return Settings()
