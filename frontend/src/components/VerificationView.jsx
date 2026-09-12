export default function VerificationView({ verification }) {
  if (!verification) {
    return (
      <p style={{ color: "var(--text-muted)" }}>No verification available.</p>
    );
  }

  const lines = verification.split("\n");
  const elements = [];
  let i = 0;

  const renderVerdict = (verdict, key) => {
    const v = verdict.toUpperCase();
    let cls = "partial";
    if (v === "SUPPORTED") cls = "supported";
    else if (v === "UNSUPPORTED" || v === "CONTRADICTED") cls = "unsupported";
    return (
      <span key={key} className={`verdict-pill ${cls}`}>
        {verdict}
      </span>
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("CITATION REPORT")) {
      i++;
      continue;
    }

    if (line.startsWith("CLAIMS VERIFIED:")) {
      elements.push(
        <p
          key={i}
          style={{ fontWeight: 600, color: "var(--text)", marginBottom: "1em" }}
        >
          {line}
        </p>,
      );
      i++;
      continue;
    }

    if (line.startsWith("VERDICT SUMMARY:")) {
      elements.push(<h4 key={i}>Verdict Summary</h4>);
      i++;
      const items = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].startsWith("DETAILED")
      ) {
        if (lines[i].startsWith("-")) {
          items.push(<li key={i}>{lines[i].slice(1).trim()}</li>);
        }
        i++;
      }
      if (items.length) elements.push(<ul key={`vs-${i}`}>{items}</ul>);
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
            marginTop: "1.2em",
            marginBottom: "0.4em",
          }}
        >
          {line}
        </p>,
      );
      i++;
      continue;
    }

    if (line.startsWith("VERDICT:")) {
      const v = line.replace("VERDICT:", "").trim();
      elements.push(
        <div key={i} style={{ marginBottom: "0.6em" }}>
          {renderVerdict(v, `v-${i}`)}
        </div>,
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
            color: "var(--text-muted)",
            fontSize: "0.88rem",
            marginBottom: "0.6em",
          }}
        >
          {line}
        </p>,
      );
      i++;
      continue;
    }

    if (line.startsWith("UNSUPPORTED CLAIMS:")) {
      elements.push(
        <h4 key={i} style={{ color: "var(--danger)" }}>
          Unsupported Claims
        </h4>,
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
