import { ArrowRight, CornerDownLeft, CornerDownRight, Flag, Milestone, MoveUp, RotateCcw, Split } from 'lucide-react';
import { usePlannerStore } from '../store/usePlannerStore';
import type { RouteStep } from '../types';
import { formatDistance, formatDuration } from '../utils/csv';

function getStepIcon(type?: number) {
  if (type === 0) return CornerDownLeft;
  if (type === 1) return CornerDownRight;
  if (type === 2 || type === 3) return MoveUp;
  if (type === 4 || type === 5 || type === 6 || type === 7) return Split;
  if (type === 10) return Flag;
  if (type === 11) return RotateCcw;
  return ArrowRight;
}

function StepRow({ step, number }: { step: RouteStep; number: number }) {
  const Icon = getStepIcon(step.type);

  return (
    <li className="direction-step">
      <span className="direction-step-number">{number}</span>
      <span className="direction-step-icon" aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className="direction-step-copy">
        <strong>{step.instruction}</strong>
        {step.name && <span>{step.name}</span>}
      </div>
      <div className="direction-step-meta">
        <span>{formatDistance(step.distanceMeters)}</span>
        <span>{formatDuration(step.durationSeconds)}</span>
      </div>
    </li>
  );
}

export function DirectionsList() {
  const segments = usePlannerStore((state) => state.routeSegments);

  if (segments.length === 0) {
    return (
      <div className="empty-state">
        <strong>No directions yet.</strong>
        <span>Request a route to see turn-by-turn guidance.</span>
      </div>
    );
  }

  let stepNumber = 0;

  return (
    <div className="directions-list" aria-label="Turn-by-turn route directions">
      {segments.map((segment) => (
        <section className="direction-leg" key={segment.id} aria-label={segment.label}>
          <header className="direction-leg-header">
            <span>
              <Milestone size={15} aria-hidden="true" />
              {segment.label}
            </span>
            <span>
              {formatDistance(segment.distanceMeters)} · {formatDuration(segment.durationSeconds)}
            </span>
          </header>
          <ol>
            {segment.steps.map((step) => {
              stepNumber += 1;
              return <StepRow key={step.id} step={step} number={stepNumber} />;
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
