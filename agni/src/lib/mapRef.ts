/** The live MapLibre instance, for components outside the map tree.
 *
 *  The rail's ranked bars zoom the map when clicked, which needs the map
 *  itself. Passing it down through props would thread it through App and every
 *  panel for one call site; a module-scoped handle set by MapView on mount and
 *  cleared on unmount is smaller and does not re-render anything. */

import type { Map as MaplibreMap } from "maplibre-gl";

let current: MaplibreMap | null = null;

export function setMapRef(map: MaplibreMap | null): void {
  current = map;
}

export function getMapRef(): MaplibreMap | null {
  return current;
}
