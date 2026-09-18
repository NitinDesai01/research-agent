export default function TopBar({
  theme,
  onToggleTheme,
  soundEnabled,
  onToggleSound,
  rightSlot,
}) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Research Agent home">
        <div className="brand-logo">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </div>
        <div>
          <div className="brand-text">Research Agent</div>
          <div className="brand-sub">v1.0 · multi-agent</div>
        </div>
      </a>

      <div className="topbar-actions">
        <button
          type="button"
          className={`icon-btn ${soundEnabled ? "active" : ""}`}
          onClick={onToggleSound}
          aria-label={soundEnabled ? "Mute" : "Enable sound"}
        >
          {soundEnabled ? (
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
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 5 6 9H2v6h4l5 4z" />
              <path d="M22 9l-6 6M16 9l6 6" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {rightSlot}
      </div>
    </header>
  );
}
