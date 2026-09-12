"""Redis-based caching layer with connection pooling.
Falls back to in-memory if Redis is unavailable."""
from __future__ import annotations

import hashlib
import json
import os
from typing import Any, Dict, Optional

import redis.asyncio as aioredis
from redis.asyncio import ConnectionPool
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CACHE_TTL = int(os.getenv("CACHE_TTL_SECONDS", "86400"))  # 24 hours

# In-memory fallback when Redis is unavailable
_MEMORY_CACHE: Dict[str, Dict[str, Any]] = {}

# Module-level connection pool (created lazily, reused across requests)
_pool: Optional[ConnectionPool] = None
_pool_failed = False


def _get_pool() -> Optional[ConnectionPool]:
    """Lazily create and reuse a single Redis connection pool."""
    global _pool, _pool_failed
    if _pool_failed:
        return None
    if _pool is None:
        try:
            _pool = ConnectionPool.from_url(
                REDIS_URL,
                decode_responses=True,
                max_connections=10,
            )
        except Exception:
            _pool_failed = True
            return None
    return _pool


def _cache_key(topic: str) -> str:
    """Generate a namespaced cache key."""
    normalized = topic.strip().lower()
    topic_hash = hashlib.sha256(normalized.encode()).hexdigest()[:16]
    return f"research:{topic_hash}"


async def cache_get(topic: str) -> Optional[Dict[str, Any]]:
    """Retrieve cached research result by topic."""
    key = _cache_key(topic)
    pool = _get_pool()
    if pool:
        try:
            client = aioredis.Redis(connection_pool=pool)
            raw = await client.get(key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return _MEMORY_CACHE.get(key)


async def cache_set(topic: str, result: Dict[str, Any]) -> None:
    """Cache a research result by topic."""
    key = _cache_key(topic)
    pool = _get_pool()
    if pool:
        try:
            client = aioredis.Redis(connection_pool=pool)
            await client.setex(key, CACHE_TTL, json.dumps(result, default=str))
            return
        except Exception:
            pass
    _MEMORY_CACHE[key] = result