/** Wiring between the forest-estate polygons and the fire set.
 *
 *  Kept out of `forest.ts` on purpose: the registry imports `FOREST_CLASSES`
 *  and `forestFillColor` at module scope, the store imports the registry, so a
 *  store import inside `forest.ts` would close a cycle and leave the registry
 *  reading those two before they are initialised. This module sits on the
 *  React side of that line, where the cycle cannot form. */

import { useEffect } from "react";
import { useLayersStore } from "../store/layers";
import { getForestEstate } from "./remoteLayers";
import { tagFiresWithForest } from "./forest";

/** Tag every detection with the forest class it falls in, once the estate
 *  polygons have been fetched (which only happens if the user switches that
 *  layer on — it is 12.9 MB).
 *
 *  Runs on both orders: fires can arrive before the estate or after it. */
export function useForestTagging(): void {
  const fires = useLayersStore((s) => s.firesGeojson);
  const forestCount = useLayersStore((s) => s.forestFeatureCount);

  useEffect(() => {
    if (!fires || !forestCount) return;
    const estate = getForestEstate();
    if (!estate) return;
    if (!tagFiresWithForest(fires, estate)) return;
    // Republish under a fresh wrapper around the very same features. The map's
    // applier only re-pushes a source when the object identity changes, and the
    // chart memos key off the same object — without this the tags would exist
    // in memory and be visible to nothing.
    const { setFires, firesStatus } = useLayersStore.getState();
    setFires(
      { type: "FeatureCollection", features: fires.features },
      firesStatus,
    );
  }, [fires, forestCount]);
}
