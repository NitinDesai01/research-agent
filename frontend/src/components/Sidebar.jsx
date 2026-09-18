import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function Sidebar({ onOpen, refreshKey }) {
  const { getToken, isSignedIn } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!isSignedIn) return;
    setLoading(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${API_BASE}/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setReports(data.reports || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, refreshKey]);

  const handleOpen = async (id) => {
    const token = await getToken();
    const resp = await fetch(`${API_BASE}/reports/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      onOpen?.(data);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    const token = await getToken();
    await fetch(`${API_BASE}/reports/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setReports((r) => r.filter((x) => x.id !== id));
  };

  if (!isSignedIn) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3>My Reports</h3>
        <button type="button" className="sidebar-refresh" onClick={load}>
          ↻
        </button>
      </div>

      {loading && <p className="sidebar-empty">Loading…</p>}

      {!loading && reports.length === 0 && (
        <p className="sidebar-empty">
          No saved reports yet. Run a research query and click <strong>Save</strong>.
        </p>
      )}

      <ul className="sidebar-list">
        {reports.map((r) => (
          <li key={r.id} className="sidebar-item" onClick={() => handleOpen(r.id)}>
            <div className="sidebar-topic">{r.topic}</div>
            <div className="sidebar-date">
              {new Date(r.created_at).toLocaleDateString()}
            </div>
            <button
              type="button"
              className="sidebar-delete"
              onClick={(e) => handleDelete(r.id, e)}
              aria-label="Delete report"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}