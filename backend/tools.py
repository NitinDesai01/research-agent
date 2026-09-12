"""Search and scrape tools used by the research pipeline."""
from __future__ import annotations

import os
from typing import List, Dict

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from tavily import TavilyClient

load_dotenv()

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
_MAX_SCRAPE_CHARS = 12_000

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0 Safari/537.36"
    )
}


def web_search(query: str) -> List[Dict[str, str]]:
    """Run a single Tavily search and return trimmed results."""
    if not TAVILY_API_KEY:
        raise RuntimeError("TAVILY_API_KEY is not set.")
    client = TavilyClient(api_key=TAVILY_API_KEY)
    response = client.search(
        query=query, search_depth="advanced", max_results=5
    )
    results: List[Dict[str, str]] = []
    for r in response.get("results", []):
        results.append(
            {
                "title": (r.get("title") or "").strip(),
                "url": (r.get("url") or "").strip(),
                "content": (r.get("content") or "").strip(),
            }
        )
    return results


def scrape_url(url: str) -> str:
    """Fetch a URL and return cleaned readable text (capped)."""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=15)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Failed to fetch {url}: {exc}") from exc

    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(
        ["script", "style", "nav", "footer", "header",
         "aside", "form", "noscript", "svg", "iframe"]
    ):
        tag.decompose()

    text = soup.get_text(separator="\n")
    lines = [ln.strip() for ln in text.splitlines()]
    cleaned = "\n".join(ln for ln in lines if ln)

    if len(cleaned) > _MAX_SCRAPE_CHARS:
        cleaned = cleaned[:_MAX_SCRAPE_CHARS] + "\n\n[...truncated...]"

    return cleaned