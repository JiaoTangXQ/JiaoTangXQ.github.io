import { useCallback, useEffect, useRef } from "react";
import type { UseCameraReturn } from "./useCamera";

const IDLE_TIMEOUT_MS = 5000;
const EASE_IN_DURATION_MS = 2000;

/**
 * Drives gentle camera drift when the user has been idle for a while.
 *
 * Uses a slow sinusoidal path so the cosmos feels alive even without
 * interaction. Smooth ease-in prevents jarring snap into drift.
 */
export function useAutoCruise(cam: UseCameraReturn) {
  const isActiveRef = useRef(false);
  const lastInteractionRef = useRef(Date.now());
  const easeStartRef = useRef(0);
  const rafRef = useRef(0);
  // Snapshot of camera position when cruise starts, so we add drift on top
  const baseRef = useRef({ x: 0, y: 0 });
  const tOffsetRef = useRef(0);

  const interrupt = useCallback(() => {
    lastInteractionRef.current = Date.now();
    if (isActiveRef.current) {
      isActiveRef.current = false;
      // Capture current position so next cruise resumes from here
      const cur = cam._stateRef.current;
      baseRef.current = { x: cur.x, y: cur.y };
    }
  }, [cam]);

  const resume = useCallback(() => {
    // resume is effectively a no-op that resets the idle timer
    lastInteractionRef.current = Date.now();
  }, []);

  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;
      const now = Date.now();
      const idleMs = now - lastInteractionRef.current;

      if (!isActiveRef.current && idleMs >= IDLE_TIMEOUT_MS) {
        // Start cruising
        isActiveRef.current = true;
        easeStartRef.current = now;
        const cur = cam._stateRef.current;
        baseRef.current = { x: cur.x, y: cur.y };
        tOffsetRef.current = now * 0.001; // capture time offset for continuity
      }

      if (isActiveRef.current) {
        // Ease-in factor: ramps from 0 to 1 over EASE_IN_DURATION_MS
        const easeElapsed = now - easeStartRef.current;
        const easeFactor = Math.min(1.0, easeElapsed / EASE_IN_DURATION_MS);
        // Smooth easing curve
        const ease = easeFactor * easeFactor * (3 - 2 * easeFactor);

        const t = (now * 0.001) - tOffsetRef.current;
        const dx = Math.sin(t * 0.0003 * 1000) * 0.15; // matches spec: sin(t * 0.0003)
        const dy = Math.cos(t * 0.00025 * 1000) * 0.1;

        cam._setDirect({
          x: baseRef.current.x + dx * ease,
          y: baseRef.current.y + dy * ease,
          zoom: cam._stateRef.current.zoom,
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [cam]);

  return {
    get isActive() {
      return isActiveRef.current;
    },
    interrupt,
    resume,
  } as const;
}

export type UseAutoCruiseReturn = ReturnType<typeof useAutoCruise>;
