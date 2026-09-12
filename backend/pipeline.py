"""Orchestration layer for the multi-agent research pipeline."""
from __future__ import annotations

import re
from typing import Any, Dict, List

from agents import (
    build_search_agent,
    build_reader_chain,
    build_writer_chain,
    build_critic_chain,
)
from tools import web_search, scrape_url
from verifier import build_verifier_chain

_URL_RE = re.compile(r"https?://[^\s\)\]\>\"']+")


def _extract_urls_from_agent_output(text: str) -> List[str]:
    return list(dict.fromkeys(_URL_RE.findall(text or "")))


def run_pipeline(topic: str, progress_cb=None) -> Dict[str, Any]:
    """Run the full research pipeline."""
    def emit(stage, **payload):
        if progress_cb:
            try:
                progress_cb(stage, payload)
            except Exception:
                pass

    result: Dict[str, Any] = {
        "topic": topic,
        "search_results": [],
        "scraped_url": None,
        "reader_notes": "",
        "report": "",
        "critique": "",
        "verification": "",
        "sources": [],
        "errors": [],
    }

    # --- 1. Search Agent -------------------------------------------------
    emit("searching", status="running")
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

    emit(
        "searching",
        status="done",
        count=len(result["search_results"]),
        results=result["search_results"],
    )

    if not result["search_results"]:
        result["errors"].append("No search results found. Aborting.")
        emit("error", message="No search results found.")
        return result

    # --- 2. Scrape one source -------------------------------------------
    chosen = result["search_results"][0]
    result["scraped_url"] = chosen["url"]
    emit("reading", status="running", url=chosen["url"])

    scraped = ""
    try:
        scraped = scrape_url(chosen["url"])
    except Exception as exc:  # noqa: BLE001
        result["errors"].append(f"Scrape failed for {chosen['url']}: {exc}")

    if not scraped:
        scraped = chosen.get("content", "")
        if not scraped:
            result["errors"].append("No content available to read.")

    # --- 3. Reader Agent -------------------------------------------------
    reader_notes = ""
    if scraped:
        try:
            reader_chain = build_reader_chain()
            reader_notes = reader_chain.invoke(
                {"topic": topic, "url": chosen["url"], "content": scraped}
            )
        except Exception as exc:  # noqa: BLE001
            result["errors"].append(f"Reader agent failed: {exc}")

    result["reader_notes"] = reader_notes
    emit("reading", status="done", notes=reader_notes)

    # --- 4. Writer Chain -------------------------------------------------
    emit("writing", status="running")
    evidence_parts = []
    for i, r in enumerate(result["search_results"], 1):
        evidence_parts.append(
            f"[Source {i}] {r['title']}\nURL: {r['url']}\nSnippet: {r['content']}"
        )
    if reader_notes:
        evidence_parts.append(
            f"\n[DEEP READ of {chosen['url']}]\n{reader_notes}"
        )
    evidence = "\n\n".join(evidence_parts)

    report = ""
    try:
        writer_chain = build_writer_chain()
        report = writer_chain.invoke({"topic": topic, "evidence": evidence})
    except Exception as exc:  # noqa: BLE001
        result["errors"].append(f"Writer chain failed: {exc}")
        report = f"# Research Report: {topic}\n\n_Report generation failed._"

    result["report"] = report
    emit("writing", status="done", report=report)

    # --- 5. Verifier Chain -----------------------------------------------
    emit("verifying", status="running")
    verification = ""
    try:
        verifier_chain = build_verifier_chain()
        verification = verifier_chain.invoke(
            {"report": report, "evidence": evidence}
        )
    except Exception as exc:  # noqa: BLE001
        result["errors"].append(f"Verifier chain failed: {exc}")

    result["verification"] = verification
    emit("verifying", status="done", verification=verification)

    # --- 6. Critic Chain -------------------------------------------------
    emit("critiquing", status="running")
    critique = ""
    try:
        critic_chain = build_critic_chain()
        critique = critic_chain.invoke({"topic": topic, "report": report})
    except Exception as exc:  # noqa: BLE001
        result["errors"].append(f"Critic chain failed: {exc}")
        critique = "OVERALL SCORE: 0/10\n\nCritique unavailable."

    result["critique"] = critique
    emit("critiquing", status="done", critique=critique)

    # --- 7. Sources ------------------------------------------------------
    sources = [
        {"title": r["title"], "url": r["url"]} for r in result["search_results"]
    ]
    result["sources"] = sources
    emit("done", status="done", sources=sources)

    return result


def _parse_search_output(text: str) -> List[Dict[str, str]]:
    """Best-effort parse of an agent's text output into structured results."""
    results: List[Dict[str, str]] = []
    if not text:
        return results
    blocks = re.split(r"\n(?=\[\d+\])", text.strip())
    for block in blocks:
        url_match = _URL_RE.search(block)
        if not url_match:
            continue
        url = url_match.group(0).rstrip(".,);")
        title_match = re.match(r"\[\d+\]\s*(.*)", block)
        title = title_match.group(1).strip() if title_match else url
        snippet = (
            block.split("Snippet:", 1)[-1].strip() if "Snippet:" in block else ""
        )
        results.append({"title": title, "url": url, "content": snippet})
    return results