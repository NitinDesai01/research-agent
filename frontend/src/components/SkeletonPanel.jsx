export default function SkeletonPanel({ title = "Loading" }) {
  return (
    <div className="panel skeleton-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-title-icon skeleton-box" />
          <span className="skeleton-line skeleton-title">{title}</span>
        </div>
      </div>
      <div className="panel-body">
        <div className="skeleton-line skeleton-lg" />
        <div className="skeleton-line skeleton-md" />
        <div className="skeleton-line skeleton-lg" />
        <div className="skeleton-line skeleton-sm" />
        <div className="skeleton-line skeleton-md" />
      </div>
    </div>
  );
}