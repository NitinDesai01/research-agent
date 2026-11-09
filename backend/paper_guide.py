"""Paper Guide chain — turns a research report into paper-writing guidance."""
from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from agents import _llm

PAPER_GUIDE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a Paper Writing Coach. Produce a practical guide for turning this research into an academic paper. Use ONLY the supplied report and evidence.

Respond in EXACTLY this structure, and keep it brief:

PAPER TYPE:
Evaluate BOTH options below and explain which fits this specific topic better.
- Option A (Survey Paper): A comprehensive review of existing literature and current trends.
- Option B (Original Research): Proposing a new method, experiment, or novel analysis based on the gaps found in the evidence.

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
<How can the author turn this into original research? What is the missing experiment, dataset, or hypothesis they should test?>

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