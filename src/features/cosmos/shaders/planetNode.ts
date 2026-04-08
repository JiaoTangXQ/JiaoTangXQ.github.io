/**
 * 行星节点 shader — 支持 InstancedMesh
 *
 * 所有 per-node 数据通过 instance attributes 传入：
 * - aColorInner / aColorOuter: 内外颜色
 * - aEmphasis: 强调程度 (0-1)
 * - aNodeSize: 节点大小系数
 */
export const planetNodeVertex = /* glsl */ `
uniform float uTime;

attribute vec3 aColorInner;
attribute vec3 aColorOuter;
attribute float aEmphasis;
attribute float aNodeSize;

varying vec2 vUv;
varying vec3 vColorInner;
varying vec3 vColorOuter;
varying float vEmphasis;
varying float vNodeSize;

void main() {
  vUv = uv;
  vColorInner = aColorInner;
  vColorOuter = aColorOuter;
  vEmphasis = aEmphasis;
  vNodeSize = aNodeSize;

  // instanceMatrix 包含每个节点的位置和缩放
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const planetNodeFragment = /* glsl */ `
precision highp float;

uniform float uTime;

varying vec2 vUv;
varying vec3 vColorInner;
varying vec3 vColorOuter;
varying float vEmphasis;
varying float vNodeSize;

// Compact hash-based noise for inner light variation
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep interpolation

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbmNoise(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * valueNoise(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 center = vUv - 0.5;
  float dist = length(center) * 2.0; // 0 at center, 1 at edge of UV quad

  // Emphasis controls overall visibility
  // 0.0 = muted (15% opacity), 0.5 = default, 1.0 = active
  float baseOpacity = mix(0.15, 1.0, smoothstep(0.0, 0.5, vEmphasis));

  // === Sphere core ===
  float sphereRadius = 0.45;
  float coreT = smoothstep(0.0, sphereRadius, dist);
  vec3 coreColor = mix(vColorInner, vColorOuter, coreT * coreT);

  // Inner light variation
  float noiseVal = fbmNoise(center * 8.0 + uTime * 0.15);
  coreColor *= 0.88 + 0.12 * noiseVal;

  // Sphere alpha
  float coreAlpha = 1.0 - smoothstep(sphereRadius - 0.04, sphereRadius + 0.01, dist);

  // Highlight
  float highlight = 1.0 - smoothstep(0.0, 0.25, length(center - vec2(-0.08, 0.08)));
  coreColor += vec3(0.12) * highlight * highlight;

  // === Outer glow ===
  float glowRadius = 0.68;
  float glowFalloff = 1.0 - smoothstep(sphereRadius, glowRadius, dist);
  glowFalloff = glowFalloff * glowFalloff * glowFalloff;
  vec3 glowColor = mix(vColorOuter, vColorInner, 0.3);
  float glowAlpha = glowFalloff * 0.35;

  // === Active ring pulse ===
  float ringActive = smoothstep(0.85, 1.0, vEmphasis);
  float ringDist = abs(dist - 0.55 - 0.03 * sin(uTime * 2.5));
  float ring = (1.0 - smoothstep(0.0, 0.06, ringDist)) * ringActive;
  vec3 ringColor = vColorInner * 1.3;

  // === Related brightness boost ===
  float relatedBoost = smoothstep(0.6, 0.85, vEmphasis);
  coreColor *= 1.0 + relatedBoost * 0.25;
  glowAlpha *= 1.0 + relatedBoost * 0.4;

  // === Composite ===
  vec3 color = coreColor * coreAlpha + glowColor * glowAlpha * (1.0 - coreAlpha);
  color += ringColor * ring;
  float alpha = coreAlpha + glowAlpha * (1.0 - coreAlpha) + ring * 0.6;

  alpha *= baseOpacity;

  if (alpha < 0.005) discard;

  gl_FragColor = vec4(color, alpha);
}
`;
