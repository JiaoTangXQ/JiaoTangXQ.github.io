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
  // Per-star twinkle: gentle sin oscillation — reduced intensity for calmer feel
  float twinkleSpeed = 0.5 + aPhase * 0.4; // slower, gentler variation
  float twinkle = sin(uTime * twinkleSpeed + aPhase * 6.2831) * 0.5 + 0.5;
  // Reduced twinkle amount — brighter stars barely flicker
  float twinkleAmount = 0.18 * (1.0 - aBrightness * 0.5);
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

  // Star color palette — warm amber to cool mint, matching C1 atmosphere
  // 0.0 = warm amber-white
  // 0.5 = cool white (neutral)
  // 1.0 = faint mint-teal
  vec3 warmWhite = vec3(1.0, 0.93, 0.82);
  vec3 coolWhite = vec3(0.92, 0.96, 0.97);
  vec3 faintBlue = vec3(0.72, 0.92, 0.95);

  vec3 color;
  if (vColor < 0.5) {
    color = mix(warmWhite, coolWhite, vColor * 2.0);
  } else {
    color = mix(coolWhite, faintBlue, (vColor - 0.5) * 2.0);
  }

  gl_FragColor = vec4(color * vBrightness, alpha * vBrightness);
}
`;
