"""Decides who had the car when the ticket was issued. Pure, deterministic rules so the operator can audit them."""

from datetime import datetime, timedelta

from app.config import HANDOFF_MARGIN_MINUTES, OPERATOR_TZ
from app.schemas import Attribution, Booking

OPERATOR_LIABLE_REASON = (
    "No booking covers this time (the car was between rentals). "
    "Do not charge a renter. Check staff or personal use before paying."
)
NO_VEHICLE_REASON = (
    "This plate is not in your fleet. Check the plate, or whether the car was sold or replaced."
)


def normalize_plate(plate: str) -> str:
    """`ev 3001` and `EV-3001` are the same plate."""
    return plate.upper().replace(" ", "").replace("-", "")


def window_end(booking: Booking) -> datetime:
    # The actual return decides, not the scheduled one: a late renter still has the car.
    return booking.actual_return_at or booking.end_at


def covers(booking: Booking, occurred_at: datetime) -> bool:
    return booking.start_at <= occurred_at <= window_end(booking)


def format_time(moment: datetime) -> str:
    local = moment.astimezone(OPERATOR_TZ)
    return f"{local:%b} {local.day} {local:%H:%M}"


def format_clock(moment: datetime) -> str:
    return f"{moment.astimezone(OPERATOR_TZ):%H:%M}"


def renter_liable(booking: Booking, occurred_at: datetime) -> Attribution:
    late_return = occurred_at > booking.end_at
    if late_return:
        reason = (
            f"{booking.renter_name} was late: the trip was due back at {format_clock(booking.end_at)} "
            f"but the car actually came back at {format_clock(window_end(booking))}. "
            f"The ticket ({format_clock(occurred_at)}) falls in that gap, so {booking.renter_name} is responsible."
        )
    else:
        reason = (
            f"{booking.renter_name} had the car "
            f"({format_time(booking.start_at)} → {format_time(window_end(booking))})."
        )
    return Attribution(
        decision="renter_liable",
        reason=reason,
        booking_id=booking.id,
        renter_name=booking.renter_name,
        late_return=late_return,
    )


def overlapping(bookings: list[Booking]) -> Attribution:
    names = " and ".join(booking.renter_name for booking in bookings)
    return Attribution(
        decision="needs_review",
        reason=f"More than one booking covers this time ({names}). Fix the overlapping bookings before deciding.",
    )


def nearby_handoffs(occurred_at: datetime, bookings: list[Booking]) -> list[str]:
    """Describe every pickup or return within the handoff margin, earliest first.
    Only called when no window covers the time, so it is either before a start or after an end."""
    margin = timedelta(minutes=HANDOFF_MARGIN_MINUTES)
    edges: list[tuple[datetime, str]] = []
    for booking in bookings:
        start, end = booking.start_at, window_end(booking)
        if occurred_at < start <= occurred_at + margin:
            minutes = round((start - occurred_at).total_seconds() / 60)
            edges.append((start, f"{minutes} minutes before {booking.renter_name}'s trip began"))
        if end < occurred_at <= end + margin:
            minutes = round((occurred_at - end).total_seconds() / 60)
            edges.append((end, f"{minutes} minutes after {booking.renter_name}'s trip ended"))
    return [text for _, text in sorted(edges)]


def attribute(occurred_at: datetime, bookings: list[Booking]) -> Attribution:
    """Find the renter whose window (start to actual return) contains the ticket time."""
    live_bookings = [booking for booking in bookings if booking.status != "cancelled"]
    covering = [booking for booking in live_bookings if covers(booking, occurred_at)]

    if len(covering) == 1:
        return renter_liable(covering[0], occurred_at)
    if len(covering) > 1:
        return overlapping(covering)

    handoffs = nearby_handoffs(occurred_at, live_bookings)
    if handoffs:
        return Attribution(
            decision="needs_review",
            reason=f"This is {' and '.join(handoffs)}. Check the handoff before deciding.",
        )
    return Attribution(decision="operator_liable", reason=OPERATOR_LIABLE_REASON)
