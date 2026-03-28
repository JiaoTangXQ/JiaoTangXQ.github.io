import { useCallback, useRef } from "react";
import type { UseCameraReturn } from "./useCamera";
import type { UseAutoCruiseReturn } from "./useAutoCruise";

type Vec2 = { x: number; y: number };

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Input handling for mouse and touch gestures on the cosmos canvas container.
 *
 * Returns event handler props to spread onto a container div wrapping the
 * R3F Canvas. All gestures interrupt auto-cruise.
 */
export function useGestures(
  cam: UseCameraReturn,
  cruise: UseAutoCruiseReturn,
) {
  // --- Mouse state ---
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef<Vec2>({ x: 0, y: 0 });

  // --- Touch state ---
  const touchCacheRef = useRef<Map<number, Vec2>>(new Map());
  const lastPinchDistRef = useRef(0);
  const lastPinchCenterRef = useRef<Vec2>({ x: 0, y: 0 });

  // Ref to the container element so we can compute world-space coordinates
  const containerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Convert a screen pixel position relative to the container to
   * approximate world-space coordinates at the current camera state.
   */
  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Vec2 => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const { x: cx, y: cy, zoom } = cam._stateRef.current;
      // Offset from center of viewport, divided by zoom
      const wx = cx + (clientX - rect.left - rect.width / 2) / zoom;
      const wy = cy - (clientY - rect.top - rect.height / 2) / zoom;
      return { x: wx, y: wy };
    },
    [cam],
  );

  // ======================
  // Mouse handlers
  // ======================
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // left button only
      cruise.interrupt();
      isDraggingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    },
    [cruise],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      // Negate: dragging right should move camera left (scene pans right)
      cam.panBy(-dx, dy);
    },
    [cam],
  );

  const onMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const onMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      cruise.interrupt();

      const zoomSpeed = 0.001;
      const { zoom } = cam._stateRef.current;
      // Compute new zoom — deltaY < 0 means scroll up → zoom in
      const factor = 1 - e.deltaY * zoomSpeed;
      const newZoom = zoom * factor;

      const world = screenToWorld(e.clientX, e.clientY);
      cam.zoomToward(world.x, world.y, newZoom);
    },
    [cam, cruise, screenToWorld],
  );

  // ======================
  // Touch handlers
  // ======================
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      cruise.interrupt();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        touchCacheRef.current.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      if (touchCacheRef.current.size === 2) {
        const [a, b] = Array.from(touchCacheRef.current.values());
        lastPinchDistRef.current = distance(a, b);
        lastPinchCenterRef.current = midpoint(a, b);
      }
    },
    [cruise],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      // Update cache
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        touchCacheRef.current.set(t.identifier, { x: t.clientX, y: t.clientY });
      }

      const touches = Array.from(touchCacheRef.current.values());

      if (touches.length === 1) {
        // Single finger pan
        const t = e.changedTouches[0];
        const prev = touchCacheRef.current.get(t.identifier);
        if (!prev) return;
        const dx = t.clientX - prev.x;
        const dy = t.clientY - prev.y;
        cam.panBy(-dx, dy);
        touchCacheRef.current.set(t.identifier, { x: t.clientX, y: t.clientY });
      } else if (touches.length === 2) {
        const [a, b] = touches;
        const dist = distance(a, b);
        const center = midpoint(a, b);

        // Pinch zoom
        if (lastPinchDistRef.current > 0) {
          const scale = dist / lastPinchDistRef.current;
          const { zoom } = cam._stateRef.current;
          const world = screenToWorld(center.x, center.y);
          cam.zoomToward(world.x, world.y, zoom * scale);
        }

        // Two-finger pan
        const dx = center.x - lastPinchCenterRef.current.x;
        const dy = center.y - lastPinchCenterRef.current.y;
        cam.panBy(-dx, dy);

        lastPinchDistRef.current = dist;
        lastPinchCenterRef.current = center;
      }
    },
    [cam, screenToWorld],
  );

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      touchCacheRef.current.delete(e.changedTouches[i].identifier);
    }
    if (touchCacheRef.current.size < 2) {
      lastPinchDistRef.current = 0;
    }
  }, []);

  return {
    containerRef,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave,
      onWheel,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  } as const;
}

export type UseGesturesReturn = ReturnType<typeof useGestures>;
