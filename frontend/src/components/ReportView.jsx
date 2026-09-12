import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ReportView({ report, topic, onToast }) {
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

  return (
    <div>
      <div className="report-toolbar">
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
      </div>
      <div className="report-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
      </div>
    </div>
  );
}

function slug(s) {
  return (s || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
