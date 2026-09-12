"""IP-based rate limiting using slowapi.
Uses Redis storage when available; falls back to in-memory (per-process)."""
from __future__ import annotations

import os
import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL")

# Prefer Redis storage. If REDIS_URL is not set, fall back to in-memory.
if REDIS_URL:
    try:
        limiter = Limiter(
            key_func=get_remote_address,
            default_limits=["100/hour"],
            storage_uri=REDIS_URL,
        )
        logger.info("Rate limiter using Redis storage.")
    except Exception as exc:
        logger.warning(
            "Redis storage failed for rate limiter: %s. Falling back to in-memory.",
            exc,
        )
        limiter = Limiter(
            key_func=get_remote_address,
            default_limits=["100/hour"],
        )
else:
    logger.warning(
        "REDIS_URL not set — rate limiter uses per-process in-memory storage. "
        "In serverless environments each instance has its own counter. "
        "Set REDIS_URL to enforce global limits."
    )
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["100/hour"],
    )

# Configurable limit for the research endpoint
RESEARCH_RATE_LIMIT = os.getenv("RESEARCH_RATE_LIMIT", "10/hour")