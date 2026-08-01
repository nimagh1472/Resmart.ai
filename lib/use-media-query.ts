"use client";

import { useEffect, useState } from "react";

/**
 * Subscribes to a media query.
 *
 * Starts `false` on both server and first client render so hydration always
 * matches, then resolves in an effect. Callers that swap layout on the result
 * get one extra frame in the small-screen branch — cheap, and correct.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);

    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** Tailwind's `lg` breakpoint — where the dashboards gain a real sidebar. */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
