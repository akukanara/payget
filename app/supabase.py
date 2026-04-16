from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status

from app.config import Settings


class SupabaseClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.base_url = settings.supabase_url.rstrip("/")
        self.headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def ensure_configured(self) -> None:
        if not self.settings.supabase_url or not self.settings.supabase_service_role_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.",
            )

    async def request(
        self,
        method: str,
        path: str,
        *,
        query: dict[str, str] | None = None,
        json: Any = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        self.ensure_configured()
        url = f"{self.base_url}{path}"
        if query:
            url = f"{url}?{urlencode(query)}"
        request_headers = self.headers.copy()
        if headers:
            request_headers.update(headers)

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.request(method, url, headers=request_headers, json=json)
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Gagal menghubungi Supabase: {exc}",
                ) from exc

        if response.status_code == 204:
            return None

        try:
            payload = response.json()
        except ValueError:
            payload = response.text

        if response.is_success:
            return payload

        detail = payload
        if isinstance(payload, dict):
            detail = payload.get("message") or payload.get("hint") or payload
        raise HTTPException(status_code=response.status_code, detail=detail)

    async def select(
        self,
        table: str,
        *,
        filters: dict[str, str] | None = None,
        columns: str = "*",
        order: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        query = {"select": columns}
        if filters:
            query.update(filters)
        if order:
            query["order"] = order
        if limit is not None:
            query["limit"] = str(limit)
        result = await self.request("GET", f"/rest/v1/{table}", query=query)
        return result or []

    async def insert(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        result = await self.request(
            "POST",
            f"/rest/v1/{table}",
            json=payload,
            headers={"Prefer": "return=representation"},
        )
        if not result:
            raise HTTPException(status_code=500, detail=f"Gagal insert data ke tabel {table}.")
        return result[0]

    async def update(
        self,
        table: str,
        payload: dict[str, Any],
        *,
        filters: dict[str, str],
    ) -> dict[str, Any] | None:
        result = await self.request(
            "PATCH",
            f"/rest/v1/{table}",
            query=filters,
            json=payload,
            headers={"Prefer": "return=representation"},
        )
        return result[0] if result else None

    async def delete(
        self,
        table: str,
        *,
        filters: dict[str, str],
    ) -> dict[str, Any] | None:
        result = await self.request(
            "DELETE",
            f"/rest/v1/{table}",
            query=filters,
            headers={"Prefer": "return=representation"},
        )
        return result[0] if result else None
