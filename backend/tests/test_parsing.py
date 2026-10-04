from datetime import date, datetime

from app.parsing import parse_notice

STANDARD_NOTICE = """
CITY OF EXAMPLE - PARKING NOTICE
Plate: EV-3001
Violation: Parking
Date/Time: 2026-09-24 14:12
Location: 5th Ave & Main St
Fine: $1,065.00
Notice date: 2026-10-01
Respond by: 2026-10-20
"""

ALIAS_NOTICE = """
Vehicle plate: zz 9999
Offence: Speed camera
Offence date: 2026-09-30 16:30
Penalty: 95
Date of notice: 2026-10-02
Pay by: 2026-10-30
"""


def test_standard_labels_parse() -> None:
    parsed = parse_notice(STANDARD_NOTICE)
    assert parsed.missing == []
    assert parsed.plate == "EV-3001"
    assert parsed.violation == "Parking"
    assert parsed.occurred_local == datetime(2026, 9, 24, 14, 12)
    assert parsed.location == "5th Ave & Main St"
    assert parsed.amount == 1065.00
    assert parsed.notice_date == date(2026, 10, 1)
    assert parsed.respond_by == date(2026, 10, 20)


def test_alias_labels_parse() -> None:
    parsed = parse_notice(ALIAS_NOTICE)
    assert parsed.missing == []
    assert parsed.plate == "zz 9999"
    assert parsed.occurred_local == datetime(2026, 9, 30, 16, 30)
    assert parsed.amount == 95.0
    assert parsed.location == "Unknown"  # optional, defaults


def test_missing_field_is_reported() -> None:
    parsed = parse_notice(STANDARD_NOTICE.replace("Plate: EV-3001", ""))
    assert parsed.missing == ["plate"]
    assert parsed.plate is None


def test_unreadable_value_is_reported_not_guessed() -> None:
    parsed = parse_notice(STANDARD_NOTICE.replace("2026-09-24 14:12", "last Tuesday"))
    assert parsed.missing == ["occurred_local"]


def test_respond_within_days_computes_respond_by() -> None:
    text = STANDARD_NOTICE.replace("Respond by: 2026-10-20", "Respond within: 21 days")
    parsed = parse_notice(text)
    assert parsed.respond_by == date(2026, 10, 22)
    assert parsed.missing == []
