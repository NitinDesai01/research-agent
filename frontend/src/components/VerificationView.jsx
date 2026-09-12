export default function VerificationView({ verification }) {
  if (!verification) {
    return <p style={{ color: "var(--muted)" }}>No verification available.</p>;
  }

  const lines = verification.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("CITATION REPORT")) {
      elements.push(
        <h4 key={i} style={{ color: "var(--accent-2)", margin: "0 0 0.5em" }}>
          Citation Report
        </h4>
      );
      i++;
      continue;
    }

    if (line.startsWith("CLAIMS VERIFIED:")) {
      elements.push(
        <p key={i} style={{ fontWeight: 600, color: "var(--text)" }}>
          {line}
        </p>
      );
      i++;
      continue;
    }

    if (line.startsWith("VERDICT SUMMARY:")) {
      elements.push(<h4 key={i}>Verdict Summary</h4>);
      i++;
      const summaryItems = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].startsWith("DETAILED")
      ) {
        if (lines[i].startsWith("-")) {
          summaryItems.push(<li key={i}>{lines[i].slice(1).trim()}</li>);
        }
        i++;
      }
      if (summaryItems.length) {
        elements.push(<ul key={`verdict-summary-${i}`}>{summaryItems}</ul>);
      }
      continue;
    }

    if (line.startsWith("DETAILED FINDINGS:")) {
      elements.push(<h4 key={i}>Detailed Findings</h4>);
      i++;
      continue;
    }

    if (/^\d+\.\s*CLAIM:/.test(line)) {
      elements.push(
        <p
          key={i}
          style={{
            fontWeight: 600,
            color: "var(--text)",
            marginTop: "1em",
          }}
        >
          {line}
        </p>
      );
      i++;
      continue;
    }

    if (line.startsWith("VERDICT:")) {
      const verdict = line.replace("VERDICT:", "").trim();
      const color =
        verdict === "SUPPORTED"
          ? "var(--good)"
          : verdict === "UNSUPPORTED" || verdict === "CONTRADICTED"
          ? "var(--danger)"
          : "var(--warn)";
      elements.push(
        <p
          key={i}
          style={{ color, fontWeight: 600, fontSize: "0.85rem" }}
        >
          {verdict}
        </p>
      );
      i++;
      continue;
    }

    if (line.startsWith("EVIDENCE:")) {
      elements.push(
        <p
          key={i}
          style={{
            fontStyle: "italic",
            color: "var(--muted)",
            fontSize: "0.85rem",
          }}
        >
          {line}
        </p>
      );
      i++;
      continue;
    }

    if (line.startsWith("UNSUPPORTED CLAIMS:")) {
      elements.push(
        <h4 key={i} style={{ color: "var(--danger)" }}>
          Unsupported Claims
        </h4>
      );
      i++;
      continue;
    }

    if (line.startsWith("VERIFICATION SUMMARY:")) {
      elements.push(<h4 key={i}>Verification Summary</h4>);
      i++;
      continue;
    }

    if (line.trim()) {
      elements.push(<p key={i}>{line}</p>);
    }
    i++;
  }

  return <div className="verification-body">{elements}</div>;
}