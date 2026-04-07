import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrthographicCamera } from "three";
import type { CameraState } from "./useCamera";
import { debouncedSaveCameraToHash } from "./urlState";

type Props = {
  /** Ref to the current camera target state. Read every frame without triggering renders. */
  stateRef: React.RefObject<CameraState>;
};

/**
 * R3F component that lives inside the Canvas and smoothly interpolates
 * the Three.js orthographic camera toward the target camera state.
 *
 * Uses exponential smoothing: current += (target - current) * (1 - e^(-speed * dt))
 */
export function CameraController({ stateRef }: Props) {
  const { camera: threeCamera } = useThree();
  const currentRef = useRef<CameraState>({
    x: stateRef.current?.x ?? 0,
    y: stateRef.current?.y ?? 0,
    zoom: stateRef.current?.zoom ?? 1.0,
  });
  const lastSavedRef = useRef<string>("");

  useFrame((_state, delta) => {
    const target = stateRef.current;
    if (!target) return;

    const cam = threeCamera as OrthographicCamera;
    const cur = currentRef.current;

    // Exponential smoothing — speed 10 for snappier response
    const speed = 10;
    // Clamp delta to avoid huge jumps on tab re-focus
    const dt = Math.min(delta, 0.1);
    const factor = 1 - Math.exp(-speed * dt);

    cur.x += (target.x - cur.x) * factor;
    cur.y += (target.y - cur.y) * factor;
    cur.zoom += (target.zoom - cur.zoom) * factor;

    // Apply to Three.js camera
    cam.position.x = cur.x;
    cam.position.y = cur.y;
    cam.zoom = cur.zoom;
    cam.updateProjectionMatrix();

    // Debounced URL state persistence
    const key = `${Math.round(cur.x)},${Math.round(cur.y)},${cur.zoom.toFixed(2)}`;
    if (key !== lastSavedRef.current) {
      lastSavedRef.current = key;
      debouncedSaveCameraToHash(cur);
    }
  });

  return null;
}
