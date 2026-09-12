import { useState } from "react";

export default function TopicForm({ onSubmit, disabled }) {
  const [value, setValue] = useState("");

  const handle = (e) => {
    e.preventDefault();
    const t = value.trim();
    if (t && !disabled) onSubmit(t);
  };

  return (
    <form className="topic-form" onSubmit={handle}>
      <input
        type="text"
        placeholder="Enter a research topic… e.g. 'Impact of quantum computing on cryptography'"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        aria-label="Research topic"
      />
      <button type="submit" disabled={disabled || !value.trim()}>
        {disabled ? "Researching…" : "Research →"}
      </button>
    </form>
  );
}