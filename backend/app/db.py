"""Supabase client. Created lazily so the pure modules and their tests never need env values."""

from functools import cache

from supabase import Client, create_client

from app.config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL


@cache
def get_db() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
