export default function SourcesView({ sources }) {
  return (
    <ul className="sources-list">
      {sources.map((s, i) => (
        <li key={i}>
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.title || s.url}
          </a>
          <div className="src-meta">{s.url}</div>
        </li>
      ))}
    </ul>
  );
}
