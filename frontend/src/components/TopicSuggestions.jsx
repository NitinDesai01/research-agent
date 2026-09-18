const CATEGORIES = {
  Technology: [
    "Impact of quantum computing on cryptography",
    "How AI is transforming software engineering",
    "Energy consumption of large language models",
  ],
  Science: [
    "CRISPR gene editing for inherited diseases",
    "Solid-state batteries for electric vehicles",
    "Ocean acidification and coral reefs",
  ],
  Health: [
    "Intermittent fasting and metabolic health",
    "Long-term effects of COVID-19",
    "Gut microbiome and mental health",
  ],
  Business: [
    "Economics of semiconductor reshoring",
    "Remote work and productivity",
    "Inflation targeting in emerging markets",
  ],
};

export default function TopicSuggestions({ onSelect, disabled }) {
  return (
    <div className="suggestions">
      {Object.entries(CATEGORIES).map(([category, topics]) => (
        <div className="suggestion-group" key={category}>
          <h4 className="suggestion-category">{category}</h4>
          <div className="suggestion-chips">
            {topics.map((t) => (
              <button
                key={t}
                type="button"
                className="suggestion-chip"
                onClick={() => onSelect(t)}
                disabled={disabled}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}