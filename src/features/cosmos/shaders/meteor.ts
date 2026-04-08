/**
 * 流星 + 星尘粒子 shader
 *
 * 流星：随机方向高速移动的短命粒子，带拖尾效果
 * 星尘：缓慢漂浮的微小粒子，随相机视差移动
 */
export const meteorVertex = /* glsl */ `
uniform float uTime;
uniform float uZoom;
uniform vec2 uCameraPos;

attribute float aPhase;      // 0-1 生命周期偏移
attribute float aSpeed;      // 速度系数
attribute float aAngle;      // 移动方向角度
attribute float aLifespan;   // 生命周期长度 (秒)
attribute float aType;       // 0 = 流星, 1 = 星尘
attribute float aBrightness; // 亮度

varying float vAlpha;
varying float vType;
varying float vBrightness;

void main() {
  float t = uTime;

  // 每个粒子的生命周期
  float cycleTime = mod(t + aPhase * aLifespan, aLifespan);
  float lifeT = cycleTime / aLifespan; // 0-1 归一化生命进度

  if (aType < 0.5) {
    // === 流星 ===
    // 沿固定角度方向移动
    vec2 dir = vec2(cos(aAngle), sin(aAngle));
    vec2 movement = dir * aSpeed * cycleTime * 80.0;

    // 流星视差：90% 跟随相机
    vec2 basePos = position.xy - uCameraPos * 0.9;
    float spreadX = 3000.0;
    float spreadY = 2200.0;
    basePos.x = mod(basePos.x + spreadX, spreadX * 2.0) - spreadX;
    basePos.y = mod(basePos.y + spreadY, spreadY * 2.0) - spreadY;

    vec3 worldPos = vec3(basePos + uCameraPos + movement, position.z);
    vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);

    // 流星：快速出现，拖尾淡出
    float fadeIn = smoothstep(0.0, 0.05, lifeT);
    float fadeOut = 1.0 - smoothstep(0.3, 1.0, lifeT);
    vAlpha = fadeIn * fadeOut * aBrightness;

    // 流星更大
    float size = 2.5 * (0.6 + uZoom * 0.4);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 8.0);
    gl_Position = projectionMatrix * mvPosition;
  } else {
    // === 星尘 ===
    // 缓慢漂浮，视差 60%
    vec2 drift = vec2(
      sin(t * 0.02 + aPhase * 6.28) * 15.0,
      cos(t * 0.015 + aPhase * 3.14) * 12.0
    );
    vec2 basePos = position.xy - uCameraPos * 0.6 + drift;
    float spreadX = 3500.0;
    float spreadY = 2600.0;
    basePos.x = mod(basePos.x + spreadX, spreadX * 2.0) - spreadX;
    basePos.y = mod(basePos.y + spreadY, spreadY * 2.0) - spreadY;

    vec3 worldPos = vec3(basePos + uCameraPos, position.z);
    vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);

    // 星尘：持续可见，微弱闪烁
    float twinkle = sin(t * 0.3 + aPhase * 6.28) * 0.3 + 0.7;
    vAlpha = aBrightness * twinkle * 0.4;

    float size = 1.2 * (0.5 + uZoom * 0.5);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 4.0);
    gl_Position = projectionMatrix * mvPosition;
  }

  vType = aType;
  vBrightness = aBrightness;
}
`;

export const meteorFragment = /* glsl */ `
precision highp float;

varying float vAlpha;
varying float vType;
varying float vBrightness;

void main() {
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  float dist = dot(cxy, cxy);

  float alpha;
  vec3 color;

  if (vType < 0.5) {
    // 流星：沿 y 方向拉长，带拖尾
    float elongation = abs(cxy.y) * 0.3;
    float shape = dist + elongation;
    alpha = 1.0 - smoothstep(0.0, 1.0, shape);
    alpha *= alpha * vAlpha;

    // 流星颜色：白色核心 + 微蓝拖尾
    vec3 core = vec3(1.0, 0.98, 0.95);
    vec3 tail = vec3(0.6, 0.8, 1.0);
    float coreT = smoothstep(0.0, 0.5, dist);
    color = mix(core, tail, coreT);
  } else {
    // 星尘：柔和圆点
    alpha = 1.0 - smoothstep(0.0, 1.0, dist);
    alpha *= alpha * vAlpha;

    // 星尘颜色：暖白到淡青
    color = mix(vec3(1.0, 0.95, 0.88), vec3(0.8, 0.95, 1.0), vBrightness);
  }

  if (alpha < 0.005) discard;

  gl_FragColor = vec4(color * vBrightness, alpha);
}
`;
