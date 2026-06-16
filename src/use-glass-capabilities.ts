/**
 * React hook wrapper around {@link detectGlassCapabilities}.
 *
 * Returns conservative all-`false` defaults on the first (SSR / pre-mount)
 * render so server and client markup match, then re-evaluates real capabilities
 * in a mount effect. This avoids hydration mismatches while still upgrading to
 * the full effect on capable clients.
 */

import { useEffect, useState } from 'react';
import { detectGlassCapabilities, getConservativeGlassCapabilities } from './capabilities';
import type { GlassCapabilities } from './types';

/**
 * Detect liquid-glass capabilities on the client.
 *
 * @returns Conservative all-`false` {@link GlassCapabilities} until mounted,
 * then the detected capabilities for the current browser.
 */
export function useGlassCapabilities(): GlassCapabilities {
  const [capabilities, setCapabilities] = useState<GlassCapabilities>(
    getConservativeGlassCapabilities,
  );

  useEffect(() => {
    setCapabilities(detectGlassCapabilities());
  }, []);

  return capabilities;
}
