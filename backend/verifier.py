"""Citation verification chain. Checks report claims against original evidence."""
from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from agents import _llm

VERIFIER_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a Citation Verifier. You will receive a research report
and the original evidence used to produce it.

Your job: verify that claims in the report are actually supported by the
evidence. For each significant claim, determine whether it is:

- SUPPORTED: The evidence directly and clearly supports the claim.
- PARTIALLY SUPPORTED: The evidence hints at the claim but is incomplete or indirect.
- UNSUPPORTED: The evidence does not contain the claim.
- CONTRADICTED: The evidence contradicts the claim.

For each claim, quote the exact snippet from the evidence that supports
(or fails to support) your verdict. Never invent snippets.

Respond in EXACTLY this structure:

CITATION REPORT

CLAIMS VERIFIED: N

VERDICT SUMMARY:
- Supported: N
- Partially Supported: N
- Unsupported: N
- Contradicted: N

DETAILED FINDINGS:
1. CLAIM: <claim text>
   VERDICT: <SUPPORTED|PARTIALLY_SUPPORTED|UNSUPPORTED|CONTRADICTED>
   EVIDENCE: <quoted snippet or "No matching evidence found.">

2. CLAIM: <claim text>
   VERDICT: <...>
   EVIDENCE: <...>

(continue for all claims)

UNSUPPORTED CLAIMS:
- <claim> (if any)

VERIFICATION SUMMARY:
<one paragraph summarizing the overall citation integrity of the report>
""",
        ),
        (
            "human",
            "REPORT:\n{report}\n\nORIGINAL EVIDENCE:\n{evidence}",
        ),
    ]
)


def build_verifier_chain():
    return VERIFIER_PROMPT | _llm() | StrOutputParser()