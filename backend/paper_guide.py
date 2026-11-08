"""Paper Guide chain — turns a research report into paper-writing guidance."""
from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from agents import _llm

PAPER_GUIDE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a Paper Writing Coach. Produce a practical guide for turning this research into an academic paper or survey paper. Use ONLY the supplied report and evidence.

Respond in EXACTLY this structure, and keep it brief:

PAPER TYPE:
<research paper | survey paper> - <one sentence why>

SUGGESTED TITLE:
<a concrete title>

ABSTRACT DRAFT:
<a 50-100 word abstract>

OUTLINE:
1. <Section name>
   - <point>
2. <Section name>
   - <point>
3. <Section name>
   - <point>

KEY POINTS TO INCLUDE:
- <claim from report>
- <claim from report>

NOVELTY ANGLE:
<one paragraph>

TARGET VENUES:
- <venue 1>
- <venue 2>

COMMON PITFALLS TO AVOID:
- <pitfall>
- <pitfall>
""",
        ),
        (
            "human",
            "TOPIC: {topic}\n\nREPORT:\n{report}\n\nEVIDENCE:\n{evidence}",
        ),
    ]
)


def build_paper_guide_chain():
    return PAPER_GUIDE_PROMPT | _llm() | StrOutputParser()