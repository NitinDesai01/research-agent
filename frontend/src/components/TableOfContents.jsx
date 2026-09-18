import { useEffect, useState } from "react";

export default function TableOfContents({ report }) {
  const [active, setActive] = useState(null);
  const [headings, setHeadings] = useState([]);

  useEffect(() => {
    // Parse H2 headings from the markdown
    const lines = (report || "").split("\n");
    const found = [];
    for (const line of lines) {
      const m = line.match(/^##\s+(.+)/);
      if (m) {
        const text = m[1].trim();
        const id = slugify(text);
        found.push({ text, id });
      }
    }
    setHeadings(found);
  }, [report]);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  if (headings.length === 0) return null;

  return (
    <nav className="toc" aria-label="Table of contents">
      <h4 className="toc-title">On this page</h4>
      <ul className="toc-list">
        {headings.map(({ text, id }) => (
          <li key={id}>
            <button
              type="button"
              className={`toc-link ${active === id ? "active" : ""}`}
              onClick={() => scrollTo(id)}
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}