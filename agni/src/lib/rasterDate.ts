/** The day offset the dated raster layers are drawing at.
 *
 *  Deliberately not read from the Zustand store inside the registry: the store
 *  imports the registry to seed its initial visibility, so a registry that
 *  imported the store back would be a cycle — and this one bites, because the
 *  store touches LAYERS during module evaluation. MapView, which already holds
 *  the store, pushes the value in here; the registry only reads it. */

let offset = 0;

export function setRasterDayOffset(days: number): void {
  offset = Math.max(0, days);
}

export function rasterDayOffset(): number {
  return offset;
}
