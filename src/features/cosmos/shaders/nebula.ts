/**
 * 增强版星云 shader — 多层 FBM + 边缘溶解
 *
 * 改进：
 * - 5 层 FBM 叠加（原 4 层），更细腻的云结构
 * - 边缘溶解效果：星云边缘不再是圆形渐变，而是 noise 驱动的不规则边界
 * - 多层色彩：主色 + 亮核 + 暗边，增加深度感
 */
export const nebulaVertex = /* glsl */ `
uniform vec2 uOffset;

varying vec2 vUv;

void main() {
  vUv = uv + uOffset;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const nebulaFragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;

varying vec2 vUv;

//
// Simplex 3D noise — Ashima Arts / Stefan Gustavson
//
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// 增强 FBM：5 层叠加，更丰富的细节
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 5; i++) {
    value += amplitude * snoise(p * frequency);
    amplitude *= 0.48;
    frequency *= 2.15;
  }
  return value;
}

// 涡旋变形：让星云形状更有流动感
vec2 warp(vec2 p, float t) {
  float wx = snoise(vec3(p * 1.2, t * 0.2));
  float wy = snoise(vec3(p * 1.2 + 5.0, t * 0.2 + 3.0));
  return p + vec2(wx, wy) * 0.15;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.03;

  // 涡旋变形 UV
  vec2 warpedUv = warp(uv * 2.5, t);

  // Layer 1: 大尺度云结构（主体）
  float n1 = fbm(vec3(warpedUv * 0.8, t * 0.4));

  // Layer 2: 中等细节，偏移 + 稍快
  float n2 = fbm(vec3(warpedUv * 1.6 + 3.7, t * 0.6 + 1.3));

  // Layer 3: 精细纤维状结构
  float n3 = snoise(vec3(warpedUv * 3.5 + 7.1, t * 0.8));

  // Layer 4: 极细微细节（增加质感）
  float n4 = snoise(vec3(warpedUv * 6.0 + 11.3, t * 1.1 + 5.0));

  // 合成云层：大结构主导，细节点缀
  float cloud = n1 * 0.55 + n2 * 0.25 + n3 * 0.12 + n4 * 0.08;
  cloud = smoothstep(-0.15, 0.65, cloud);

  // === 边缘溶解效果 ===
  // 不再使用简单的圆形径向衰减，而是用 noise 驱动不规则边界
  vec2 center = uv - 0.5;
  float baseDist = length(center);

  // 边缘 noise：让边界呈现撕裂/溶解形态
  float edgeNoise = fbm(vec3(center * 4.0, t * 0.3 + 2.0));
  float dissolveThreshold = 0.38 + edgeNoise * 0.18;

  // 边缘衰减（noise 调制后的不规则边界）
  float edgeFade = 1.0 - smoothstep(dissolveThreshold - 0.08, dissolveThreshold + 0.12, baseDist);
  edgeFade = edgeFade * edgeFade; // squared for softer edge

  // 额外的径向 falloff 保证极远处完全透明
  float radialCap = 1.0 - smoothstep(0.0, 0.58, baseDist);
  radialCap = radialCap * radialCap;

  float alpha = cloud * edgeFade * radialCap * uOpacity;

  // === 多层色彩 ===
  // 亮核：接近中心的区域稍微发亮
  float coreGlow = exp(-baseDist * baseDist * 8.0) * 0.3;

  // 暗边：边缘的色彩稍微偏暗偏冷
  float edgeDarken = smoothstep(0.15, 0.45, baseDist);

  vec3 color = uColor * (0.80 + 0.20 * n1); // 基础色 + noise 变化
  color += uColor * coreGlow;                // 亮核
  color *= 1.0 - edgeDarken * 0.2;           // 边缘暗化

  gl_FragColor = vec4(color, alpha);
}
`;
