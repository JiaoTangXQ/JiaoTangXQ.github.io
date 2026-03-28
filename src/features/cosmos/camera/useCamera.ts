import { useCallback, useRef, useSyncExternalStore } from "react";

export type CameraState = {
  x: number;
  y: number;
  zoom: number;
};

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 4.0;
const ZOOM_DEFAULT = 1.0;

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * Core camera state manager. Stores the *target* state — the actual Three.js
 * camera is smoothly interpolated toward this target by CameraController.
 *
 * Uses a simple external store pattern so React re-renders only when the
 * snapshot reference changes.
 */
export function useCamera(initial?: Partial<CameraState>) {
  const stateRef = useRef<CameraState>({
    x: initial?.x ?? 0,
    y: initial?.y ?? 0,
    zoom: clampZoom(initial?.zoom ?? ZOOM_DEFAULT),
  });

  // Subscriber set for useSyncExternalStore
  const listenersRef = useRef(new Set<() => void>());

  const emit = useCallback(() => {
    listenersRef.current.forEach((fn) => fn());
  }, []);

  const subscribe = useCallback((cb: () => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const getSnapshot = useCallback(() => stateRef.current, []);

  const camera = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  /** Pan by screen-space delta, compensated for current zoom level. */
  const panBy = useCallback(
    (dx: number, dy: number) => {
      const prev = stateRef.current;
      stateRef.current = {
        ...prev,
        x: prev.x + dx / prev.zoom,
        y: prev.y + dy / prev.zoom,
      };
      emit();
    },
    [emit],
  );

  /** Zoom toward a focal point (world-space coordinates). */
  const zoomToward = useCallback(
    (focusX: number, focusY: number, newZoom: number) => {
      const prev = stateRef.current;
      const z = clampZoom(newZoom);
      // Adjust position so the focal point stays in the same screen location
      const scale = 1 - prev.zoom / z;
      stateRef.current = {
        x: prev.x + (focusX - prev.x) * scale,
        y: prev.y + (focusY - prev.y) * scale,
        zoom: z,
      };
      emit();
    },
    [emit],
  );

  /** Fly to a target position/zoom. The CameraController handles the spring. */
  const flyTo = useCallback(
    (x: number, y: number, zoom?: number) => {
      stateRef.current = {
        x,
        y,
        zoom: clampZoom(zoom ?? stateRef.current.zoom),
      };
      emit();
    },
    [emit],
  );

  /** Reset to origin with default zoom. */
  const reset = useCallback(() => {
    stateRef.current = { x: 0, y: 0, zoom: ZOOM_DEFAULT };
    emit();
  }, [emit]);

  /**
   * Direct-set without emit — used internally by auto-cruise to avoid
   * triggering React re-renders on every animation frame.
   */
  const _setDirect = useCallback((next: CameraState) => {
    stateRef.current = { ...next, zoom: clampZoom(next.zoom) };
  }, []);

  return {
    camera,
    panBy,
    zoomToward,
    flyTo,
    reset,
    /** @internal */
    _stateRef: stateRef,
    /** @internal */
    _setDirect: _setDirect,
    /** @internal */
    _emit: emit,
  } as const;
}

export type UseCameraReturn = ReturnType<typeof useCamera>;
