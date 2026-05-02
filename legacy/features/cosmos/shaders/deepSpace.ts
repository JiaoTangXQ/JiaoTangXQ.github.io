export const deepSpaceVertex = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const deepSpaceFragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;

varying vec2 vUv;

void main() {
  // C1 atmosphere: teal-black base, mint light blooms, warm amber accents
  vec3 colorDeep   = vec3(0.012, 0.024, 0.032);  // dark teal-black
  vec3 colorMid    = vec3(0.020, 0.045, 0.058);  // teal-dark
  vec3 colorTop    = vec3(0.014, 0.032, 0.042);

  // Aspect-corrected UV for radial fields
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;
  vec2 uvAspect = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  // Base vertical gradient — darker at edges, slightly brighter in the center
  float vertGrad = 1.0 - smoothstep(0.0, 0.7, length(uvAspect) * 1.1);
  vec3 base = mix(colorDeep, colorMid, vertGrad * 0.6);

  // Drifting radial color field 1: soft mint bloom, top-right drift
  float t1 = uTime * 0.015;
  vec2 center1 = vec2(
    0.3 * aspect + sin(t1 * 0.7) * 0.15 * aspect,
    0.35 + cos(t1 * 0.5) * 0.12
  );
  float d1 = length(uvAspect - center1 + vec2(0.5 * aspect, 0.5));
  float field1 = exp(-d1 * d1 * 2.8);
  vec3 tint1 = vec3(0.03, 0.10, 0.12); // soft mint / teal

  // Drifting radial color field 2: warm amber counterpoint, bottom-left drift
  float t2 = uTime * 0.012;
  vec2 center2 = vec2(
    -0.2 * aspect + cos(t2 * 0.6) * 0.18 * aspect,
    -0.15 + sin(t2 * 0.8) * 0.1
  );
  float d2 = length(uvAspect - center2);
  float field2 = exp(-d2 * d2 * 3.5);
  vec3 tint2 = vec3(0.10, 0.06, 0.02); // warm amber

  // Drifting radial color field 3: deep teal center drift
  float t3 = uTime * 0.01;
  vec2 center3 = vec2(
    sin(t3 * 0.9 + 2.0) * 0.25 * aspect,
    cos(t3 * 0.7 + 1.0) * 0.2
  );
  float d3 = length(uvAspect - center3);
  float field3 = exp(-d3 * d3 * 2.2);
  vec3 tint3 = vec3(0.02, 0.06, 0.07); // deep teal

  // Composite
  vec3 color = base;
  color += tint1 * field1 * 0.5;
  color += tint2 * field2 * 0.35;
  color += tint3 * field3 * 0.4;

  // Very subtle vignette to darken corners further
  float vig = 1.0 - smoothstep(0.3, 1.2, length(uvAspect) * 1.4);
  color *= 0.7 + vig * 0.3;

  gl_FragColor = vec4(color, 1.0);
}
`;
