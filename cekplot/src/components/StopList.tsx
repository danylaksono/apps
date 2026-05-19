import { GripVertical, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePlannerStore } from '../store/usePlannerStore';
import { formatCoordinate } from '../utils/csv';

export function StopList() {
  const targets = usePlannerStore((state) => state.targets);
  const orderedStops = usePlannerStore((state) => state.orderedStops);
  const removeTarget = usePlannerStore((state) => state.removeTarget);
  const reorderStop = usePlannerStore((state) => state.reorderStop);
  const updateTarget = usePlannerStore((state) => state.updateTarget);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const orderedTargets = useMemo(
    () =>
      orderedStops
        .map((id) => targets.find((target) => target.id === id))
        .filter((target): target is NonNullable<typeof target> => Boolean(target)),
    [orderedStops, targets],
  );

  if (orderedTargets.length === 0) {
    return (
      <div className="empty-state">
        <strong>No target stops yet.</strong>
        <span>Click the map or import coordinates to begin.</span>
      </div>
    );
  }

  return (
    <ol className="stop-list" aria-label="Ordered route stops">
      {orderedTargets.map((target, index) => (
        <li
          key={target.id}
          className={draggedIndex === index ? 'dragging' : ''}
          onDragEnd={() => setDraggedIndex(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (draggedIndex !== null && draggedIndex !== index) {
              reorderStop(draggedIndex, index);
            }
            setDraggedIndex(null);
          }}
        >
          <span className="stop-rank">{index + 1}</span>
          <button
            className="drag-handle"
            type="button"
            draggable
            onDragStart={() => setDraggedIndex(index)}
            aria-label={`Drag ${target.name}`}
          >
            <GripVertical size={16} aria-hidden="true" />
          </button>
          <div className="stop-copy">
            <input
              value={target.name}
              onChange={(event) => updateTarget(target.id, { name: event.target.value })}
              aria-label={`Name for stop ${index + 1}`}
            />
          </div>
          <button className="icon-button" type="button" onClick={() => removeTarget(target.id)} aria-label={`Remove ${target.name}`}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ol>
  );
}
