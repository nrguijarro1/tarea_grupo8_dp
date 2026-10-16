import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client


BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BACKEND_DIR / ".env")


@lru_cache
def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url:
        raise RuntimeError(
            "Falta la variable SUPABASE_URL en backend/.env"
        )

    if not key:
        raise RuntimeError(
            "Falta la variable SUPABASE_KEY en backend/.env"
        )

    return create_client(url, key)