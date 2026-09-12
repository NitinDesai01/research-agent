import { useState, useCallback, useEffect, useRef } from "react";
import TopicForm from "./components/TopicForm.jsx";
import PipelineStepper from "./components/PipelineStepper.jsx";
import ReportView from "./components/ReportView.jsx";
import CritiqueView from "./components/CritiqueView.jsx";
import SourcesView from "./components/SourcesView.jsx";
import VerificationView from "./components/VerificationView.jsx";
import Panel from "./components/Panel.jsx";
import TopBar from "./components/TopBar.jsx";
import Toast from "./components/Toast.jsx";
import History from "./components/History.jsx";
import AuroraBackground from "./components/AuroraBackground.jsx";
import GameAgent from "./components/GameAgent.jsx";
import { sounds, warmup } from "./components/SoundManager.jsx";

const STAGES = [
  "searching",
  "reading",
  "writing",
  "verifying",
  "critiquing",
  "done",
];
const STAGE_LABELS = {
  searching: "Search",
  reading: "Read",
  writing: "Write",
  verifying: "Verify",
  critiquing: "Critique",
  done: "Done",
};

const API_BASE = import.meta.env.VITE_API_URL || "";
const HISTORY_KEY = "research_history_v1";
const SOUND_KEY = "research_sound_enabled";
const MAX_HISTORY = 10;

export default function App() {
  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState(null);
  const [completed, setCompleted] = useState({});
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [history, setHistory] = useState(() => loadHistory());
  const [toasts, setToasts] = useState([]);
  const [cameFromCache, setCameFromCache] = useState(false);

  /* Sound state */
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

  /* Theme */
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

  /* Toasts */
  const pushToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  /* Keyboard shortcuts */
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

  /* History */
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

  /* Pipeline state */
  const reset = () => {
    setCurrentStage(null);
    setCompleted({});
    setResult(null);
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
          done: true,
        });
        setCurrentStage("done");
        pushToast("Loaded from cache", "success");
        playSound("done");
        return;
      }

      if (stage === "final") {
        setResult(evt.result);
        if (evt.result?.errors?.length) {
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
        else if (stage === "done") playSound("done");
      }
    },
    [pushToast, playSound],
  );

  /* Run pipeline */
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

  const handleSubmit = (t) => {
    // Unlock audio on this user gesture
    warmup();
    setTopic(t);
    runPipeline(t);
  };

  return (
    <>
      <AuroraBackground />

      <div className="app">
        <TopBar
          theme={theme}
          onToggleTheme={toggleTheme}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
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
            <br />
            Specialized AI agents collaborate to build, verify, and score a
            research report on any topic.
          </p>
        </section>

        <TopicForm ref={inputRef} onSubmit={handleSubmit} disabled={running} />

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

        {result?.report && (
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
            />
          </Panel>
        )}

        {result?.verification && (
          <Panel title="Citation Verification" icon="shield" defaultOpen>
            <VerificationView verification={result.verification} />
          </Panel>
        )}

        {result?.critique && (
          <Panel title="Critic Scorecard" icon="target" defaultOpen>
            <CritiqueView critique={result.critique} />
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

      <Toast toasts={toasts} />
    </>
  );
}

/* ------------------ Helpers ------------------ */
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
