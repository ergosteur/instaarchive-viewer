import { useEffect, useState } from 'react';

/** Matches Tailwind's `md` breakpoint, the point where the layout splits. */
const MOBILE_QUERY = '(max-width: 767px)';

/**
 * True on phone-sized viewports.
 *
 * Drives more than styling: mobile opens posts as a scrollable feed page while
 * desktop uses the modal, so this needs to be real state rather than a CSS
 * media query.
 */
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    query.addEventListener('change', onChange);
    setIsMobile(query.matches);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return isMobile;
};
