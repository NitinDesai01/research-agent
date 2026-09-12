export default function PipelineStepper({ stages, labels, current, completed }) {
  const currentIdx = stages.indexOf(current);

  return (
    <div className="stepper" role="progressbar" aria-label="Pipeline progress">
      {stages.map((stage, i) => {
        let cls = "step";
        if (completed[stage]) cls += " done";
        else if (stage === current || i === currentIdx) cls += " active";
        return (
          <div key={stage} className={cls}>
            <div className="step-dot">{completed[stage] ? "✓" : i + 1}</div>
            <div className="step-label">{labels[stage] || stage}</div>
          </div>
        );
      })}
    </div>
  );
}