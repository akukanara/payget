from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Midtrans Payment API"
    app_version: str = "2.0.0"
    app_description: str = "Backend payment menggunakan FastAPI, Midtrans Core API, auth terpisah, dan Supabase."

    app_secret_key: str = Field("change-this-secret-key", alias="APP_SECRET_KEY")
    access_token_expiry_minutes: int = Field(120, alias="ACCESS_TOKEN_EXPIRY_MINUTES")

    midtrans_server_key: str = Field("", alias="MIDTRANS_SERVER_KEY")
    midtrans_client_key: str = Field("", alias="MIDTRANS_CLIENT_KEY")
    midtrans_is_production: bool = Field(False, alias="MIDTRANS_IS_PRODUCTION")

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

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
