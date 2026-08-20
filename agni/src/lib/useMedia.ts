/** Viewport size, as state.
 *
 *  Most of the responsive work is plain CSS, but two things genuinely need the
 *  breakpoint in JavaScript: the panels start closed on a phone and open on a
 *  desktop, and on a phone opening one panel has to close the other because
 *  they would otherwise cover each other and the map. */

import { useEffect, useState } from "react";

const COMPACT = "(max-width: 767px)";

export function useIsCompact(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.matchMedia(COMPACT).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(COMPACT);
    const onChange = (e: MediaQueryListEvent) => setCompact(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return compact;
}
