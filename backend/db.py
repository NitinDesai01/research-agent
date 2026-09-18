"""Postgres connection + schema for saved research reports."""
from __future__ import annotations

import json
import os
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Text,
    create_engine,
    select,
)
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

POSTGRES_URL = os.getenv("POSTGRES_URL") or os.getenv("POSTGRES_PRISMA_URL")

Base = declarative_base()


class SavedReport(Base):
    __tablename__ = "saved_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(128), index=True, nullable=False)
    topic = Column(Text, nullable=False)
    report = Column(Text, nullable=False)
    critique = Column(Text, nullable=True)
    verification = Column(Text, nullable=True)
    sources_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


_engine = None
_Session = None


def _init():
    global _engine, _Session
    if _engine is not None:
        return
    if not POSTGRES_URL:
        raise RuntimeError(
            "POSTGRES_URL is not set. Add it to .env or Vercel env vars."
        )
    _engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    Base.metadata.create_all(_engine)
    _Session = sessionmaker(bind=_engine, expire_on_commit=False)


@contextmanager
def get_session():
    _init()
    session = _Session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def save_report(
    user_id: str,
    topic: str,
    report: str,
    critique: str = "",
    verification: str = "",
    sources: Optional[List[Dict[str, Any]]] = None,
) -> int:
    with get_session() as session:
        row = SavedReport(
            user_id=user_id,
            topic=topic,
            report=report,
            critique=critique,
            verification=verification,
            sources_json=json.dumps(sources or []),
        )
        session.add(row)
        session.flush()
        return row.id


def list_reports(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    with get_session() as session:
        stmt = (
            select(SavedReport)
            .where(SavedReport.user_id == user_id)
            .order_by(SavedReport.created_at.desc())
            .limit(limit)
        )
        rows = session.execute(stmt).scalars().all()
        return [_row_to_dict(r, include_body=False) for r in rows]


def get_report(user_id: str, report_id: int) -> Optional[Dict[str, Any]]:
    with get_session() as session:
        stmt = select(SavedReport).where(
            SavedReport.id == report_id, SavedReport.user_id == user_id
        )
        row = session.execute(stmt).scalar_one_or_none()
        return _row_to_dict(row, include_body=True) if row else None


def delete_report(user_id: str, report_id: int) -> bool:
    with get_session() as session:
        stmt = select(SavedReport).where(
            SavedReport.id == report_id, SavedReport.user_id == user_id
        )
        row = session.execute(stmt).scalar_one_or_none()
        if not row:
            return False
        session.delete(row)
        return True


def _row_to_dict(row: SavedReport, include_body: bool) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "id": row.id,
        "topic": row.topic,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
    if include_body:
        out["report"] = row.report
        out["critique"] = row.critique or ""
        out["verification"] = row.verification or ""
        try:
            out["sources"] = json.loads(row.sources_json or "[]")
        except Exception:
            out["sources"] = []
    return out