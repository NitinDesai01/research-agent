"""Orchestration layer for the multi-agent research pipeline.

Tier 1 upgrades:
- Multi-source evidence gathering (top 3 sources in parallel)
- Streaming Writer tokens via progress callbacks
"""
from __future__ import annotations

import asyncio
import re
from typing import Any, Dict, List, Tuple

from agents import (
    build_search_agent,
    build_reader_chain,
    build_writer_chain,
    build_critic_chain,
)
from tools import web_search, scrape_url, tavily_extract
from verifier import build_verifier_chain

_URL_RE = re.compile(r"https?://[^\s\)\]\>\"']+")
_MAX_READER_SOURCES = 3


# ---------------------------------------------------------------------------
# Scraping + Reader (parallel)
# ---------------------------------------------------------------------------
async def _fetch_one(candidate: Dict[str, str]) -> Tuple[Dict[str, str], str]:
    """Try Tavily extract, then requests. Returns (candidate, text)."""
    url = candidate["url"]

    # Strategy A: Tavily extract
    try:
        text = await asyncio.to_thread(tavily_extract, url)
        if text and len(text.strip()) > 400:
            return candidate, text
    except Exception:
        pass

    # Strategy B: requests + BeautifulSoup
    try:
        text = await asyncio.to_thread(scrape_url, url)
        if text and len(text.strip()) > 400:
            return candidate, text
    except Exception:
        pass

    return candidate, ""


async def _gather_sources(
    candidates: List[Dict[str, str]],
) -> Tuple[List[Dict[str, str]], List[str]]:
    """Scrape up to _MAX_READER_SOURCES candidates in parallel.

    Returns (successful, failed_urls).
    """
    top = candidates[:_MAX_READER_SOURCES]
    results = await asyncio.gather(
        *[_fetch_one(c) for c in top], return_exceptions=True
    )

    successful: List[Dict[str, str]] = []
    failed: List[str] = []

    for r in results:
        if isinstance(r, Exception):
            failed.append(str(r))
            continue
        candidate, text = r
        if text:
            successful.append({**candidate, "scraped_text": text})
        else:
            failed.append(candidate["url"])

    return successful, failed


# ---------------------------------------------------------------------------
# Progress emit
# ---------------------------------------------------------------------------
def _emit(progress_cb, stage, **payload):
    if progress_cb:
        try:
            progress_cb(stage, payload)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def run_pipeline(topic: str, progress_cb=None) -> Dict[str, Any]:
    """Run the full research pipeline (sync wrapper for thread execution)."""
    return asyncio.run(_run_pipeline_async(topic, progress_cb))


