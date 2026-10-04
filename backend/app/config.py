"""Environment settings and business constants. Edit the constants here, not inline."""

import os
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

# Load backend/.env no matter which folder uvicorn or pytest is started from.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
# Supabase now calls this the "secret key" (sb_secret_...). Backend only.
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

# Notice times are local to the operator's city; everything is stored as UTC.
OPERATOR_TIMEZONE: str = "America/New_York"
OPERATOR_TZ: ZoneInfo = ZoneInfo(OPERATOR_TIMEZONE)

ADMIN_FEE: float = 25.00  # added to the fine when charging a renter
HANDOFF_MARGIN_MINUTES: int = 60  # a ticket this close to a pickup/return is too close to call
URGENT_DAYS: int = 5  # deadline at or below this many days is urgent
MAX_NOTICE_CHARS: int = 5000
MAX_FINE: float = 10000
