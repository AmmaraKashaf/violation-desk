"""All HTTP endpoints. Attribution rules live in attribution.py; this file only loads, saves and shapes data."""

from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from postgrest.exceptions import APIError

from app.attribution import NO_VEHICLE_REASON, attribute, format_time, normalize_plate
from app.config import ADMIN_FEE, OPERATOR_TZ
from app.db import get_db
from app.parsing import parse_notice
from app.samples import build_samples, today_local
from app.schemas import Attribution, Booking, NoticeText, ParsedNotice, ResolveRequest, Vehicle, Violation, ViolationCreate
from app.seed import reset_and_seed

router = APIRouter()

# Embeds the vehicle name and renter name alongside each violation row.
VIOLATION_SELECT = "*, vd_vehicles!vehicle_id(name), vd_bookings!booking_id(renter_name)"
STATUS_FOR_ACTION: dict[str, str] = {
    "charge_renter": "charged_renter",
    "operator_pays": "paid_by_operator",
    "dismiss": "dismissed",
}
UNIQUE_VIOLATION = "23505"  # Postgres error code


def draft_message(renter_name: str, row: dict[str, Any], vehicle_name: str, total: float) -> str:
    """Plain template, no AI. The operator reads it before anything is sent."""
    when = format_time(datetime.fromisoformat(row["occurred_at"]))
    return (
        f"Hi {renter_name}, we received a {row['violation'].lower()} notice for the {vehicle_name} "
        f"you rented. It was issued on {when} at {row['location']}, during your trip. "
        f"As set out in the rental agreement, we will charge the ${float(row['amount']):.2f} fine "
        f"plus a ${ADMIN_FEE:.2f} admin fee (${total:.2f} total) to your card on file. "
        f"Reply to this message if you have any questions."
    )


def to_violation(row: dict[str, Any]) -> Violation:
    """Add the computed fields the UI needs to a stored row."""
    vehicle_name = (row.pop("vd_vehicles", None) or {}).get("name")
    renter_name = (row.pop("vd_bookings", None) or {}).get("renter_name")
    liable = row["decision"] == "renter_liable"
    total = float(row["amount"]) + ADMIN_FEE if liable else None
    days_left = (date.fromisoformat(row["respond_by"]) - today_local()).days
    return Violation(
        **row,
        days_left=days_left,
        charge_total=total,
        message_draft=draft_message(renter_name, row, vehicle_name, total) if liable and total else None,
        renter_name=renter_name,
        vehicle_name=vehicle_name,
    )


def fetch_violation(violation_id: str) -> dict[str, Any]:
    rows = get_db().table("vd_violations").select(VIOLATION_SELECT).eq("id", violation_id).execute().data
    if not rows:
        raise HTTPException(404, "Violation not found.")
    return rows[0]


def find_vehicle(plate: str) -> dict[str, Any] | None:
    # The fleet is small, so compare normalised plates in Python rather than in SQL.
    vehicles = get_db().table("vd_vehicles").select("*").execute().data
    return next((v for v in vehicles if normalize_plate(v["plate"]) == normalize_plate(plate)), None)


def load_bookings(vehicle_id: str) -> list[Booking]:
    rows = get_db().table("vd_bookings").select("*").eq("vehicle_id", vehicle_id).order("start_at").execute().data
    return [Booking(**row) for row in rows]


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/samples")
def samples() -> list[dict[str, str]]:
    return build_samples()


@router.post("/notices/parse")
def parse(body: NoticeText) -> ParsedNotice:
    parsed = parse_notice(body.text)
    if parsed.missing:
        # Send back what was read too, so the operator only fills in the gaps.
        raise HTTPException(422, {
            "message": f"Could not read: {', '.join(parsed.missing)}. Fill them in by hand.",
            "missing": parsed.missing,
            "parsed": parsed.model_dump(mode="json"),
        })
    return parsed


@router.post("/violations", status_code=201)
def create_violation(body: ViolationCreate) -> Violation:
    occurred_at = body.occurred_local.replace(tzinfo=OPERATOR_TZ).astimezone(UTC)
    vehicle = find_vehicle(body.plate)
    if vehicle is None:
        result = Attribution(decision="no_vehicle", reason=NO_VEHICLE_REASON)
    else:
        result = attribute(occurred_at, load_bookings(vehicle["id"]))

    row = {
        "vehicle_id": vehicle["id"] if vehicle else None,
        "plate": vehicle["plate"] if vehicle else body.plate.strip().upper(),
        "violation": body.violation,
        "occurred_at": occurred_at.isoformat(),
        "location": body.location or "Unknown",
        "amount": body.amount,
        "notice_date": body.notice_date.isoformat(),
        "respond_by": body.respond_by.isoformat(),
        "raw_text": body.raw_text,
        "decision": result.decision,
        "reason": result.reason,
        "booking_id": result.booking_id,
        "late_return": result.late_return,
    }
    try:
        saved = get_db().table("vd_violations").insert(row).execute().data[0]
    except APIError as error:
        if error.code == UNIQUE_VIOLATION:
            raise HTTPException(409, "This ticket is already logged (same plate, time and amount).")
        raise
    return to_violation(fetch_violation(saved["id"]))


@router.get("/violations")
def list_violations() -> list[Violation]:
    rows = get_db().table("vd_violations").select(VIOLATION_SELECT).order("respond_by").order("created_at").execute().data
    return [to_violation(row) for row in rows]


@router.post("/violations/{violation_id}/resolve")
def resolve_violation(violation_id: UUID, body: ResolveRequest) -> Violation:
    row = fetch_violation(str(violation_id))
    if row["status"] != "open":
        raise HTTPException(409, "This violation is already resolved.")
    # Never charge a renter for a ticket the rules did not pin on them.
    if body.action == "charge_renter" and row["decision"] != "renter_liable":
        raise HTTPException(409, "Only a renter-liable ticket can be charged to the renter.")

    # Payments are mocked: we only record the outcome.
    get_db().table("vd_violations").update({"status": STATUS_FOR_ACTION[body.action]}).eq("id", row["id"]).execute()
    return to_violation(fetch_violation(row["id"]))


@router.get("/vehicles")
def list_vehicles() -> list[Vehicle]:
    rows = get_db().table("vd_vehicles").select("*, vd_bookings(*)").order("name").execute().data
    vehicles: list[Vehicle] = []
    for row in rows:
        bookings = sorted((Booking(**b) for b in row.pop("vd_bookings")), key=lambda b: b.start_at)
        vehicles.append(Vehicle(**row, bookings=bookings))
    return vehicles


@router.post("/demo/reset")
def demo_reset() -> dict[str, int]:
    return reset_and_seed()