async def _run_pipeline_async(topic: str, progress_cb=None) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "topic": topic,
        "search_results": [],
        "scraped_urls": [],
        "reader_notes": "",       # merged notes from all readers
        "reader_notes_list": [],  # per-source notes
        "report": "",
        "critique": "",
        "verification": "",
        "sources": [],
        "errors": [],
    }

    # --- 1. Search -------------------------------------------------------
    _emit(progress_cb, "searching", status="running")
    try:
        agent = build_search_agent()
        search_output = agent.invoke({"input": topic})["output"]
        result["search_results"] = _parse_search_output(search_output)
        if not result["search_results"]:
            result["search_results"] = web_search(topic)
    except Exception as exc:  # noqa: BLE001
        result["errors"].append(f"Search agent failed: {exc}")
        try:
            result["search_results"] = web_search(topic)
        except Exception as exc2:  # noqa: BLE001
            result["errors"].append(f"Fallback search failed: {exc2}")

    _emit(
        progress_cb,
        "searching",
        status="done",
        count=len(result["search_results"]),
        results=result["search_results"],
    )

    if not result["search_results"]:
        result["errors"].append("No search results found. Aborting.")
        _emit(progress_cb, "error", message="No search results found.")
        return result

    # --- 2. Scrape top N in parallel ------------------------------------
    _emit(progress_cb, "reading", status="running")
    successful, failed = await _gather_sources(result["search_results"])

    if failed:
        result["errors"].append(
            f"Skipped {len(failed)} inaccessible source(s)."
        )

    if not successful:
        # Fall back to the longest snippet
        chosen = max(
            result["search_results"], key=lambda r: len(r.get("content", ""))
        )
        successful = [
            {
                **chosen,
                "scraped_text": chosen.get("content", ""),
            }
        ]
        result["errors"].append(
            "Could not scrape any source — using search snippets only."
        )

    result["scraped_urls"] = [s["url"] for s in successful]

    # --- 3. Reader on each successful source ----------------------------
    reader_notes_list: List[Dict[str, str]] = []
    reader_chain = build_reader_chain()

    async def _read_one(source: Dict[str, str]) -> Dict[str, str]:
        try:
            notes = await asyncio.to_thread(
                reader_chain.invoke,
                {
                    "topic": topic,
                    "url": source["url"],
                    "content": source["scraped_text"],
                },
            )
        except Exception as exc:  # noqa: BLE001
            notes = f"[Reader failed for {source['url']}: {exc}]"
        return {
            "url": source["url"],
            "title": source.get("title", ""),
            "notes": notes,
        }

    reader_results = await asyncio.gather(
        *[_read_one(s) for s in successful], return_exceptions=True
    )

    for r in reader_results:
        if isinstance(r, Exception):
            result["errors"].append(f"Reader failed: {r}")
            continue
        reader_notes_list.append(r)

    result["reader_notes_list"] = reader_notes_list
    result["reader_notes"] = "\n\n---\n\n".join(
        f"[{r['title'] or r['url']}]\n{r['notes']}" for r in reader_notes_list
    )

    _emit(
        progress_cb,
        "reading",
        status="done",
        sources=len(reader_notes_list),
        notes=result["reader_notes"],
    )

    # --- 4. Build evidence blob -----------------------------------------
    evidence_parts = []
    for i, r in enumerate(result["search_results"], 1):
        evidence_parts.append(
            f"[Source {i}] {r['title']}\nURL: {r['url']}\nSnippet: {r['content']}"
        )
    for r in reader_notes_list:
        evidence_parts.append(
            f"\n[DEEP READ of {r['url']}]\n{r['notes']}"
        )
    evidence = "\n\n".join(evidence_parts)

    # --- 5. Writer (streaming) ------------------------------------------
    _emit(progress_cb, "writing", status="running")
    report_chunks: List[str] = []
    try:
        writer_chain = build_writer_chain()
        async for chunk in writer_chain.astream(
            {"topic": topic, "evidence": evidence}
        ):
            if chunk:
                report_chunks.append(chunk)
                _emit(progress_cb, "writing", status="streaming", chunk=chunk)
    except Exception as exc:  # noqa: BLE001
        result["errors"].append(f"Writer chain failed: {exc}")

    report = "".join(report_chunks)
    if not report:
        report = f"# Research Report: {topic}\n\n_Report generation failed._"

    result["report"] = report
    _emit(progress_cb, "writing", status="done", report=report)

    # --- 6. Verifier ----------------------------------------------------
    _emit(progress_cb, "verifying", status="running")
    verification = ""
    try:
        verifier_chain = build_verifier_chain()
        verification = await asyncio.to_thread(
            verifier_chain.invoke, {"report": report, "evidence": evidence}
        )
    except Exception as exc:  # noqa: BLE001
        result["errors"].append(f"Verifier chain failed: {exc}")

    result["verification"] = verification
    _emit(progress_cb, "verifying", status="done", verification=verification)

    # --- 7. Critic ------------------------------------------------------
    _emit(progress_cb, "critiquing", status="running")
    critique = ""
    try:
        critic_chain = build_critic_chain()
        critique = await asyncio.to_thread(
            critic_chain.invoke, {"topic": topic, "report": report}
        )
    except Exception as exc:  # noqa: BLE001
        result["errors"].append(f"Critic chain failed: {exc}")
        critique = "OVERALL SCORE: 0/10\n\nCritique unavailable."

    result["critique"] = critique
    _emit(progress_cb, "critiquing", status="done", critique=critique)

    # --- 8. Sources -----------------------------------------------------
    sources = [
        {"title": r["title"], "url": r["url"]} for r in result["search_results"]
    ]
    result["sources"] = sources
    _emit(progress_cb, "done", status="done", sources=sources)

    return result


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------
def _parse_search_output(text: str) -> List[Dict[str, str]]:
    """Best-effort parse of an agent's text output into structured results."""
    if not text:
        return []

    results: List[Dict[str, str]] = []

    blocks = re.split(r"\n(?=\[\d+\])", text.strip())
    for block in blocks:
        url_match = _URL_RE.search(block)
        if not url_match:
            continue
        url = url_match.group(0).rstrip(".,);]")
        title_match = re.match(r"\[\d+\]\s*(.*)", block)
        title = title_match.group(1).strip() if title_match else url
        snippet = ""
        if "Snippet:" in block:
            snippet = block.split("Snippet:", 1)[-1].strip()
        elif "URL:" in block:
            after_url = block.split("URL:", 1)[-1]
            lines = after_url.splitlines()
            snippet = " ".join(l.strip() for l in lines[1:] if l.strip())
        results.append({"title": title, "url": url, "content": snippet})

    if len(results) < 2:
        all_urls = list(dict.fromkeys(_URL_RE.findall(text)))
        results = []
        for url in all_urls:
            clean_url = url.rstrip(".,);]")
            idx = text.find(url)
            ctx = text[idx + len(url): idx + len(url) + 400].strip()
            ctx = re.sub(r"\s+", " ", ctx)[:300]
            results.append(
                {"title": clean_url, "url": clean_url, "content": ctx}
            )

    return results