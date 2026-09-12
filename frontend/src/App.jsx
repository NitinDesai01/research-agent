import { useState, useCallback } from "react";
import TopicForm from "./components/TopicForm.jsx";
import PipelineStepper from "./components/PipelineStepper.jsx";
import ReportView from "./components/ReportView.jsx";
import CritiqueView from "./components/CritiqueView.jsx";
import SourcesView from "./components/SourcesView.jsx";
import VerificationView from "./components/VerificationView.jsx";
import Panel from "./components/Panel.jsx";

const STAGES = ["searching", "reading", "writing", "verifying", "critiquing", "done"];
const STAGE_LABELS = {
  searching: "Search",
  reading: "Read",
  writing: "Write",
  verifying: "Verify",
  critiquing: "Critique",
  done: "Done",
};

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState(null);
  const [completed, setCompleted] = useState({});
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);

  const reset = () => {
    setCurrentStage(null);
    setCompleted({});
    setResult(null);
    setErrors([]);
  };

  const handleEvent = useCallback((evt) => {
    const { stage, status } = evt;

    if (stage === "cached") {
      setResult(evt.result);
      setCompleted({
        searching: true,
        reading: true,
        writing: true,
        verifying: true,
        critiquing: true,
        done: true,
      });
      setCurrentStage("done");
      return;
    }
    if (stage === "final") {
      setResult(evt.result);
      if (evt.result?.errors?.length) {
        setErrors((e) => [...e, ...evt.result.errors]);
      }
      return;
    }
    if (stage === "fatal") {
      setErrors((e) => [...e, evt.message || "Fatal error"]);
      return;
    }
    if (stage === "error") {
      setErrors((e) => [...e, evt.message || "Pipeline error"]);
      return;
    }

    if (status === "running") setCurrentStage(stage);
    if (status === "done") {
      setCompleted((c) => ({ ...c, [stage]: true }));
      setCurrentStage(stage === "done" ? "done" : stage);
    }
  }, []);

  const runPipeline = useCallback(
    async (t) => {
      reset();
      setRunning(true);

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
        setErrors((e) => [...e, String(err.message || err)]);
      } finally {
        setRunning(false);
      }
    },
    [handleEvent]
  );

  const handleSubmit = (t) => {
    setTopic(t);
    runPipeline(t);
  };

  return (
    <div className="app">
      <div className="header">
        <span className="badge">Multi-Agent Pipeline</span>
        <h1>
          <span className="grad">Research Agent</span>
        </h1>
        <p>
          Search → Reader → Writer → Verifier → Critic. Specialized agents
          collaborate to build, verify, and score a research report on any topic.
        </p>
      </div>

      <TopicForm onSubmit={handleSubmit} disabled={running} />

      {currentStage && (
        <PipelineStepper
          stages={STAGES}
          labels={STAGE_LABELS}
          current={currentStage}
          completed={completed}
        />
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

      {result?.report && (
        <Panel title="Research Report" defaultOpen>
          <ReportView report={result.report} topic={result.topic} />
        </Panel>
      )}

      {result?.verification && (
        <Panel title="Citation Verification" defaultOpen>
          <VerificationView verification={result.verification} />
        </Panel>
      )}

      {result?.critique && (
        <Panel title="Critic Scorecard" defaultOpen>
          <CritiqueView critique={result.critique} />
        </Panel>
      )}

      {result?.sources?.length > 0 && (
        <Panel title="Sources" defaultOpen={false}>
          <SourcesView sources={result.sources} />
        </Panel>
      )}

      {result?.reader_notes && (
        <Panel title="Reader Notes" defaultOpen={false}>
          <div className="notes">{result.reader_notes}</div>
        </Panel>
      )}
    </div>
  );
}