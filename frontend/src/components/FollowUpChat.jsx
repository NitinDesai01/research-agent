import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function FollowUpChat({ topic, report }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const q = input.trim();
    if (!q || sending) return;

    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setSending(true);

    try {
      const resp = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, report, question: q }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setMessages((m) => [...m, { role: "assistant", text: data.answer }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `Error: ${err.message}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">
            Ask a follow-up question about this report.
            <br />
            <em>Answers use only the existing evidence — no new searches.</em>
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {sending && <div className="chat-bubble assistant">…</div>}
      </div>
      <div className="chat-input-row">
        <input
          type="text"
          placeholder="Ask a question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={sending}
        />
        <button type="button" onClick={send} disabled={sending || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}