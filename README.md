# Multi-Agent AI Research System

A sequential multi-agent pipeline where specialized agents research a topic
and produce a verified, scored report.

## Pipeline

    Search Agent  ->  Reader Chain  ->  Writer Chain  ->  Verifier Chain  ->  Critic Chain

## Stack

- Backend: FastAPI + Python 3.12, LangChain, Groq (gpt-oss-20b)
- Search: Tavily
- Scraper: requests + BeautifulSoup
- Cache: Redis (optional)
- Frontend: React 18 + Vite

## Setup

### Backend

    cd backend
    python -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    Copy-Item .env.example .env
    # add GROQ_API_KEY and TAVILY_API_KEY to .env
    uvicorn main:app --reload --port 8000

### Frontend

    cd frontend
    npm install
    npm run dev

Open http://localhost:5173

## Environment variables

- GROQ_API_KEY  - from https://console.groq.com
- TAVILY_API_KEY - from https://tavily.com
- ALLOWED_ORIGINS - frontend URL for CORS
- REDIS_URL - optional, for caching
- RESEARCH_RATE_LIMIT - requests per hour per IP
- CACHE_TTL_SECONDS - cache lifetime in seconds

## Deploy

Deploy backend and frontend as two separate Vercel projects from the same repo.
