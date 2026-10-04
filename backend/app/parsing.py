"""Reads `Label: value` lines from a notice. Pure function, no DB, no AI."""

import re
from datetime import date, datetime, timedelta

from app.schemas import ParsedNotice

# Field name -> accepted labels (case-insensitive). Add new wordings here.
LABEL_ALIASES: dict[str, list[str]] = {
    "plate": ["plate", "license plate", "vehicle plate", "tag"],
    "violation": ["violation", "offence", "offense", "infraction"],
    "occurred_local": ["date/time", "date and time", "offence date", "violation date"],
    "location": ["location", "place"],
    "amount": ["fine", "amount due", "penalty", "amount"],
    "notice_date": ["notice date", "date of notice", "issued"],
    "respond_by": ["respond by", "pay by", "due date"],
    "respond_within": ["respond within"],
}

REQUIRED_FIELDS: list[str] = ["plate", "violation", "occurred_local", "amount", "notice_date", "respond_by"]

LABEL_TO_FIELD: dict[str, str] = {
    label: field for field, labels in LABEL_ALIASES.items() for label in labels
}


def normalize_label(label: str) -> str:
    return " ".join(label.lower().split())


def read_labelled_lines(text: str) -> dict[str, str]:
    """Map each known field to the first value found for it."""
    values: dict[str, str] = {}
    for line in text.splitlines():
        if ":" not in line:
            continue
        # Split on the first colon only, so times like 14:12 stay intact.
        label, value = line.split(":", 1)
        field = LABEL_TO_FIELD.get(normalize_label(label))
        if field and value.strip() and field not in values:
            values[field] = value.strip()
    return values


def to_datetime(value: str) -> datetime | None:
    try:
        return datetime.strptime(value, "%Y-%m-%d %H:%M")
    except ValueError:
        return None


def to_date(value: str) -> date | None:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def to_amount(value: str) -> float | None:
    try:
        return float(value.replace("$", "").replace(",", "").strip())
    except ValueError:
        return None


def to_days(value: str) -> int | None:
    match = re.search(r"\d+", value)
    return int(match.group()) if match else None


def parse_notice(text: str) -> ParsedNotice:
    """Extract the notice fields. Unreadable or absent required fields are listed in `missing`, never guessed."""
    raw = read_labelled_lines(text)
    notice_date = to_date(raw["notice_date"]) if "notice_date" in raw else None
    respond_by = to_date(raw["respond_by"]) if "respond_by" in raw else None

    # "Respond within: N days" counts from the notice date.
    if respond_by is None and notice_date and "respond_within" in raw:
        days = to_days(raw["respond_within"])
        respond_by = notice_date + timedelta(days=days) if days is not None else None

    parsed = ParsedNotice(
        plate=raw.get("plate"),
        violation=raw.get("violation"),
        occurred_local=to_datetime(raw["occurred_local"]) if "occurred_local" in raw else None,
        location=raw.get("location", "Unknown"),
        amount=to_amount(raw["amount"]) if "amount" in raw else None,
        notice_date=notice_date,
        respond_by=respond_by,
    )
    parsed.missing = [field for field in REQUIRED_FIELDS if getattr(parsed, field) is None]
    return parsed
