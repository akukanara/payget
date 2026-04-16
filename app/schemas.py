from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str
    version: str


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=3)
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: str
    password: str


class ApiKeyResponse(BaseModel):
    api_key: str
    api_key_prefix: str


class ApiKeyAdminItem(BaseModel):
    id: str
    user_id: str
    key_prefix: str
    is_active: bool
    created_at: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict[str, Any]


class UserProfileResponse(BaseModel):
    id: str
    full_name: str
    email: str
    is_admin: bool
    is_approved: bool
    api_key_prefixes: list[str]


class UserListItem(BaseModel):
    id: str
    full_name: str
    email: str
    is_admin: bool
    is_approved: bool
    created_at: str | None = None


class AdminCreateUserRequest(BaseModel):
    full_name: str = Field(..., min_length=3)
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=8)
    is_admin: bool = False


class AdminUpdateUserRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=3)
    email: str | None = Field(default=None, min_length=5)
    password: str | None = Field(default=None, min_length=8)
    is_admin: bool | None = None


class AdminCreateApiKeyRequest(BaseModel):
    is_active: bool = True


class AdminUserDetailResponse(BaseModel):
    user: UserListItem
    api_keys: list[ApiKeyAdminItem]


class TransactionDetails(BaseModel):
    order_id: str = Field(..., description="ID unik transaksi/order.")
    gross_amount: int = Field(..., gt=0, description="Total nominal transaksi.")


class ChargeRequest(BaseModel):
    payment_type: str = Field(..., description="Tipe pembayaran Midtrans, misalnya bank_transfer/qris/gopay.")
    transaction_details: TransactionDetails
    customer_details: dict[str, Any] | None = None
    item_details: list[dict[str, Any]] | None = None

    model_config = ConfigDict(
        extra="allow",
        json_schema_extra={
            "example": {
                "payment_type": "bank_transfer",
                "transaction_details": {
                    "order_id": "ORDER-12345",
                    "gross_amount": 150000,
                },
                "customer_details": {
                    "first_name": "Budi",
                    "email": "budi@example.com",
                    "phone": "08123456789",
                },
                "item_details": [
                    {
                        "id": "SKU-001",
                        "price": 150000,
                        "quantity": 1,
                        "name": "Produk Demo",
                    }
                ],
                "bank_transfer": {
                    "bank": "bca",
                },
            }
        },
    )


class MidtransResponse(BaseModel):
    status_code: str | None = None
    status_message: str | None = None
    transaction_id: str | None = None
    order_id: str | None = None
    transaction_status: str | None = None
    payment_type: str | None = None
    va_numbers: list[dict[str, Any]] | None = None
    actions: list[dict[str, Any]] | None = None
    fraud_status: str | None = None
    raw_response: dict[str, Any]


class TransactionRecord(BaseModel):
    id: str | None = None
    order_id: str
    gross_amount: int | float | str
    payment_type: str | None = None
    transaction_status: str | None = None
    transaction_id: str | None = None
    user_id: str | None = None
    customer_email: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    raw_response: dict[str, Any] | None = None


class NotificationPayload(BaseModel):
    transaction_time: str | None = None
    transaction_status: str
    transaction_id: str
    status_message: str | None = None
    status_code: str
    signature_key: str
    payment_type: str | None = None
    order_id: str
    merchant_id: str | None = None
    gross_amount: str
    fraud_status: str | None = None
    currency: str | None = None

    model_config = ConfigDict(extra="allow")


class NotificationResponse(BaseModel):
    valid_signature: bool
    order_id: str
    transaction_status: str
    payment_type: str | None = None
    raw_payload: dict[str, Any]


class DashboardSummary(BaseModel):
    total_transactions: int
    pending_transactions: int
    settled_transactions: int
    total_amount: float


class AdminDashboardResponse(BaseModel):
    summary: DashboardSummary
    recent_transactions: list[TransactionRecord]
    users: list[UserListItem]
