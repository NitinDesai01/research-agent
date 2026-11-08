import { useState, useCallback, useEffect, useRef } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";
import confetti from "canvas-confetti";
import TopicForm from "./components/TopicForm.jsx";
import PipelineStepper from "./components/PipelineStepper.jsx";
import ReportView from "./components/ReportView.jsx";
import CritiqueView from "./components/CritiqueView.jsx";
import SourcesView from "./components/SourcesView.jsx";
import VerificationView from "./components/VerificationView.jsx";
import PaperGuideView from "./components/PaperGuideView.jsx";
import Panel from "./components/Panel.jsx";
import TopBar from "./components/TopBar.jsx";
import Toast from "./components/Toast.jsx";
import History from "./components/History.jsx";
import AuroraBackground from "./components/AuroraBackground.jsx";
import GameAgent from "./components/GameAgent.jsx";
import Sidebar from "./components/Sidebar.jsx";
import FollowUpChat from "./components/FollowUpChat.jsx";
import TopicSuggestions from "./components/TopicSuggestions.jsx";
import SkeletonPanel from "./components/SkeletonPanel.jsx";
import { sounds, warmup } from "./components/SoundManager.jsx";

const STAGES = [
  "searching",
  "reading",
  "writing",
  "verifying",
  "critiquing",
  "guiding",
  "done",
];

const STAGE_LABELS = {
  searching: "Search",
  reading: "Read",
  writing: "Write",
  verifying: "Verify",
  critiquing: "Critique",
  guiding: "Guide",
  done: "Done",
};

const API_BASE = import.meta.env.VITE_API_URL || "";
const HISTORY_KEY = "research_history_v1";
const SOUND_KEY = "research_sound_enabled";
const MAX_HISTORY = 10;

