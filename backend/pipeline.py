"""Orchestration layer for the multi-agent research pipeline."""
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
from paper_guide import build_paper_guide_chain

_URL_RE = re.compile(r"https?://[^\s\)\]\>\"']+")
_MAX_READER_SOURCES = 3

async def _fetch_one(candidate: Dict[str, str]) -> Tuple[Dict[str, str], str]:
    url = candidate["url"]
    try:
        text = await asyncio.to_thread(tavily_extract, url)
        if text and len(text.strip()) > 400:
            return candidate, text
    except Exception:
        pass
    try:
        text = await asyncio.to_thread(scrape_url, url)
        if text and len(text.strip()) > 400:
            return candidate, text
    except Exception:
        pass
    return candidate, ""

async def _gather_sources(candidates: List[Dict[str, str]]) -> Tuple[List[Dict[str, str]], List[str]]:
    top = candidates[:_MAX_READER_SOURCES]
    results = await asyncio.gather(*[_fetch_one(c) for c in top], return_exceptions=True)
    successful, failed = [], []
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

def _emit(progress_cb, stage, **payload):
    if progress_cb:
        try:
            progress_cb(stage, payload)
        except Exception:
            pass

def run_pipeline(topic: str, progress_cb=None) -> Dict[str, Any]:
    return asyncio.run(_run_pipeline_async(topic, progress_cb))

async def _run_pipeline_async(topic: str, progress_cb=None) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "topic": topic, "search_results": [], "scraped_urls": [],
        "reader_notes": "", "reader_notes_list": [], "report": "",
        "critique": "", "verification": "", "paper_guide": "",
        "sources": [], "errors": [],
    }

    # 1. Search
    _emit(progress_cb, "searching", status="running")
    try:
        agent = build_search_agent()
        search_output = agent.invoke({"input": topic})["output"]
        result["search_results"] = _parse_search_output(search_output)
        if not result["search_results"]:
            result["search_results"] = web_search(topic)
    except Exception as exc:
        result["errors"].append(f"Search failed: {exc}")
        result["search_results"] = web_search(topic)

    _emit(progress_cb, "searching", status="done", count=len(result["search_results"]))
    if not result["search_results"]:
        return result

    # 2. Scrape
    _emit(progress_cb, "reading", status="running")
    successful, failed = await _gather_sources(result["search_results"])
    if not successful:
        chosen = max(result["search_results"], key=lambda r: len(r.get("content", "")))
        successful = [{**chosen, "scraped_text": chosen.get("content", "")}]

    # 3. Reader
    reader_notes_list = []
    reader_chain = build_reader_chain()
    for source in successful:
        try:
            notes = await asyncio.to_thread(reader_chain.invoke, {"topic": topic, "url": source["url"], "content": source["scraped_text"]})
            reader_notes_list.append({"url": source["url"], "title": source.get("title", ""), "notes": notes})
        except Exception:
            pass

    result["reader_notes"] = "\n\n---\n\n".join(f"[{r['url']}]\n{r['notes']}" for r in reader_notes_list)
    _emit(progress_cb, "reading", status="done")

    # 4. Build Evidence
    evidence_parts = []
    for i, r in enumerate(result["search_results"], 1):
        evidence_parts.append(f"[Source {i}] {r['title']}\nURL: {r['url']}\nSnippet: {r['content']}")
    for r in reader_notes_list:
        evidence_parts.append(f"\n[DEEP READ of {r['url']}]\n{r['notes']}")
    evidence = "\n\n".join(evidence_parts)

    # 5. Writer (Streaming)
    _emit(progress_cb, "writing", status="running")
    report_chunks = []
    try:
        writer_chain = build_writer_chain()
        async for chunk in writer_chain.astream({"topic": topic, "evidence": evidence}):
            if chunk:
                report_chunks.append(chunk)
                _emit(progress_cb, "writing", status="streaming", chunk=chunk)
    except Exception as exc:
        result["errors"].append(f"Writer failed: {exc}")
    
    report = "".join(report_chunks)
    result["report"] = report
    _emit(progress_cb, "writing", status="done")

    # 6. Verifier
    _emit(progress_cb, "verifying", status="running")
    try:
        verifier_chain = build_verifier_chain()
        result["verification"] = await asyncio.to_thread(verifier_chain.invoke, {"report": report, "evidence": evidence})
    except Exception as exc:
        result["errors"].append(f"Verifier failed: {exc}")
    _emit(progress_cb, "verifying", status="done")

    # 7. Critic
    _emit(progress_cb, "critiquing", status="running")
    try:
        critic_chain = build_critic_chain()
        result["critique"] = await asyncio.to_thread(critic_chain.invoke, {"topic": topic, "report": report})
    except Exception as exc:
        result["errors"].append(f"Critic failed: {exc}")
    _emit(progress_cb, "critiquing", status="done")

    # 8. Paper Guide (WITH DEBUG LOGS)
    _emit(progress_cb, "guiding", status="running")
    print(f"\n--> [DEBUG] Starting Paper Guide for: {topic}")
    try:
        guide_chain = build_paper_guide_chain()
        result["paper_guide"] = await asyncio.to_thread(guide_chain.invoke, {"topic": topic, "report": report, "evidence": evidence})
        print(f"--> [DEBUG] Paper Guide SUCCESS. Length: {len(result['paper_guide'])}")
    except Exception as exc:
        print(f"--> [DEBUG] Paper Guide FAILED: {exc}")
        result["errors"].append(f"Paper guide failed: {exc}")
    _emit(progress_cb, "guiding", status="done")

    # 9. Sources
    result["sources"] = [{"title": r["title"], "url": r["url"]} for r in result["search_results"]]
    _emit(progress_cb, "done", status="done")
    
    return result

def _parse_search_output(text: str) -> List[Dict[str, str]]:
    if not text: return []
    results = []
    blocks = re.split(r"\n(?=\[\d+\])", text.strip())
    for block in blocks:
        url_match = _URL_RE.search(block)
        if not url_match: continue
        url = url_match.group(0).rstrip(".,);]")
        title_match = re.match(r"\[\d+\]\s*(.*)", block)
        title = title_match.group(1).strip() if title_match else url
        snippet = ""
        if "Snippet:" in block: snippet = block.split("Snippet:", 1)[-1].strip()
        results.append({"title": title, "url": url, "content": snippet})
    return results