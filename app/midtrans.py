import base64
import hashlib
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import Settings


class MidtransClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
    
    def resolve_mode(self, requested_mode: str | None = None) -> str:
        mode = (requested_mode or self.settings.default_midtrans_mode()).strip().lower()
        if mode not in {"sandbox", "production"}:
            return self.settings.default_midtrans_mode()
        return mode

    def ensure_configured(self, requested_mode: str | None = None) -> tuple[str, dict[str, str]]:
        mode = self.resolve_mode(requested_mode)
        server_key, client_key, base_url = self.settings.midtrans_credentials(mode)
        if not server_key or not client_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Konfigurasi Midtrans untuk mode {mode} belum lengkap.",
            )
        token = base64.b64encode(f"{server_key}:".encode("utf-8")).decode("utf-8")
        return base_url, {
            "Accept": "application/json",
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        path: str,
        json: dict[str, Any] | None = None,
        mode: str | None = None,
    ) -> dict[str, Any]:
        base_url, headers = self.ensure_configured(mode)
        url = f"{base_url}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.request(method=method, url=url, headers=headers, json=json)
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Gagal menghubungi Midtrans: {exc}",
                ) from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Respons Midtrans tidak valid.",
            ) from exc

        if response.is_success:
            return payload

        detail = payload.get("status_message") or payload.get("error_messages") or "Midtrans error"
        raise HTTPException(status_code=response.status_code, detail=detail)

    async def charge(self, payload: dict[str, Any], mode: str | None = None) -> dict[str, Any]:
        return await self._request("POST", "/charge", json=payload, mode=mode)

    async def get_status(self, order_id: str, mode: str | None = None) -> dict[str, Any]:
        return await self._request("GET", f"/{order_id}/status", mode=mode)

    async def cancel(self, order_id: str, mode: str | None = None) -> dict[str, Any]:
        return await self._request("POST", f"/{order_id}/cancel", mode=mode)

    def verify_notification_signature(
        self,
        order_id: str,
        status_code: str,
        gross_amount: str,
        signature_key: str,
        mode: str | None = None,
    ) -> bool:
        resolved_mode = self.resolve_mode(mode)
        server_key, _, _ = self.settings.midtrans_credentials(resolved_mode)
        if not server_key:
            return False
        raw = f"{order_id}{status_code}{gross_amount}{server_key}"
        expected = hashlib.sha512(raw.encode("utf-8")).hexdigest()
        return expected == signature_key
