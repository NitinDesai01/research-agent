/**
 * Renders the Paper Writing Guide — a structured set of sections that
 * help the user turn the research report into a paper.
 */
export default function PaperGuideView({ guide }) {
  if (!guide) {
    return <p style={{ color: "var(--text-muted)" }}>No guide available.</p>;
  }

  const sections = parseGuide(guide);

  return (
    <div className="paper-guide">
      {sections.map((s, i) => (
        <div className="pg-section" key={i}>
          <h4 className="pg-title">{s.title}</h4>
          {s.type === "paragraph" && (
            <p className="pg-paragraph">{s.body}</p>
          )}
          {s.type === "list" && (
            <ul className="pg-list">
              {s.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          )}
          {s.type === "outline" && (
            <ol className="pg-outline">
              {s.items.map((it, j) => (
                <li key={j}>
                  <strong>{it.heading}</strong>
                  {it.points.length > 0 && (
                    <ul>
                      {it.points.map((p, k) => (
                        <li key={k}>{p}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
          {s.type === "checklist" && (
            <ul className="pg-checklist">
              {s.items.map((it, j) => (
                <li key={j}>
                  <span className="pg-checkbox">☐</span>
                  {it}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/* -------------------- Parsing -------------------- */

function parseGuide(text) {
  const lines = text.split("\n");
  const out = [];
  let i = 0;

  const HEADERS = [
    "PAPER TYPE:",
    "SUGGESTED TITLE:",
    "ABSTRACT DRAFT:",
    "OUTLINE:",
    "KEY POINTS TO INCLUDE:",
    "FIGURES AND TABLES TO CREATE:",
    "NOVELTY ANGLE:",
    "TARGET VENUES:",
    "CITATION GAPS:",
    "COMMON PITFALLS TO AVOID:",
    "CHECKLIST BEFORE SUBMISSION:",
  ];

  while (i < lines.length) {
    const line = lines[i].trim();

    const header = HEADERS.find((h) => line.startsWith(h));
    if (!header) {
      i++;
      continue;
    }

    const title = header.replace(":", "");
    const nextIndex = findNextHeader(lines, i + 1, HEADERS);
    const block = lines.slice(i + 1, nextIndex).filter((l) => l.trim());
    i = nextIndex;

    // Detect type
    if (header === "OUTLINE:") {
      out.push({ title, type: "outline", items: parseOutline(block) });
    } else if (header === "CHECKLIST BEFORE SUBMISSION:") {
      out.push({
        title,
        type: "checklist",
        items: block
          .map((l) => l.replace(/^[-*\[\]x\s]+/, "").trim())
          .filter(Boolean),
      });
    } else if (block.some((l) => /^[-•*]/.test(l.trim()))) {
      out.push({
        title,
        type: "list",
        items: block
          .map((l) => l.trim().replace(/^[-•*]\s*/, ""))
          .filter(Boolean),
      });
    } else {
      out.push({
        title,
        type: "paragraph",
        body: block.map((l) => l.trim()).join(" "),
      });
    }
  }

  return out;
}

function findNextHeader(lines, from, headers) {
  for (let j = from; j < lines.length; j++) {
    const t = lines[j].trim();
    if (headers.some((h) => t.startsWith(h))) return j;
  }
  return lines.length;
}

function parseOutline(block) {
  const items = [];
  let current = null;

  for (const raw of block) {
    const line = raw.trim();
    const sectionMatch = line.match(/^\d+\.\s+(.+)/);
    if (sectionMatch) {
      if (current) items.push(current);
      current = { heading: sectionMatch[1].trim(), points: [] };
      continue;
    }
    const pointMatch = line.match(/^[-•*]\s+(.+)/);
    if (pointMatch && current) {
      current.points.push(pointMatch[1].trim());
    }
  }
  if (current) items.push(current);

  return items;
}