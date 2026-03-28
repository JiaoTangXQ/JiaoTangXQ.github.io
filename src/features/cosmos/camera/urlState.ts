import type { CameraState } from "./useCamera";

/**
 * Save camera state into the URL hash fragment.
 * Format: #x=120&y=-80&z=1.5
 *
 * Values are rounded to 1 decimal place to keep URLs clean.
 */
export function saveCameraToHash(camera: CameraState): void {
  const x = Math.round(camera.x * 10) / 10;
  const y = Math.round(camera.y * 10) / 10;
  const z = Math.round(camera.zoom * 100) / 100;
  const hash = `#x=${x}&y=${y}&z=${z}`;
  // Use replaceState to avoid polluting browser history with every save
  window.history.replaceState(null, "", hash);
}

/**
 * Parse camera state from the URL hash fragment.
 * Returns null if the hash is empty or doesn't contain valid camera params.
 */
export function loadCameraFromHash(): CameraState | null {
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return null;

  const params = new URLSearchParams(hash.slice(1));
  const xStr = params.get("x");
  const yStr = params.get("y");
  const zStr = params.get("z");

  if (xStr == null && yStr == null && zStr == null) return null;

  const x = xStr != null ? parseFloat(xStr) : 0;
  const y = yStr != null ? parseFloat(yStr) : 0;
  const zoom = zStr != null ? parseFloat(zStr) : 1.0;

  // Reject NaN values
  if (isNaN(x) || isNaN(y) || isNaN(zoom)) return null;

  return { x, y, zoom };
}

// ---- Debounced save ----

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced save — writes camera state to the URL hash, but waits 300ms
 * after the last call to avoid URL spam during continuous interaction.
 */
export function debouncedSaveCameraToHash(camera: CameraState): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveCameraToHash(camera);
    saveTimer = null;
  }, 300);
}
