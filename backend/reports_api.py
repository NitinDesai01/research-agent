"""Endpoints for saving, listing, and deleting reports."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import db
from auth import require_user_id

router = APIRouter(prefix="/reports", tags=["reports"])


class SaveReportRequest(BaseModel):
    topic: str
    report: str
    critique: str = ""
    verification: str = ""
    sources: list = []


@router.post("")
def save_report(req: SaveReportRequest, user_id: str = Depends(require_user_id)):
    report_id = db.save_report(
        user_id=user_id,
        topic=req.topic,
        report=req.report,
        critique=req.critique,
        verification=req.verification,
        sources=req.sources,
    )
    return {"id": report_id}


@router.get("")
def list_my_reports(user_id: str = Depends(require_user_id)):
    return {"reports": db.list_reports(user_id)}


@router.get("/{report_id}")
def get_my_report(report_id: int, user_id: str = Depends(require_user_id)):
    report = db.get_report(user_id, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.delete("/{report_id}")
def delete_my_report(report_id: int, user_id: str = Depends(require_user_id)):
    ok = db.delete_report(user_id, report_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}