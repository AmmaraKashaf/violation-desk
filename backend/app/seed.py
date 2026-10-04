"""Reset and seed demo data. Run directly with `python -m app.seed`, or via POST /demo/reset."""

from datetime import datetime
from typing import Any

from app.db import get_db
from app.samples import local_at

# Supabase refuses an unfiltered delete; this filter matches every row.
NO_SUCH_ID = "00000000-0000-0000-0000-000000000000"

VEHICLES: list[dict[str, str]] = [
    {"name": "Tesla Model 3", "plate": "EV-3001"},
    {"name": "Jeep Wrangler", "plate": "JP-4410"},
    {"name": "Toyota RAV4", "plate": "RV-7520"},
]


def booking_rows(vehicle_ids: dict[str, str]) -> list[dict[str, Any]]:
    """Bookings from section 8. Times are D-relative, local, stored as UTC."""
    tesla, jeep, rav4 = vehicle_ids["EV-3001"], vehicle_ids["JP-4410"], vehicle_ids["RV-7520"]
    rows: list[tuple[str, str, datetime, datetime, datetime | None, str]] = [
        (tesla, "Sara Lindqvist", local_at(-12, 10), local_at(-8, 10), local_at(-8, 13, 20), "completed"),
        (tesla, "Leo Fischer", local_at(-7, 0), local_at(-6, 9), None, "cancelled"),
        (tesla, "Omar Haddad", local_at(-6, 10), local_at(-3, 10), local_at(-3, 9, 40), "completed"),
        (tesla, "Priya Shah", local_at(-2, 10), local_at(2, 10), None, "active"),
        (jeep, "Ben Carter", local_at(-9, 10), local_at(-5, 10), local_at(-5, 10, 5), "completed"),
        (jeep, "Mia Rossi", local_at(-5, 11), local_at(-1, 11), local_at(-1, 10, 50), "completed"),
        (rav4, "Chloe Nguyen", local_at(-3, 10), local_at(1, 10), None, "active"),
    ]
    return [
        {
            "vehicle_id": vehicle_id,
            "renter_name": renter,
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "actual_return_at": actual.isoformat() if actual else None,
            "status": status,
        }
        for vehicle_id, renter, start, end, actual, status in rows
    ]


def reset_and_seed() -> dict[str, int]:
    db = get_db()
    # Children first, so no foreign key points at a deleted row.
    for table in ("vd_violations", "vd_bookings", "vd_vehicles"):
        db.table(table).delete().neq("id", NO_SUCH_ID).execute()

    vehicles = db.table("vd_vehicles").insert(VEHICLES).execute().data
    vehicle_ids = {vehicle["plate"]: vehicle["id"] for vehicle in vehicles}
    bookings = db.table("vd_bookings").insert(booking_rows(vehicle_ids)).execute().data
    return {"vehicles": len(vehicles), "bookings": len(bookings)}


if __name__ == "__main__":
    print(reset_and_seed())
