/**
 * 引力场暗示 shader
 *
 * 渲染相关节点间微弱的发光连线。
 * 距离越近 alpha 越高，远离时完全透明。
 * 使用 additive blending 让连线融入深空背景。
 */
export const gravityFieldVertex = /* glsl */ `
attribute float aAlpha;
attribute vec3 aColor;

varying float vAlpha;
varying vec3 vColor;

void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const gravityFieldFragment = /* glsl */ `
precision highp float;

varying float vAlpha;
varying vec3 vColor;

void main() {
  if (vAlpha < 0.003) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;
