import { forwardRef, useState } from "react";

const TopicForm = forwardRef(function TopicForm({ onSubmit, disabled }, ref) {
  const [value, setValue] = useState("");

  const handle = (e) => {
    e.preventDefault();
    const t = value.trim();
    if (t && !disabled) onSubmit(t);
  };

  return (
    <form className="topic-form" onSubmit={handle}>
      <input
        ref={ref}
        type="text"
        placeholder="What do you want to research today?"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        aria-label="Research topic"
      />
      <span className="kbd-hint">Ctrl K</span>
      <button type="submit" disabled={disabled || !value.trim()}>
        {disabled ? "Researching…" : "Research"}
        {!disabled && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </button>
    </form>
  );
});

export default TopicForm;
