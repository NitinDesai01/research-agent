export default function SourcesView({ sources }) {
  return (
    <ul className="sources-list">
      {sources.map((s, i) => (
        <li key={i} className="source-item">
          <div className="source-index">{i + 1}</div>
          <div className="source-content">
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="source-title"
            >
              {s.title || s.url}
            </a>
            <div className="source-url">{s.url}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
