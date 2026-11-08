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
          {s.type === "paragraph" && <p className="pg-paragraph">{s.body}</p>}
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
    "NOVELTY ANGLE:",
    "TARGET VENUES:",
    "COMMON PITFALLS TO AVOID:",
  ];

  while (i < lines.length) {
    const rawLine = lines[i].trim();
    // Strip markdown asterisks so "**PAPER TYPE:**" becomes "PAPER TYPE:"
    const cleanLine = rawLine.replace(/\*\*|__/g, "").toUpperCase();

    const header = HEADERS.find((h) => cleanLine.startsWith(h));
    if (!header) {
      i++;
      continue;
    }

    const title = header.replace(":", "");

    let nextIndex = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const nextClean = lines[j]
        .trim()
        .replace(/\*\*|__/g, "")
        .toUpperCase();
      if (HEADERS.some((h) => nextClean.startsWith(h))) {
        nextIndex = j;
        break;
      }
    }

    const block = lines.slice(i + 1, nextIndex).filter((l) => l.trim());
    i = nextIndex;

    if (header === "OUTLINE:") {
      out.push({ title, type: "outline", items: parseOutline(block) });
    } else if (
      block.some((l) => /^[-•*]/.test(l.trim()) || /^\d+\./.test(l.trim()))
    ) {
      out.push({
        title,
        type: "list",
        items: block
          .map((l) =>
            l
              .trim()
              .replace(/^[-•*]\s*/, "")
              .replace(/^\d+\.\s*/, "")
              .replace(/\*\*/g, ""),
          )
          .filter(Boolean),
      });
    } else {
      out.push({
        title,
        type: "paragraph",
        // Strip asterisks from paragraphs too
        body: block.map((l) => l.trim().replace(/\*\*/g, "")).join(" "),
      });
    }
  }

  return out;
}

function parseOutline(block) {
  const items = [];
  let current = null;

  for (const raw of block) {
    const line = raw.trim().replace(/\*\*/g, ""); // Strip asterisks in outline
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
