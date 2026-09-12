"""Agent and chain definitions for the multi-agent research pipeline."""
from __future__ import annotations

import os

from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_groq import ChatGroq

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_NAME = "openai/gpt-oss-20b"


def _llm() -> ChatGroq:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set.")
    return ChatGroq(
        model=MODEL_NAME,
        temperature=0,
        max_tokens=1200,
        api_key=GROQ_API_KEY,
    )


# ---------------------------------------------------------------------------
# 1. Search Agent
# ---------------------------------------------------------------------------
SEARCH_SYSTEM = """You are a Search Agent. You have exactly one tool: `web_search`.

Rules:
- Call `web_search` EXACTLY ONCE with a concise, well-formed query derived from the user's topic.
- NEVER invent URLs, titles, or snippets. Only use what the tool returns.
- Return the raw search results with minimal modification (title, url, content).
- Do not summarize or editorialize. Just return the raw results.
"""


def build_search_agent():
    """Return a LangChain agent that uses the web_search tool once."""
    from langchain_classic.agents import AgentExecutor, create_tool_calling_agent
    from langchain_core.tools import tool

    @tool
    def web_search_tool(query: str) -> str:
        """Search the web for the given query. Returns raw results."""
        from tools import web_search
        results = web_search(query)
        if not results:
            return "No results found."
        out = []
        for i, r in enumerate(results, 1):
            out.append(
                f"[{i}] {r['title']}\nURL: {r['url']}\nSnippet: {r['content']}"
            )
        return "\n\n".join(out)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SEARCH_SYSTEM),
            ("human", "Research topic: {input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]
    )
    agent = create_tool_calling_agent(_llm(), [web_search_tool], prompt)
    return AgentExecutor(
        agent=agent, tools=[web_search_tool], max_iterations=3, verbose=False
    )


# ---------------------------------------------------------------------------
# 2. Reader Chain
# ---------------------------------------------------------------------------
READER_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a Reader Agent. You will receive a block of scraped web
content and a research topic. Analyze ONLY the supplied text.

NEVER invent facts, statistics, or sources. If a section has no supporting
information, write "None found in source."

Respond in EXACTLY this structure:

SOURCE SUMMARY:
<2-3 sentences>

KEY FINDINGS:
- <finding>

IMPORTANT STATISTICS:
- <stat or "None found in source.">

EXAMPLES:
- <example or "None found in source.">

LIMITATIONS:
- <limitation or "None found in source.">

RELEVANCE:
<1-2 sentences on how this source relates to the topic>
""",
        ),
        (
            "human",
            "TOPIC: {topic}\n\nSOURCE URL: {url}\n\nSCRAPED CONTENT:\n{content}",
        ),
    ]
)


def build_reader_chain():
    return READER_PROMPT | _llm() | StrOutputParser()


# ---------------------------------------------------------------------------
# 3. Writer Chain
# ---------------------------------------------------------------------------
WRITER_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a Writer Agent. Produce a structured Markdown research
report using ONLY the provided research evidence.

Hard rules:
- Do NOT invent facts, statistics, URLs, or sources.
- Do NOT use Markdown tables.
- Use short paragraphs.
- Clearly distinguish documented findings from speculation.
- Cite sources inline using the format [Source N] when referencing a specific source.

Use EXACTLY this structure:

# Research Report: {topic}

## 1. Introduction
## 2. Key Findings
(3-4 sub-findings, each a short paragraph)
## 3. Evidence and Examples
## 4. Impact
## 5. Limitations
## 6. Conclusion
## 7. Sources
(bulleted list of URLs actually present in the evidence)
""",
        ),
        ("human", "TOPIC: {topic}\n\nRESEARCH EVIDENCE:\n{evidence}"),
    ]
)


def build_writer_chain():
    return WRITER_PROMPT | _llm() | StrOutputParser()


# ---------------------------------------------------------------------------
# 4. Critic Chain
# ---------------------------------------------------------------------------
CRITIC_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a Critic Agent. Evaluate the provided research report.

Rules:
- Critique ONLY. Never rewrite the report.
- Be specific and evidence-based.

Respond in EXACTLY this structure:

OVERALL SCORE: X/10

SUB-SCORES:
- Factual Reliability: X/10
- Evidence Quality: X/10
- Source Quality: X/10
- Completeness: X/10
- Clarity: X/10

STRENGTHS:
- <bullet>

AREAS TO IMPROVE:
- <bullet>

MAJOR EVIDENCE PROBLEM:
<one paragraph or "None identified.">

RECOMMENDED IMPROVEMENT:
<one concrete suggestion>

VERDICT:
<one-line verdict>
""",
        ),
        ("human", "TOPIC: {topic}\n\nREPORT:\n{report}"),
    ]
)


def build_critic_chain():
    return CRITIC_PROMPT | _llm() | StrOutputParser()