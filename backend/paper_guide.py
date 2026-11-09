"""Paper Guide chain — turns a research report into paper-writing guidance."""
from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from agents import _llm

PAPER_GUIDE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a Paper Writing Coach. Produce a practical guide for turning this research into an academic paper.

You MUST provide BOTH options for the paper type, exactly as shown below. Do not choose just one. Then provide the rest of the guide.

Respond in EXACTLY this structure:

PAPER TYPE:
- Survey Paper: <Explain how this topic could be turned into a survey paper (reviewing existing work).>
- Original Research: <Explain how this topic could be turned into original research (a new experiment, dataset, or method).>

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
<What is the missing experiment or dataset? How can the author test this?>

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