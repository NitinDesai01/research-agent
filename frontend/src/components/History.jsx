export default function History({ items, onSelect, onClear }) {
  return (
    <div className="history">
      <div className="history-label">Recent</div>
      {items.map((t, i) => (
        <button
          key={i}
          type="button"
          className="history-chip"
          onClick={() => onSelect(t)}
          title={t}
        >
          {t}
        </button>
      ))}
      <button
        type="button"
        className="history-chip"
        onClick={onClear}
        title="Clear history"
        style={{ color: "var(--text-muted)" }}
      >
        Clear
      </button>
    </div>
  );
}