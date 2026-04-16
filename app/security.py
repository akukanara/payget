import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def hash_secret(secret: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        secret.encode("utf-8"),
        salt.encode("utf-8"),
        200_000,
    ).hex()
    return f"{salt}${digest}"


def verify_secret(secret: str, hashed_value: str) -> bool:
    try:
        salt, current_digest = hashed_value.split("$", 1)
    except ValueError:
        return False
    new_digest = hashlib.pbkdf2_hmac(
        "sha256",
        secret.encode("utf-8"),
        salt.encode("utf-8"),
        200_000,
    ).hex()
    return hmac.compare_digest(current_digest, new_digest)


def generate_api_key() -> tuple[str, str]:
    raw = f"ak_{secrets.token_urlsafe(32)}"
    return raw, raw[:16]


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(f"{data}{padding}".encode("utf-8"))


def create_access_token(payload: dict[str, Any], secret_key: str, expiry_minutes: int) -> str:
    token_payload = payload.copy()
    token_payload["exp"] = int((utc_now() + timedelta(minutes=expiry_minutes)).timestamp())
    body = _b64encode(json.dumps(token_payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(secret_key.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def decode_access_token(token: str, secret_key: str) -> dict[str, Any]:
    try:
        body, signature = token.split(".", 1)
    except ValueError as exc:
        raise ValueError("Token format tidak valid.") from exc

    expected_signature = hmac.new(
        secret_key.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        raise ValueError("Signature token tidak valid.")

    payload = json.loads(_b64decode(body).decode("utf-8"))
    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(utc_now().timestamp()):
        raise ValueError("Token sudah expired.")
    return payload
