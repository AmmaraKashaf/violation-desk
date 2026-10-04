"""Pydantic request/response models. Simple field guards (section 7) live here so FastAPI returns 422."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.config import MAX_FINE, MAX_NOTICE_CHARS, OPERATOR_TZ

Decision = Literal["renter_liable", "operator_liable", "needs_review", "no_vehicle"]
BookingStatus = Literal["upcoming", "active", "completed", "cancelled"]
ViolationStatus = Literal["open", "charged_renter", "paid_by_operator", "dismissed"]


class NoticeText(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_NOTICE_CHARS)


class ParsedNotice(BaseModel):
    """What parse_notice() could read. Fields it could not read stay None and are listed in `missing`."""

    plate: str | None = None
    violation: str | None = None
    occurred_local: datetime | None = None  # naive, operator's local time
    location: str = "Unknown"
    amount: float | None = None
    notice_date: date | None = None
    respond_by: date | None = None
    missing: list[str] = []


class ViolationCreate(BaseModel):
    """The fields the operator confirmed in the form."""

    plate: str = Field(min_length=1)
    violation: str = Field(min_length=1)
    occurred_local: datetime  # operator's local time, no timezone
    location: str = "Unknown"
    amount: float = Field(gt=0, le=MAX_FINE)
    notice_date: date
    respond_by: date
    raw_text: str | None = Field(default=None, max_length=MAX_NOTICE_CHARS)

    @model_validator(mode="after")
    def check_dates(self) -> "ViolationCreate":
        occurred_at = self.occurred_local.replace(tzinfo=OPERATOR_TZ)
        if occurred_at > datetime.now(OPERATOR_TZ):
            raise ValueError("The violation time is in the future.")
        if self.notice_date < occurred_at.date():
            raise ValueError("The notice date is before the violation date.")
        if self.respond_by < self.notice_date:
            raise ValueError("The respond-by date is before the notice date.")
        return self


class Booking(BaseModel):
    id: str
    vehicle_id: str
    renter_name: str
    start_at: datetime
    end_at: datetime  # scheduled return
    actual_return_at: datetime | None = None
    status: BookingStatus


class Attribution(BaseModel):
    decision: Decision
    reason: str
    booking_id: str | None = None
    renter_name: str | None = None
    late_return: bool = False


class ResolveRequest(BaseModel):
    action: Literal["charge_renter", "operator_pays", "dismiss"]


class Violation(BaseModel):
    """A saved violation plus the computed fields the UI needs."""

    id: str
    vehicle_id: str | None
    plate: str
    violation: str
    occurred_at: datetime
    location: str
    amount: float
    notice_date: date
    respond_by: date
    raw_text: str | None
    decision: Decision
    reason: str
    booking_id: str | None
    late_return: bool
    status: ViolationStatus
    created_at: datetime
    days_left: int
    charge_total: float | None
    message_draft: str | None
    renter_name: str | None
    vehicle_name: str | None


class Vehicle(BaseModel):
    id: str
    name: str
    plate: str
    bookings: list[Booking]
