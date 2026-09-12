export default function CritiqueView({ critique }) {
  const parsed = parseCritique(critique);

  return (
    <div className="scorecard">
      <div className="overall-score">
        <div className="score-number">{parsed.overall ?? "?"}</div>
        <div className="score-meta">
          <div className="score-out-of">/ 10</div>
          <div className="score-label">Overall Score</div>
        </div>
      </div>

      {parsed.subScores.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {parsed.subScores.map((s) => (
            <div className="subscore" key={s.label}>
              <span className="subscore-label">{s.label}</span>
              <div className="bar">
                <div
                  className="bar-fill"
                  style={{ width: `${(s.value / 10) * 100}%` }}
                />
              </div>
              <span className="subscore-value">{s.value}/10</span>
            </div>
          ))}
        </div>
      )}

      {parsed.strengths.length > 0 && (
        <div className="critique-section">
          <h4>Strengths</h4>
          <ul className="critique-list">
            {parsed.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {parsed.improvements.length > 0 && (
        <div className="critique-section">
          <h4>Areas to Improve</h4>
          <ul className="critique-list">
            {parsed.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {parsed.majorProblem && (
        <div className="critique-section">
          <h4>Major Evidence Problem</h4>
          <p>{parsed.majorProblem}</p>
        </div>
      )}

      {parsed.recommendation && (
        <div className="critique-section">
          <h4>Recommended Improvement</h4>
          <p>{parsed.recommendation}</p>
        </div>
      )}

      {parsed.verdict && <div className="verdict">"{parsed.verdict}"</div>}
    </div>
  );
}

/* Parsing logic unchanged from previous version */
function parseCritique(text) {
  const out = {
    overall: null,
    subScores: [],
    strengths: [],
    improvements: [],
    majorProblem: "",
    recommendation: "",
    verdict: "",
  };
  if (!text) return out;

  const overallMatch = text.match(
    /OVERALL SCORE:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i,
  );
  if (overallMatch) out.overall = parseFloat(overallMatch[1]);

  const subBlock = section(text, "SUB-SCORES:", [
    "STRENGTHS:",
    "AREAS TO IMPROVE:",
    "MAJOR EVIDENCE PROBLEM:",
    "RECOMMENDED IMPROVEMENT:",
    "VERDICT:",
  ]);
  if (subBlock) {
    const re = /[-•*]\s*([^:\n]+):\s*(\d+(?:\.\d+)?)\s*\/\s*10/gi;
    let m;
    while ((m = re.exec(subBlock)) !== null) {
      out.subScores.push({ label: m[1].trim(), value: parseFloat(m[2]) });
    }
  }

  out.strengths = bullets(
    section(text, "STRENGTHS:", [
      "AREAS TO IMPROVE:",
      "MAJOR EVIDENCE PROBLEM:",
      "RECOMMENDED IMPROVEMENT:",
      "VERDICT:",
    ]),
  );

  out.improvements = bullets(
    section(text, "AREAS TO IMPROVE:", [
      "MAJOR EVIDENCE PROBLEM:",
      "RECOMMENDED IMPROVEMENT:",
      "VERDICT:",
    ]),
  );

  out.majorProblem = (
    section(text, "MAJOR EVIDENCE PROBLEM:", [
      "RECOMMENDED IMPROVEMENT:",
      "VERDICT:",
    ]) || ""
  ).trim();

  out.recommendation = (
    section(text, "RECOMMENDED IMPROVEMENT:", ["VERDICT:"]) || ""
  ).trim();
  out.verdict = (section(text, "VERDICT:", []) || "").trim();

  return out;
}

function section(text, startLabel, endLabels) {
  const start = text.indexOf(startLabel);
  if (start === -1) return null;
  let body = text.slice(start + startLabel.length);
  let endIdx = body.length;
  for (const lbl of endLabels) {
    const i = body.indexOf(lbl);
    if (i !== -1 && i < endIdx) endIdx = i;
  }
  return body.slice(0, endIdx);
}

function bullets(block) {
  if (!block) return [];
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-•*]\s+/.test(l))
    .map((l) => l.replace(/^[-•*]\s+/, "").trim())
    .filter(Boolean);
}
