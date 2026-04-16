from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.midtrans import MidtransClient
from app.schemas import (
    AdminDashboardResponse,
    AdminCreateApiKeyRequest,
    AdminCreateUserRequest,
    AdminUpdateUserRequest,
    AdminUserDetailResponse,
    ApiKeyAdminItem,
    ApiKeyResponse,
    AuthResponse,
    ChargeRequest,
    DashboardSummary,
    HealthResponse,
    LoginRequest,
    MidtransResponse,
    NotificationPayload,
    NotificationResponse,
    RegisterRequest,
    TransactionRecord,
    UserListItem,
    UserProfileResponse,
)
from app.security import create_access_token, generate_api_key, hash_secret, verify_secret
from app.supabase import SupabaseClient


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sanitize_user(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record["id"],
        "full_name": record["full_name"],
        "email": record["email"],
        "is_admin": record["is_admin"],
        "is_approved": record.get("is_approved", False),
        "created_at": record.get("created_at"),
    }


def sanitize_api_key(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record["id"],
        "user_id": record["user_id"],
        "key_prefix": record["key_prefix"],
        "is_active": record["is_active"],
        "created_at": record.get("created_at"),
    }


class TokenManager:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def issue(self, user: dict[str, Any]) -> str:
        return create_access_token(
            {
                "sub": user["id"],
                "email": user["email"],
                "is_admin": user["is_admin"],
            },
            self.settings.app_secret_key,
            self.settings.access_token_expiry_minutes,
        )

    def decode(self, token: str) -> dict[str, Any]:
        from app.security import decode_access_token

        return decode_access_token(token, self.settings.app_secret_key)


async def get_supabase(settings: Settings = Depends(get_settings)) -> SupabaseClient:
    return SupabaseClient(settings)


async def get_midtrans(settings: Settings = Depends(get_settings)) -> MidtransClient:
    return MidtransClient(settings)


