"""Sample notice texts, dated relative to today so the demo never goes stale."""

from datetime import date, datetime, time, timedelta

from app.config import OPERATOR_TZ


def today_local() -> date:
    return datetime.now(OPERATOR_TZ).date()


def local_at(day_offset: int, hour: int = 0, minute: int = 0) -> datetime:
    """D + day_offset at hour:minute, operator local time (D = today at 00:00)."""
    return datetime.combine(today_local() + timedelta(days=day_offset), time(hour, minute), tzinfo=OPERATOR_TZ)


def day(day_offset: int) -> str:
    return (today_local() + timedelta(days=day_offset)).isoformat()


def stamp(day_offset: int, hour: int, minute: int) -> str:
    return f"{day(day_offset)} {hour:02d}:{minute:02d}"


def build_samples() -> list[dict[str, str]]:
    # Deadlines chosen to show one urgent (red), one soon (amber) and the rest ok (green).
    return [
        {
            "label": "Parking ticket",
            "text": f"""CITY OF NEW YORK - PARKING VIOLATION NOTICE
Plate: EV-3001
Violation: Parking
Date/Time: {stamp(-10, 14, 12)}
Location: W 42nd St & 8th Ave
Fine: $65.00
Notice date: {day(-6)}
Respond by: {day(3)}""",
        },
        {
            "label": "Red light camera",
            "text": f"""RED LIGHT CAMERA PROGRAM - NOTICE OF LIABILITY
Plate: EV-3001
Violation: Red light camera
Date/Time: {stamp(-8, 11, 47)}
Location: Atlantic Ave & Flatbush Ave
Amount due: $150.00
Notice date: {day(-5)}
Respond by: {day(10)}""",
        },
        {
            "label": "Overnight parking",
            "text": f"""CITY OF NEW YORK - PARKING VIOLATION NOTICE
Plate: EV-3001
Violation: Parking
Date/Time: {stamp(-7, 2, 15)}
Location: E 14th St & 1st Ave
Fine: $45.00
Notice date: {day(-4)}
Respond by: {day(25)}""",
        },
        {
            "label": "Speed camera (other wording)",
            "text": f"""AUTOMATED SPEED ENFORCEMENT - PENALTY CHARGE NOTICE
Vehicle plate: ZZ-9999
Offence: Speed camera
Offence date: {stamp(-4, 16, 30)}
Place: Ocean Pkwy near Ave P
Penalty: $95
Date of notice: {day(-2)}
Respond within: 30 days""",
        },
        {
            "label": "Parking at handoff",
            "text": f"""CITY OF NEW YORK - PARKING VIOLATION NOTICE
Plate: JP-4410
Violation: Parking
Date/Time: {stamp(-5, 10, 40)}
Location: Bedford Ave & N 7th St
Fine: $55.00
Notice date: {day(-3)}
Respond by: {day(27)}""",
        },
    ]
