"""Clerk JWT verification for FastAPI."""
from __future__ import annotations

import os
from typing import Optional

from clerk_backend_api import Clerk
from clerk_backend_api.security import authenticate_request
from clerk_backend_api.security.types import AuthenticateRequestOptions
from dotenv import load_dotenv
from fastapi import HTTPException, Request

load_dotenv()

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")

_clerk: Optional[Clerk] = None


def _get_clerk() -> Clerk:
    global _clerk
    if _clerk is None:
        if not CLERK_SECRET_KEY:
            raise RuntimeError("CLERK_SECRET_KEY is not set.")
        _clerk = Clerk(bearer_auth=CLERK_SECRET_KEY)
    return _clerk


def get_current_user_id(request: Request) -> Optional[str]:
    """Return the authenticated Clerk user ID, or None if not authenticated."""
    if not CLERK_SECRET_KEY:
        return None
    try:
        request_state = authenticate_request(
            _get_clerk(),
            request,
            AuthenticateRequestOptions(
                authorized_parties=None,  # accept any origin (Vercel previews)
            ),
        )
        if request_state.is_signed_in:
            return request_state.payload.get("sub")
    except Exception:
        return None
    return None


def require_user_id(request: Request) -> str:
    """FastAPI dependency that raises 401 if not authenticated."""
    uid = get_current_user_id(request)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid