/**
 * 行星节点 shader — InstancedMesh + 伪 3D 球体渲染
 *
 * 用 UV 坐标模拟球面法线，实现：
 * - 方向光照明（明暗面 + 明暗交界线）
 * - 表面纹理（FBM noise 模拟地形/云层）
 * - 大气边缘光（Fresnel rim glow）
 * - 外发光光晕
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

// --- Noise ---
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * valueNoise(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 center = vUv - 0.5;
  float dist = length(center) * 2.0;

  float baseOpacity = mix(0.15, 1.0, smoothstep(0.0, 0.5, vEmphasis));

  // === 伪 3D 球面法线 ===
  float sphereRadius = 0.44;
  float r = dist / (sphereRadius * 2.0); // 0-1 在球面范围内
  if (r > 1.0) {
    // 球面外 → 只渲染外发光
    float glowDist = dist / 2.0;
    float glowRadius = 0.65;
    float glowFalloff = 1.0 - smoothstep(sphereRadius, glowRadius, glowDist);
    glowFalloff = glowFalloff * glowFalloff * glowFalloff;
    vec3 glowColor = mix(vColorOuter, vColorInner, 0.3);
    float glowAlpha = glowFalloff * 0.3 * baseOpacity;

    // Active ring pulse
    float ringActive = smoothstep(0.85, 1.0, vEmphasis);
    float ringDist = abs(glowDist - 0.52 - 0.02 * sin(uTime * 2.5));
    float ring = (1.0 - smoothstep(0.0, 0.05, ringDist)) * ringActive;

    float alpha = glowAlpha + ring * 0.5 * baseOpacity;
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(glowColor + vColorInner * ring * 1.2, alpha);
    return;
  }

  // 球面法线：从 UV 推算 (nx, ny, nz)
  vec2 nxy = center / (sphereRadius);
  float nz = sqrt(max(0.0, 1.0 - dot(nxy, nxy)));
  vec3 normal = normalize(vec3(nxy, nz));

  // === 光照 ===
  // 方向光：从左上方照射
  vec3 lightDir = normalize(vec3(-0.5, 0.6, 0.8));
  float NdotL = dot(normal, lightDir);
  float diffuse = max(0.0, NdotL);

  // 柔和的明暗交界线
  float terminator = smoothstep(-0.15, 0.25, NdotL);

  // 暗面不完全黑，有环境光
  float ambient = 0.12;
  float lighting = ambient + terminator * 0.88;

  // === 表面纹理 ===
  // 球面 UV：用法线投影到极坐标，让纹理随时间慢慢转
  float lon = atan(normal.x, normal.z) + uTime * 0.04;
  float lat = asin(normal.y);
  vec2 sphereUV = vec2(lon, lat) * 1.8;

  // 多层纹理
  float terrain = fbm(sphereUV * 3.0);
  float clouds = fbm(sphereUV * 2.0 + vec2(uTime * 0.02, 0.0));

  // 表面颜色：内外色混合 + 纹理调制
  float colorMix = terrain * 0.6 + r * 0.4;
  vec3 surfaceColor = mix(vColorInner, vColorOuter, colorMix);

  // 云层：在表面上叠加稍微发亮的色带
  float cloudMask = smoothstep(0.35, 0.65, clouds);
  surfaceColor = mix(surfaceColor, surfaceColor * 1.25 + vec3(0.03), cloudMask * 0.3);

  // 应用光照
  surfaceColor *= lighting;

  // === 高光 ===
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(lightDir + viewDir);
  float specular = pow(max(0.0, dot(normal, halfDir)), 32.0);
  surfaceColor += vec3(0.15) * specular * diffuse;

  // === 大气边缘光 (Fresnel rim) ===
  float fresnel = 1.0 - nz; // 边缘处 nz→0，fresnel→1
  fresnel = pow(fresnel, 2.5);
  vec3 rimColor = mix(vColorInner, vec3(0.7, 0.85, 1.0), 0.4);
  surfaceColor += rimColor * fresnel * 0.45;

  // === 球面边缘抗锯齿 ===
  float edgeAA = 1.0 - smoothstep(0.96, 1.0, r);

  // === Related brightness boost ===
  float relatedBoost = smoothstep(0.6, 0.85, vEmphasis);
  surfaceColor *= 1.0 + relatedBoost * 0.3;

  float alpha = edgeAA * baseOpacity;
  if (alpha < 0.005) discard;

  gl_FragColor = vec4(surfaceColor, alpha);
}
`;
