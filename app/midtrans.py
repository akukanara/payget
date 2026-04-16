import base64
import hashlib
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.config import Settings


class MidtransClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        token = base64.b64encode(f"{settings.midtrans_server_key}:".encode("utf-8")).decode("utf-8")
        self.headers = {
            "Accept": "application/json",
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
        }

    def ensure_configured(self) -> None:
        if not self.settings.midtrans_server_key or not self.settings.midtrans_client_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY belum dikonfigurasi.",
            )

    async def _request(self, method: str, path: str, json: dict[str, Any] | None = None) -> dict[str, Any]:
        self.ensure_configured()
        url = f"{self.settings.midtrans_base_url}{path}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.request(method=method, url=url, headers=self.headers, json=json)
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

    async def charge(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._request("POST", "/charge", json=payload)

    async def get_status(self, order_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/{order_id}/status")

    async def cancel(self, order_id: str) -> dict[str, Any]:
        return await self._request("POST", f"/{order_id}/cancel")

    def verify_notification_signature(
        self,
        order_id: str,
        status_code: str,
        gross_amount: str,
        signature_key: str,
    ) -> bool:
        self.ensure_configured()
        raw = f"{order_id}{status_code}{gross_amount}{self.settings.midtrans_server_key}"
        expected = hashlib.sha512(raw.encode("utf-8")).hexdigest()
        return expected == signature_key