export default function App() {
  const { getToken, isSignedIn } = useAuth();

  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState(null);
  const [completed, setCompleted] = useState({});
  const [result, setResult] = useState(null);
  const [streamedReport, setStreamedReport] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [errors, setErrors] = useState([]);
  const [history, setHistory] = useState(() => loadHistory());
  const [toasts, setToasts] = useState([]);
  const [cameFromCache, setCameFromCache] = useState(false);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);

  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(SOUND_KEY);
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    try {
      localStorage.setItem(SOUND_KEY, String(soundEnabled));
    } catch {
      /* ignore */
    }
  }, [soundEnabled]);

  const toggleSound = () => setSoundEnabled((s) => !s);

  const playSound = useCallback(
    (name) => {
      if (!soundEnabled) return;
      try {
        sounds[name]?.();
      } catch {
        /* ignore */
      }
    },
    [soundEnabled],
  );

  const inputRef = useRef(null);

  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("theme");
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const pushToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") inputRef.current?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addToHistory = useCallback((t) => {
    setHistory((h) => {
      const filtered = h.filter((x) => x.toLowerCase() !== t.toLowerCase());
      const next = [t, ...filtered].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
    pushToast("History cleared", "info");
  }, [pushToast]);

  const reset = () => {
    setCurrentStage(null);
    setCompleted({});
    setResult(null);
    setStreamedReport("");
    setStreaming(false);
    setErrors([]);
    setCameFromCache(false);
  };

  const handleEvent = useCallback(
    (evt) => {
      const { stage, status } = evt;

      if (stage === "cached") {
        setResult(evt.result);
        setCameFromCache(true);
        setCompleted({
          searching: true,
          reading: true,
          writing: true,
          verifying: true,
          critiquing: true,
          guiding: true,
          done: true,
        });
        setCurrentStage("done");
        pushToast("Loaded from cache", "success");
        playSound("done");
        return;
      }

      if (stage === "final") {
        setResult(evt.result);
        setStreaming(false);

        const score = parseCriticScore(evt.result?.critique || "");
        if (score !== null && score >= 8) {
          fireConfetti();
          pushToast(`Excellent score: ${score}/10`, "success");
        } else if (evt.result?.errors?.length) {
          setErrors((e) => [...e, ...evt.result.errors]);
          pushToast(
            `Completed with ${evt.result.errors.length} warning(s)`,
            "info",
          );
        } else {
          pushToast("Research complete", "success");
        }
        return;
      }

      if (stage === "fatal") {
        setErrors((e) => [...e, evt.message || "Fatal error"]);
        pushToast("Pipeline failed", "error");
        playSound("error");
        return;
      }

      if (stage === "error") {
        setErrors((e) => [...e, evt.message || "Pipeline error"]);
        playSound("error");
        return;
      }

      if (stage === "writing" && status === "streaming") {
        setStreaming(true);
        setStreamedReport((r) => r + (evt.chunk || ""));
        return;
      }

      if (status === "running") {
        setCurrentStage(stage);
        return;
      }

      if (status === "done") {
        setCompleted((c) => ({ ...c, [stage]: true }));
        setCurrentStage(stage === "done" ? "done" : stage);

        if (stage === "searching") playSound("search");
        else if (stage === "reading") playSound("read");
        else if (stage === "writing") playSound("write");
        else if (stage === "verifying") playSound("verify");
        else if (stage === "critiquing") playSound("critique");
        else if (stage === "guiding") playSound("verify");
        else if (stage === "done") playSound("done");
      }
    },
    [pushToast, playSound],
  );

  const runPipeline = useCallback(
    async (t) => {
      reset();
      setRunning(true);
      addToHistory(t);

      try {
        const resp = await fetch(`${API_BASE}/research/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: t }),
        });

        if (resp.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        if (!resp.ok || !resp.body) {
          throw new Error(`Request failed: ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop();

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            try {
              handleEvent(JSON.parse(json));
            } catch {
              /* ignore malformed chunk */
            }
          }
        }
      } catch (err) {
        const msg = String(err.message || err);
        setErrors((e) => [...e, msg]);
        pushToast(msg, "error");
        playSound("error");
      } finally {
        setRunning(false);
      }
    },
    [addToHistory, handleEvent, pushToast, playSound],
  );

  const handleSubmit = useCallback(
    (t) => {
      warmup();
      setTopic(t);
      runPipeline(t);
    },
    [runPipeline],
  );

  // Auto-run if ?topic= is in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTopic = params.get("topic");
    if (urlTopic) {
      window.history.replaceState({}, "", window.location.pathname);
      handleSubmit(urlTopic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveReport = async () => {
    if (!isSignedIn) {
      pushToast("Sign in to save reports", "info");
      return;
    }
    if (!result?.report) return;
    try {
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: result.topic,
          report: result.report,
          critique: result.critique || "",
          verification: result.verification || "",
          sources: result.sources || [],
        }),
      });
      if (!resp.ok) throw new Error(`Save failed: ${resp.status}`);
      pushToast("Report saved", "success");
      setSidebarRefresh((n) => n + 1);
    } catch (err) {
      pushToast(String(err.message || err), "error");
    }
  };

  const openSavedReport = (saved) => {
    reset();
    setTopic(saved.topic);
    setResult({
      topic: saved.topic,
      report: saved.report,
      critique: saved.critique,
      verification: saved.verification,
      paper_guide: "",
      sources: saved.sources || [],
      errors: [],
      reader_notes: "",
    });
    setCompleted({
      searching: true,
      reading: true,
      writing: true,
      verifying: true,
      critiquing: true,
      guiding: true,
      done: true,
    });
    setCurrentStage("done");
    pushToast("Loaded saved report", "success");
  };

  return (
    <>
      <AuroraBackground />

      <div className="app-shell">
        <SignedIn>
          <Sidebar onOpen={openSavedReport} refreshKey={sidebarRefresh} />
        </SignedIn>

        <div className="app-main">
          <div className="app">
            <TopBar
              theme={theme}
              onToggleTheme={toggleTheme}
              soundEnabled={soundEnabled}
              onToggleSound={toggleSound}
              rightSlot={
                <>
                  <SignedOut>
                    <SignInButton mode="modal">
                      <button type="button" className="sign-in-btn">
                        Sign in
                      </button>
                    </SignInButton>
                  </SignedOut>
                  <SignedIn>
                    <UserButton afterSignOutUrl="/" />
                  </SignedIn>
                </>
              }
            />

            <section className="hero">
              <span className="hero-badge">Multi-agent pipeline</span>
              <h1>
                <span className="gradient">Research Agent</span>
              </h1>
              <p>
                Search <span className="inline-icon">→</span> Reader
                <span className="inline-icon">→</span> Writer
                <span className="inline-icon">→</span> Verifier
                <span className="inline-icon">→</span> Critic
                <span className="inline-icon">→</span> Guide
                <br />
                Specialized AI agents collaborate to build, verify, and score a
                research report on any topic.
              </p>
            </section>

            <TopicForm
              ref={inputRef}
              onSubmit={handleSubmit}
              disabled={running}
            />

            {!running && !result && (
              <TopicSuggestions onSelect={handleSubmit} disabled={running} />
            )}

            {history.length > 0 && !running && !result && (
              <History
                items={history}
                onSelect={handleSubmit}
                onClear={clearHistory}
              />
            )}

            {currentStage && (
              <PipelineStepper
                stages={STAGES}
                labels={STAGE_LABELS}
                current={currentStage}
                completed={completed}
              />
            )}

            {running && <GameAgent />}

            {running && !streamedReport && (
              <>
                <SkeletonPanel title="Searching sources…" />
                <SkeletonPanel title="Reading and extracting…" />
              </>
            )}

            {errors.length > 0 && (
              <div className="errors">
                <strong>Pipeline warnings</strong>
                <ul>
                  {errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {streaming && streamedReport && (
              <Panel
                title="Research Report"
                icon="document"
                meta="writing…"
                defaultOpen
              >
                <ReportView
                  report={streamedReport}
                  topic={topic}
                  onToast={pushToast}
                  streaming
                />
              </Panel>
            )}

            {result?.report && !streaming && (
              <Panel
                title="Research Report"
                icon="document"
                meta={
                  cameFromCache
                    ? "cached"
                    : `${readingTime(result.report)} min read`
                }
                defaultOpen
              >
                <ReportView
                  report={result.report}
                  topic={result.topic}
                  onToast={pushToast}
                  verification={result.verification}
                  onSave={saveReport}
                />
              </Panel>
            )}

            {result?.report && (
              <Panel title="Ask a Follow-Up" icon="notes" defaultOpen={false}>
                <FollowUpChat topic={result.topic} report={result.report} />
              </Panel>
            )}

            {result?.verification && (
              <Panel title="Citation Verification" icon="shield" defaultOpen>
                <VerificationView verification={result.verification} />
              </Panel>
            )}

            {/* CRITIC SCORECARD ADDED BACK IN */}
            {result && (
              <Panel title="Critic Scorecard" icon="target" defaultOpen={true}>
                {result.critique ? (
                  <CritiqueView critique={result.critique} />
                ) : (
                  <p style={{ color: "var(--danger)" }}>
                    Critic Scorecard failed to generate. Check backend terminal
                    for 429 Rate Limit errors.
                  </p>
                )}
              </Panel>
            )}

            {result && (
              <Panel
                title="How to Write This Paper"
                icon="notes"
                defaultOpen={true}
              >
                {result.paper_guide ? (
                  <PaperGuideView guide={result.paper_guide} />
                ) : (
                  <p style={{ color: "var(--danger)" }}>
                    Paper guide failed to generate. Check backend terminal for
                    429 Rate Limit errors.
                  </p>
                )}
              </Panel>
            )}

            {result?.sources?.length > 0 && (
              <Panel
                title="Sources"
                icon="link"
                meta={`${result.sources.length} references`}
                defaultOpen={false}
              >
                <SourcesView sources={result.sources} />
              </Panel>
            )}

            {result?.reader_notes && (
              <Panel title="Reader Notes" icon="notes" defaultOpen={false}>
                <div className="notes">{result.reader_notes}</div>
              </Panel>
            )}

            <div className="footer">
              Built with FastAPI, LangChain, Groq &amp; Tavily ·{" "}
              <a
                href="https://github.com/NitinDesai01/research-agent"
                target="_blank"
                rel="noreferrer"
              >
                View source
              </a>
            </div>
          </div>
        </div>
      </div>

      <Toast toasts={toasts} />
    </>
  );
}

/* ---------------- Helpers ---------------- */

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function readingTime(md) {
  const words = (md || "").split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

function parseCriticScore(critique) {
  const m = critique.match(/OVERALL SCORE:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i);
  return m ? parseFloat(m[1]) : null;
}

function fireConfetti() {
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 },
    colors: ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981"],
    disableForReducedMotion: true,
  });
}
