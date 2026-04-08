/**
 * 开发模式 FPS 监控
 *
 * 轻量级 FPS 计数器，使用 useFrame 计算帧率，
 * 通过 R3F Html overlay 显示在左下角。
 * 仅在 import.meta.env.DEV 时渲染。
 */
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";

export function FpsMonitor() {
  const [fps, setFps] = useState(0);
  const framesRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useFrame(() => {
    framesRef.current++;
    const now = performance.now();
    const elapsed = now - lastTimeRef.current;

    // 每 500ms 更新一次 FPS 显示
    if (elapsed >= 500) {
      setFps(Math.round((framesRef.current / elapsed) * 1000));
      framesRef.current = 0;
      lastTimeRef.current = now;
    }
  });

  return (
    <group>
      {/* 使用 Three.js sprite 方式渲染 FPS 会过于复杂，
          直接通过 portal 到 DOM 更简单。这里仅做计算，
          实际显示由外部 DOM overlay 完成。 */}
      <FpsBridge fps={fps} />
    </group>
  );
}

/** 将 FPS 值桥接到 DOM */
function FpsBridge({ fps }: { fps: number }) {
  const divRef = useRef<HTMLDivElement | null>(null);

  // 惰性创建 DOM 元素
  if (!divRef.current && typeof document !== "undefined") {
    let el = document.getElementById("fps-monitor");
    if (!el) {
      el = document.createElement("div");
      el.id = "fps-monitor";
      el.style.cssText =
        "position:fixed;bottom:8px;left:8px;z-index:9999;" +
        "font:11px/1 monospace;color:#0f0;background:rgba(0,0,0,0.6);" +
        "padding:3px 6px;border-radius:3px;pointer-events:none;";
      document.body.appendChild(el);
    }
    divRef.current = el;
  }

  if (divRef.current) {
    divRef.current.textContent = `${fps} FPS`;
  }

  return null;
}
