from datetime import datetime

from app.attribution import attribute, normalize_plate
from app.config import OPERATOR_TZ
from app.schemas import Booking, BookingStatus


def local(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 9, day, hour, minute, tzinfo=OPERATOR_TZ)


def booking(
    renter: str,
    start: datetime,
    end: datetime,
    actual_return: datetime | None = None,
    status: BookingStatus = "completed",
) -> Booking:
    return Booking(
        id=f"id-{renter}",
        vehicle_id="car-1",
        renter_name=renter,
        start_at=start,
        end_at=end,
        actual_return_at=actual_return,
        status=status,
    )


SARA = booking("Sara", local(10, 10), local(14, 10), actual_return=local(14, 13, 20))
OMAR = booking("Omar", local(16, 10), local(19, 10), actual_return=local(19, 9, 40))


def test_clean_match_is_renter_liable() -> None:
    result = attribute(local(12, 14, 12), [SARA, OMAR])
    assert result.decision == "renter_liable"
    assert result.renter_name == "Sara"
    assert result.booking_id == "id-Sara"
    assert result.late_return is False


def test_after_scheduled_but_before_actual_return_is_late_renter() -> None:
    result = attribute(local(14, 11, 47), [SARA, OMAR])
    assert result.decision == "renter_liable"
    assert result.renter_name == "Sara"
    assert result.late_return is True
    assert "10:00" in result.reason and "13:20" in result.reason and "11:47" in result.reason


def test_gap_between_rentals_is_operator_liable() -> None:
    result = attribute(local(15, 2, 15), [SARA, OMAR])
    assert result.decision == "operator_liable"
    assert result.renter_name is None


def test_cancelled_booking_covering_the_time_is_ignored() -> None:
    leo = booking("Leo", local(15, 0), local(16, 9), status="cancelled")
    result = attribute(local(15, 2, 15), [SARA, leo, OMAR])
    assert result.decision == "operator_liable"


def test_near_a_handoff_needs_review() -> None:
    ben = booking("Ben", local(10, 10), local(14, 10), actual_return=local(14, 10, 5))
    mia = booking("Mia", local(14, 11), local(18, 11), actual_return=local(18, 10, 50))
    result = attribute(local(14, 10, 40), [ben, mia])
    assert result.decision == "needs_review"
    assert "35 minutes after Ben" in result.reason
    assert "20 minutes before Mia" in result.reason


def test_overlapping_bookings_need_review() -> None:
    other = booking("Other", local(12, 0), local(13, 0))
    result = attribute(local(12, 14, 12), [SARA, other])
    assert result.decision == "needs_review"


def test_active_booking_without_return_uses_scheduled_end() -> None:
    priya = booking("Priya", local(20, 10), local(24, 10), status="active")
    assert attribute(local(22, 9), [priya]).decision == "renter_liable"
    assert attribute(local(24, 12), [priya]).decision == "operator_liable"


def test_plate_matching_ignores_case_spaces_and_dashes() -> None:
    assert normalize_plate("ev 3001") == normalize_plate("EV-3001")
    assert normalize_plate(" Ev-30 01 ") == "EV3001"
