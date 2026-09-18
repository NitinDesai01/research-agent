import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useRef, useState } from "react";
import TableOfContents from "./TableOfContents.jsx";

export default function ReportView({
  report,
  topic,
  onToast,
  streaming = false,
  verification = "",
  onSave,
}) {
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef(null);

  /* ---------------- Toolbar actions ---------------- */

  const downloadMd = () => {
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-report-${slug(topic)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onToast?.("Markdown downloaded", "success");
  };

  const copyMd = async () => {
    try {
      await navigator.clipboard.writeText(report);
      onToast?.("Report copied to clipboard", "success");
    } catch {
      onToast?.("Copy failed — try again", "error");
    }
  };

  const printPdf = () => {
    window.print();
    onToast?.("Opening print dialog", "info");
  };

  const shareReport = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("topic", topic);
    navigator.clipboard
      .writeText(url.toString())
      .then(() => onToast?.("Share link copied", "success"))
      .catch(() => onToast?.("Could not copy link", "error"));
  };

  const toggleSpeak = () => {
    if (!("speechSynthesis" in window)) {
      onToast?.("Speech not supported in this browser", "error");
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const plainText = report
      .replace(/^#+\s*/gm, "")
      .replace(/[*_`>]/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .slice(0, 6000);

    const u = new SpeechSynthesisUtterance(plainText);
    u.rate = 1;
    u.pitch = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utterRef.current = u;

    window.speechSynthesis.speak(u);
    setSpeaking(true);
    onToast?.("Reading report aloud", "info");
  };

  /* ---------------- Heatmap ---------------- */

  const claims = useMemo(
    () => (verification ? parseClaims(verification) : []),
    [verification],
  );

  const heatmapped = useMemo(
    () => (claims.length ? buildHeatmap(report, claims) : null),
    [report, claims],
  );

  /* ---------------- TOC support ---------------- */

  const reportWithIds = useMemo(() => {
    return (report || "").replace(/^##\s+(.+)$/gm, (_, title) => {
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      return `## ${title} {#${id}}`;
    });
  }, [report]);

  const cleanReport = useMemo(
    () => reportWithIds.replace(/\s*\{#[a-z0-9-]+\}/g, ""),
    [reportWithIds],
  );

  /* ---------------- Render ---------------- */

  return (
    <div className="report-layout">
      {!streaming && cleanReport && <TableOfContents report={cleanReport} />}

      <div className="report-main">
        <div className="report-toolbar">
          {!streaming && (
            <>
              <button type="button" className="tool-btn" onClick={toggleSpeak}>
                {speaking ? (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    Stop
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 5 6 9H2v6h4l5 4z" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                    Speak
                  </>
                )}
              </button>

              <button type="button" className="tool-btn" onClick={copyMd}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </button>

              <button type="button" className="tool-btn" onClick={downloadMd}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Markdown
              </button>

              <button type="button" className="tool-btn" onClick={printPdf}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <path d="M6 14h12v8H6z" />
                </svg>
                PDF
              </button>

              <button type="button" className="tool-btn" onClick={shareReport}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
                </svg>
                Share
              </button>

              {onSave && (
                <button type="button" className="tool-btn" onClick={onSave}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <path d="M17 21v-8H7v8M7 3v5h8" />
                  </svg>
                  Save
                </button>
              )}
            </>
          )}
        </div>

        {heatmapped ? (
          <div className="report-body with-heatmap">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children }) => {
                  const text = extractText(children);
                  const id = text
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .trim()
                    .replace(/\s+/g, "-");
                  return <h2 id={id}>{children}</h2>;
                },
                p: ({ children }) => {
                  const text = extractText(children);
                  const verdict = heatmapped[text];
                  const cls = verdict ? `sentence-${verdict}` : "";
                  return (
                    <p
                      className={cls}
                      title={verdict ? `Verdict: ${verdict}` : ""}
                    >
                      {children}
                    </p>
                  );
                },
              }}
            >
              {cleanReport}
            </ReactMarkdown>
          </div>
        ) : (
          <div className={`report-body ${streaming ? "streaming" : ""}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children }) => {
                  const text = extractText(children);
                  const id = text
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, "")
                    .trim()
                    .replace(/\s+/g, "-");
                  return <h2 id={id}>{children}</h2>;
                },
              }}
            >
              {cleanReport}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   Helpers
   ========================================================= */

function slug(s) {
  return (s || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function extractText(children) {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children?.props?.children) return extractText(children.props.children);
  return "";
}

function parseClaims(verification) {
  const claims = [];
  const lines = verification.split("\n");
  let currentClaim = null;

  for (const line of lines) {
    const claimMatch = line.match(/^\d+\.\s*CLAIM:\s*(.+)/);
    if (claimMatch) {
      if (currentClaim) claims.push(currentClaim);
      currentClaim = { claim: claimMatch[1].trim(), verdict: "unknown" };
      continue;
    }
    if (!currentClaim) continue;

    const verdictMatch = line.match(/VERDICT:\s*(\w+)/);
    if (verdictMatch) {
      currentClaim.verdict = verdictMatch[1].toUpperCase().replace(/_/g, " ");
    }
  }
  if (currentClaim) claims.push(currentClaim);
  return claims;
}

function buildHeatmap(report, claims) {
  const map = {};
  const paragraphs = report.split(/\n{2,}/);

  for (const para of paragraphs) {
    const cleanPara = para.trim();
    if (!cleanPara || cleanPara.startsWith("#")) continue;

    for (const { claim, verdict } of claims) {
      const claimWords = claim.toLowerCase().split(/\W+/).filter(Boolean);
      const paraLower = cleanPara.toLowerCase();
      const hits = claimWords.filter((w) => paraLower.includes(w));
      if (claimWords.length > 0 && hits.length / claimWords.length >= 0.6) {
        map[cleanPara] = verdict.toLowerCase().replace(/\s+/g, "-");
        break;
      }
    }
  }
  return map;
}
