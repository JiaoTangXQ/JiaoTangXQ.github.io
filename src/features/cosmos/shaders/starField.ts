export const starFieldVertex = /* glsl */ `
uniform float uTime;
uniform float uZoom;

attribute float aSize;
attribute float aPhase;
attribute float aBrightness;
attribute float aColor;

varying float vBrightness;
varying float vColor;

void main() {
  // Per-star twinkle: smooth sin-based oscillation with individual phase offset
  float twinkleSpeed = 0.8 + aPhase * 0.6; // slightly different speed per star
  float twinkle = sin(uTime * twinkleSpeed + aPhase * 6.2831) * 0.5 + 0.5;
  // Mix base brightness with twinkle — brighter stars twinkle more subtly
  float twinkleAmount = 0.3 * (1.0 - aBrightness * 0.5);
  vBrightness = aBrightness * (1.0 - twinkleAmount + twinkleAmount * twinkle);

  vColor = aColor;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  // Point size scales with aSize and inversely with camera distance,
  // and scales with zoom so stars remain visible when zoomed out
  float baseSize = aSize * (0.6 + uZoom * 0.4);
  gl_PointSize = baseSize * (300.0 / -mvPosition.z);
  // Clamp to prevent invisibly small or absurdly large
  gl_PointSize = clamp(gl_PointSize, 0.5, 6.0);

  gl_Position = projectionMatrix * mvPosition;
}
`;

export const starFieldFragment = /* glsl */ `
precision highp float;

varying float vBrightness;
varying float vColor;

void main() {
  // Soft circular point: distance from center of the gl_Point
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  float dist = dot(cxy, cxy);

  // Smooth alpha falloff — softer than a hard circle
  float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
  // Extra softness at the edge
  alpha *= alpha;

  if (alpha < 0.01) discard;

  // Star color palette based on aColor attribute:
  // 0.0 = warm white (slightly yellow)
  // 0.5 = cool white (neutral)
  // 1.0 = faint blue
  vec3 warmWhite = vec3(1.0, 0.95, 0.85);
  vec3 coolWhite = vec3(0.92, 0.95, 1.0);
  vec3 faintBlue = vec3(0.75, 0.85, 1.0);

  vec3 color;
  if (vColor < 0.5) {
    color = mix(warmWhite, coolWhite, vColor * 2.0);
  } else {
    color = mix(coolWhite, faintBlue, (vColor - 0.5) * 2.0);
  }

  gl_FragColor = vec4(color * vBrightness, alpha * vBrightness);
}
`;