async def bootstrap_admin(settings: Settings) -> None:
    if not settings.admin_email or not settings.admin_password:
        return
    supabase = SupabaseClient(settings)
    try:
        existing = await supabase.select(
            "app_users",
            filters={"email": f"eq.{settings.admin_email}"},
            limit=1,
        )
    except HTTPException:
        return
    if existing:
        return
    await supabase.insert(
        "app_users",
        {
            "full_name": settings.admin_name,
            "email": settings.admin_email,
            "password_hash": hash_secret(settings.admin_password),
            "is_admin": True,
            "is_approved": True,
        },
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    await bootstrap_admin(settings)
    yield


app = FastAPI(
    title="Midtrans Payment API",
    version="2.0.0",
    description="Backend payment dengan Midtrans Core API, API key per user, auth/admin terpisah, dan dashboard data.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def get_user_by_email(supabase: SupabaseClient, email: str) -> dict[str, Any] | None:
    users = await supabase.select("app_users", filters={"email": f"eq.{email}"}, limit=1)
    return users[0] if users else None


async def get_user_by_id(supabase: SupabaseClient, user_id: str) -> dict[str, Any] | None:
    users = await supabase.select("app_users", filters={"id": f"eq.{user_id}"}, limit=1)
    return users[0] if users else None


async def get_api_key_prefixes(supabase: SupabaseClient, user_id: str) -> list[str]:
    keys = await supabase.select(
        "api_keys",
        filters={"user_id": f"eq.{user_id}", "is_active": "eq.true"},
        columns="key_prefix",
    )
    return [row["key_prefix"] for row in keys]


async def authenticate_user(email: str, password: str, supabase: SupabaseClient) -> dict[str, Any]:
    user = await get_user_by_email(supabase, email)
    if not user or not verify_secret(password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email atau password salah.")
    if not user.get("is_admin") and not user.get("is_approved", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun masih menunggu verifikasi admin.",
        )
    return user


async def require_bearer_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    supabase: SupabaseClient = Depends(get_supabase),
) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token wajib dikirim.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = TokenManager(settings).decode(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = await get_user_by_id(supabase, payload["sub"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User tidak ditemukan.")
    return user


async def require_admin(
    user: dict[str, Any] = Depends(require_bearer_user),
) -> dict[str, Any]:
    if not user["is_admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akses admin diperlukan.")
    return user


async def require_api_key_user(
    x_api_key: str | None = Header(default=None),
    supabase: SupabaseClient = Depends(get_supabase),
) -> dict[str, Any]:
    if not x_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Header X-API-Key wajib dikirim.")
    key_prefix = x_api_key[:16]
    key_rows = await supabase.select(
        "api_keys",
        filters={"key_prefix": f"eq.{key_prefix}", "is_active": "eq.true"},
        limit=1,
    )
    if not key_rows:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key tidak valid.")
    key_row = key_rows[0]
    if not verify_secret(x_api_key, key_row["key_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key tidak valid.")
    user = await get_user_by_id(supabase, key_row["user_id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User API key tidak ditemukan.")
    if not user.get("is_approved", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User belum diverifikasi admin.")
    return user


def to_midtrans_response(payload: dict[str, Any]) -> MidtransResponse:
    return MidtransResponse(
        status_code=payload.get("status_code"),
        status_message=payload.get("status_message"),
        transaction_id=payload.get("transaction_id"),
        order_id=payload.get("order_id"),
        transaction_status=payload.get("transaction_status"),
        payment_type=payload.get("payment_type"),
        va_numbers=payload.get("va_numbers"),
        actions=payload.get("actions"),
        fraud_status=payload.get("fraud_status"),
        raw_response=payload,
    )


def summarize_transactions(rows: list[dict[str, Any]]) -> DashboardSummary:
    total_amount = 0.0
    pending = 0
    settled = 0
    for row in rows:
        try:
            total_amount += float(row.get("gross_amount") or 0)
        except (TypeError, ValueError):
            pass
        status_value = (row.get("transaction_status") or "").lower()
        if status_value in {"pending", "authorize"}:
            pending += 1
        if status_value in {"settlement", "capture", "paid"}:
            settled += 1
    return DashboardSummary(
        total_transactions=len(rows),
        pending_transactions=pending,
        settled_transactions=settled,
        total_amount=total_amount,
    )


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(service=settings.app_name, version=settings.app_version)


@app.post("/api/auth/register", response_model=ApiKeyResponse, tags=["Auth"])
async def register_user(
    request: RegisterRequest,
    supabase: SupabaseClient = Depends(get_supabase),
) -> ApiKeyResponse:
    existing = await get_user_by_email(supabase, request.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email sudah terdaftar.")

    user = await supabase.insert(
        "app_users",
        {
            "full_name": request.full_name,
            "email": request.email,
            "password_hash": hash_secret(request.password),
            "is_admin": False,
            "is_approved": False,
        },
    )

    api_key, prefix = generate_api_key()
    await supabase.insert(
        "api_keys",
        {
            "user_id": user["id"],
            "key_prefix": prefix,
            "key_hash": hash_secret(api_key),
            "is_active": True,
            "created_at": utc_iso(),
        },
    )
    return ApiKeyResponse(api_key=api_key, api_key_prefix=prefix)


@app.post("/api/auth/login", response_model=AuthResponse, tags=["Auth"])
async def login_user(
    request: LoginRequest,
    settings: Settings = Depends(get_settings),
    supabase: SupabaseClient = Depends(get_supabase),
) -> AuthResponse:
    user = await authenticate_user(request.email, request.password, supabase)
    token = TokenManager(settings).issue(user)
    return AuthResponse(access_token=token, user=sanitize_user(user))


@app.post("/api/admin/auth/login", response_model=AuthResponse, tags=["Admin Auth"])
async def login_admin(
    request: LoginRequest,
    settings: Settings = Depends(get_settings),
    supabase: SupabaseClient = Depends(get_supabase),
) -> AuthResponse:
    user = await authenticate_user(request.email, request.password, supabase)
    if not user["is_admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User ini bukan admin.")
    token = TokenManager(settings).issue(user)
    return AuthResponse(access_token=token, user=sanitize_user(user))


@app.get("/api/auth/me", response_model=UserProfileResponse, tags=["Auth"])
async def get_profile(
    user: dict[str, Any] = Depends(require_bearer_user),
    supabase: SupabaseClient = Depends(get_supabase),
) -> UserProfileResponse:
    prefixes = await get_api_key_prefixes(supabase, user["id"])
    return UserProfileResponse(
        id=user["id"],
        full_name=user["full_name"],
        email=user["email"],
        is_admin=user["is_admin"],
        is_approved=user.get("is_approved", False),
        api_key_prefixes=prefixes,
    )


@app.post("/api/auth/api-keys/rotate", response_model=ApiKeyResponse, tags=["Auth"])
async def rotate_api_key(
    user: dict[str, Any] = Depends(require_bearer_user),
    supabase: SupabaseClient = Depends(get_supabase),
) -> ApiKeyResponse:
    active_keys = await supabase.select(
        "api_keys",
        filters={"user_id": f"eq.{user['id']}", "is_active": "eq.true"},
    )
    for key in active_keys:
        await supabase.update(
            "api_keys",
            {"is_active": False},
            filters={"id": f"eq.{key['id']}"},
        )
    api_key, prefix = generate_api_key()
    await supabase.insert(
        "api_keys",
        {
            "user_id": user["id"],
            "key_prefix": prefix,
            "key_hash": hash_secret(api_key),
            "is_active": True,
            "created_at": utc_iso(),
        },
    )
    return ApiKeyResponse(api_key=api_key, api_key_prefix=prefix)


@app.post("/api/payments/charge", response_model=MidtransResponse, tags=["Payments"])
async def create_charge(
    request: ChargeRequest,
    user: dict[str, Any] = Depends(require_api_key_user),
    supabase: SupabaseClient = Depends(get_supabase),
    midtrans: MidtransClient = Depends(get_midtrans),
) -> MidtransResponse:
    payload = request.model_dump(exclude_none=True)
    response = await midtrans.charge(payload)
    transaction = {
        "user_id": user["id"],
        "order_id": payload["transaction_details"]["order_id"],
        "gross_amount": payload["transaction_details"]["gross_amount"],
        "payment_type": response.get("payment_type") or request.payment_type,
        "transaction_status": response.get("transaction_status"),
        "transaction_id": response.get("transaction_id"),
        "customer_email": (payload.get("customer_details") or {}).get("email"),
        "raw_response": response,
        "updated_at": utc_iso(),
    }
    await supabase.insert("transactions", transaction)
    return to_midtrans_response(response)


@app.get("/api/payments/{order_id}/status", response_model=MidtransResponse, tags=["Payments"])
async def get_payment_status(
    order_id: str,
    user: dict[str, Any] = Depends(require_api_key_user),
    supabase: SupabaseClient = Depends(get_supabase),
    midtrans: MidtransClient = Depends(get_midtrans),
) -> MidtransResponse:
    response = await midtrans.get_status(order_id)
    await supabase.update(
        "transactions",
        {
            "transaction_status": response.get("transaction_status"),
            "transaction_id": response.get("transaction_id"),
            "payment_type": response.get("payment_type"),
            "raw_response": response,
            "updated_at": utc_iso(),
        },
        filters={"order_id": f"eq.{order_id}", "user_id": f"eq.{user['id']}"},
    )
    return to_midtrans_response(response)


@app.post("/api/payments/{order_id}/cancel", response_model=MidtransResponse, tags=["Payments"])
async def cancel_payment(
    order_id: str,
    user: dict[str, Any] = Depends(require_api_key_user),
    supabase: SupabaseClient = Depends(get_supabase),
    midtrans: MidtransClient = Depends(get_midtrans),
) -> MidtransResponse:
    response = await midtrans.cancel(order_id)
    await supabase.update(
        "transactions",
        {
            "transaction_status": response.get("transaction_status"),
            "raw_response": response,
            "updated_at": utc_iso(),
        },
        filters={"order_id": f"eq.{order_id}", "user_id": f"eq.{user['id']}"},
    )
    return to_midtrans_response(response)


@app.get("/api/user/transactions", response_model=list[TransactionRecord], tags=["User Dashboard"])
async def list_user_transactions(
    user: dict[str, Any] = Depends(require_bearer_user),
    supabase: SupabaseClient = Depends(get_supabase),
) -> list[TransactionRecord]:
    rows = await supabase.select(
        "transactions",
        filters={"user_id": f"eq.{user['id']}"},
        order="created_at.desc",
    )
    return [TransactionRecord(**row) for row in rows]


@app.get("/api/user/dashboard/summary", response_model=DashboardSummary, tags=["User Dashboard"])
async def user_dashboard_summary(
    user: dict[str, Any] = Depends(require_bearer_user),
    supabase: SupabaseClient = Depends(get_supabase),
) -> DashboardSummary:
    rows = await supabase.select("transactions", filters={"user_id": f"eq.{user['id']}"})
    return summarize_transactions(rows)


@app.get("/api/admin/users", response_model=list[UserListItem], tags=["Admin"])
async def admin_list_users(
    _: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> list[UserListItem]:
    rows = await supabase.select("app_users", order="created_at.desc")
    return [UserListItem(**sanitize_user(row)) for row in rows]


@app.post("/api/admin/users", response_model=UserListItem, tags=["Admin"])
async def admin_create_user(
    request: AdminCreateUserRequest,
    _: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> UserListItem:
    existing = await get_user_by_email(supabase, request.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email sudah terdaftar.")
    user = await supabase.insert(
        "app_users",
        {
            "full_name": request.full_name,
            "email": request.email,
            "password_hash": hash_secret(request.password),
            "is_admin": request.is_admin,
            "is_approved": True,
        },
    )
    return UserListItem(**sanitize_user(user))


@app.get("/api/admin/users/{user_id}", response_model=AdminUserDetailResponse, tags=["Admin"])
async def admin_get_user_detail(
    user_id: str,
    _: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> AdminUserDetailResponse:
    user = await get_user_by_id(supabase, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan.")
    api_keys = await supabase.select("api_keys", filters={"user_id": f"eq.{user_id}"}, order="created_at.desc")
    return AdminUserDetailResponse(
        user=UserListItem(**sanitize_user(user)),
        api_keys=[ApiKeyAdminItem(**sanitize_api_key(row)) for row in api_keys],
    )


@app.patch("/api/admin/users/{user_id}", response_model=UserListItem, tags=["Admin"])
async def admin_update_user(
    user_id: str,
    request: AdminUpdateUserRequest,
    _: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> UserListItem:
    current = await get_user_by_id(supabase, user_id)
    if not current:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan.")
    payload = request.model_dump(exclude_none=True)
    if "email" in payload and payload["email"] != current["email"]:
        existing = await get_user_by_email(supabase, payload["email"])
        if existing and existing["id"] != user_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email sudah dipakai user lain.")
    if "password" in payload:
        payload["password_hash"] = hash_secret(payload.pop("password"))
    updated = await supabase.update("app_users", payload, filters={"id": f"eq.{user_id}"})
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan.")
    return UserListItem(**sanitize_user(updated))


@app.post("/api/admin/users/{user_id}/approve", response_model=UserListItem, tags=["Admin"])
async def admin_approve_user(
    user_id: str,
    _: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> UserListItem:
    updated = await supabase.update("app_users", {"is_approved": True}, filters={"id": f"eq.{user_id}"})
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan.")
    return UserListItem(**sanitize_user(updated))


@app.post("/api/admin/users/{user_id}/reject", response_model=UserListItem, tags=["Admin"])
async def admin_reject_user(
    user_id: str,
    _: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> UserListItem:
    updated = await supabase.update("app_users", {"is_approved": False}, filters={"id": f"eq.{user_id}"})
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan.")
    return UserListItem(**sanitize_user(updated))


@app.delete("/api/admin/users/{user_id}", response_model=UserListItem, tags=["Admin"])
async def admin_delete_user(
    user_id: str,
    admin_user: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> UserListItem:
    if admin_user["id"] == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin tidak bisa menghapus dirinya sendiri.")
    deleted = await supabase.delete("app_users", filters={"id": f"eq.{user_id}"})
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan.")
    return UserListItem(**sanitize_user(deleted))


@app.get("/api/admin/users/{user_id}/api-keys", response_model=list[ApiKeyAdminItem], tags=["Admin"])
async def admin_list_api_keys(
    user_id: str,
    _: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> list[ApiKeyAdminItem]:
    keys = await supabase.select("api_keys", filters={"user_id": f"eq.{user_id}"}, order="created_at.desc")
    return [ApiKeyAdminItem(**sanitize_api_key(row)) for row in keys]


@app.post("/api/admin/users/{user_id}/api-keys", response_model=ApiKeyResponse, tags=["Admin"])
async def admin_create_api_key(
    user_id: str,
    request: AdminCreateApiKeyRequest,
    _: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> ApiKeyResponse:
    user = await get_user_by_id(supabase, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan.")
    api_key, prefix = generate_api_key()
    await supabase.insert(
        "api_keys",
        {
            "user_id": user_id,
            "key_prefix": prefix,
            "key_hash": hash_secret(api_key),
            "is_active": request.is_active,
            "created_at": utc_iso(),
        },
    )
    return ApiKeyResponse(api_key=api_key, api_key_prefix=prefix)


@app.patch("/api/admin/users/{user_id}/api-keys/{api_key_id}", response_model=ApiKeyAdminItem, tags=["Admin"])
async def admin_update_api_key(
    user_id: str,
    api_key_id: str,
    request: AdminCreateApiKeyRequest,
    _: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> ApiKeyAdminItem:
    updated = await supabase.update(
        "api_keys",
        {"is_active": request.is_active},
        filters={"id": f"eq.{api_key_id}", "user_id": f"eq.{user_id}"},
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key tidak ditemukan.")
    return ApiKeyAdminItem(**sanitize_api_key(updated))


@app.delete("/api/admin/users/{user_id}/api-keys/{api_key_id}", response_model=ApiKeyAdminItem, tags=["Admin"])
async def admin_delete_api_key(
    user_id: str,
    api_key_id: str,
    _: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> ApiKeyAdminItem:
    deleted = await supabase.delete(
        "api_keys",
        filters={"id": f"eq.{api_key_id}", "user_id": f"eq.{user_id}"},
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key tidak ditemukan.")
    return ApiKeyAdminItem(**sanitize_api_key(deleted))


@app.get("/api/admin/transactions", response_model=list[TransactionRecord], tags=["Admin"])
async def admin_list_transactions(
    _: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> list[TransactionRecord]:
    rows = await supabase.select("transactions", order="created_at.desc")
    return [TransactionRecord(**row) for row in rows]


@app.get("/api/admin/dashboard", response_model=AdminDashboardResponse, tags=["Admin"])
async def admin_dashboard(
    _: dict[str, Any] = Depends(require_admin),
    supabase: SupabaseClient = Depends(get_supabase),
) -> AdminDashboardResponse:
    users = await supabase.select("app_users", order="created_at.desc", limit=20)
    recent_transactions = await supabase.select("transactions", order="created_at.desc", limit=20)
    all_transactions = await supabase.select("transactions")
    return AdminDashboardResponse(
        summary=summarize_transactions(all_transactions),
        recent_transactions=[TransactionRecord(**row) for row in recent_transactions],
        users=[UserListItem(**sanitize_user(row)) for row in users],
    )


@app.post("/api/payments/notifications", response_model=NotificationResponse, tags=["Payments"])
async def handle_notification(
    payload: NotificationPayload,
    midtrans: MidtransClient = Depends(get_midtrans),
    supabase: SupabaseClient = Depends(get_supabase),
) -> NotificationResponse:
    is_valid = midtrans.verify_notification_signature(
        order_id=payload.order_id,
        status_code=payload.status_code,
        gross_amount=payload.gross_amount,
        signature_key=payload.signature_key,
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Signature notification Midtrans tidak valid.",
        )

    await supabase.update(
        "transactions",
        {
            "transaction_status": payload.transaction_status,
            "payment_type": payload.payment_type,
            "transaction_id": payload.transaction_id,
            "raw_response": payload.model_dump(),
            "updated_at": utc_iso(),
        },
        filters={"order_id": f"eq.{payload.order_id}"},
    )

    return NotificationResponse(
        valid_signature=True,
        order_id=payload.order_id,
        transaction_status=payload.transaction_status,
        payment_type=payload.payment_type,
        raw_payload=payload.model_dump(),
    )
