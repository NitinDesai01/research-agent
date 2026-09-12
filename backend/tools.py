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
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
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
    """Fetch a URL directly with requests and return cleaned readable text."""
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


def tavily_extract(url: str) -> str:
    """Extract page content via Tavily's own crawler.

    Bypasses most 403 blocks because Tavily fetches from permitted IPs.
    """
    if not TAVILY_API_KEY:
        raise RuntimeError("TAVILY_API_KEY is not set.")
    client = TavilyClient(api_key=TAVILY_API_KEY)
    try:
        response = client.extract(urls=[url])
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Tavily extract failed for {url}: {exc}") from exc

    results = response.get("results", []) if isinstance(response, dict) else []
    if not results:
        raise RuntimeError(f"Tavily returned no content for {url}")

    content = results[0].get("raw_content") or ""
    if len(content) > _MAX_SCRAPE_CHARS:
        content = content[:_MAX_SCRAPE_CHARS] + "\n\n[...truncated...]"
    return content