"""FastAPI app: research pipeline + auth + saved reports + follow-up chat."""
from __future__ import annotations

import asyncio
import json
import os
from queue import Queue
from threading import Thread
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from cache import cache_get, cache_set
from pipeline import run_pipeline
from rate_limit import limiter, RESEARCH_RATE_LIMIT
from reports_api import router as reports_router

load_dotenv()

app = FastAPI(title="Multi-Agent Research API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_ALLOWED = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _ALLOWED if o.strip()],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register saved reports router
app.include_router(reports_router)


class ResearchRequest(BaseModel):
    topic: str


class ChatRequest(BaseModel):
    topic: str
    report: str
    question: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/research/stream")
@limiter.limit(RESEARCH_RATE_LIMIT)
async def research_stream(request: Request, req: ResearchRequest):
    cached = await cache_get(req.topic)
    if cached:
        async def cached_gen():
            yield f"data: {json.dumps({'stage': 'cached', 'result': cached})}\n\n"
        return StreamingResponse(cached_gen(), media_type="text/event-stream")

    queue: "Queue[str]" = Queue()

    def progress_cb(stage: str, payload: dict):
        queue.put(json.dumps({"stage": stage, **payload}))

    def worker():
        try:
            final = run_pipeline(req.topic, progress_cb=progress_cb)
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(cache_set(req.topic, final))
                loop.close()
            except Exception:
                pass
            queue.put(json.dumps({"stage": "final", "result": final}))
        except Exception as exc:  # noqa: BLE001
            queue.put(json.dumps({"stage": "fatal", "message": str(exc)}))
        finally:
            queue.put(None)

    Thread(target=worker, daemon=True).start()

    async def event_gen() -> AsyncGenerator[str, None]:
        loop = asyncio.get_event_loop()
        while True:
            item = await loop.run_in_executor(None, queue.get)
            if item is None:
                break
            yield f"data: {item}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.post("/chat")
@limiter.limit("30/hour")
async def chat(request: Request, req: ChatRequest):
    """Answer follow-up questions using the existing report as context."""
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    from agents import _llm

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are a research assistant. Answer the user's question
using ONLY the provided report. If the report doesn't contain the answer,
say so honestly — do not invent facts.""",
            ),
            (
                "human",
                "TOPIC: {topic}\n\nREPORT:\n{report}\n\nQUESTION: {question}",
            ),
        ]
    )
    chain = prompt | _llm() | StrOutputParser()

    try:
        answer = await asyncio.to_thread(
            chain.invoke,
            {
                "topic": req.topic,
                "report": req.report[:8000],
                "question": req.question,
            },
        )
    except Exception as exc:  # noqa: BLE001
        answer = f"Error: {exc}"

    return {"answer": answer}