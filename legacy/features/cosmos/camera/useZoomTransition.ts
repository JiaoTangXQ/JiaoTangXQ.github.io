/**
 * 宇宙缩放过渡动画管理器
 *
 * 管理从宇宙画布进入文章页、以及从文章返回宇宙的过渡动画。
 * 状态流：
 *   进入：idle → zooming → fading-out → (navigate) → idle
 *   返回：(navigate) → fading-in → zooming-out → idle
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { CosmosNode } from "@/lib/content/types";
import type { UseCameraReturn } from "./useCamera";

export type TransitionPhase =
  | "idle"
  | "zooming"
  | "fading-out"
  | "fading-in"
  | "zooming-out";

const ZOOM_DURATION = 420; // 推近动画时长
const FADE_DURATION = 260; // 淡出/淡入过渡时长
const RETURN_KEY = "cosmos-return-camera";

export function useZoomTransition(cam: UseCameraReturn) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /** 进入文章：推近 → 淡出 → 路由跳转 */
  const enterArticle = useCallback(
    (node: CosmosNode) => {
      // 保存当前相机状态用于返回
      const current = cam._stateRef.current;
      sessionStorage.setItem(RETURN_KEY, JSON.stringify(current));

      // 推近到节点
      setPhase("zooming");
      cam.flyTo(node.x, node.y, 4.0);

      // 推近完成后开始淡出
      timerRef.current = setTimeout(() => {
        setPhase("fading-out");
        setOverlayOpacity(1);

        // 淡出完成后跳转路由
        timerRef.current = setTimeout(() => {
          const hash = `x=${Math.round(node.x)}&y=${Math.round(node.y)}&z=4.00`;
          navigate(`/article/${node.slug}#${hash}`);
          setPhase("idle");
          setOverlayOpacity(0);
        }, FADE_DURATION);
      }, ZOOM_DURATION);
    },
    [cam, navigate],
  );

  /** 从文章页返回后调用：淡入 → 缩回原始位置 */
  const handleReturn = useCallback(() => {
    const saved = sessionStorage.getItem(RETURN_KEY);
    if (!saved) return;

    sessionStorage.removeItem(RETURN_KEY);
    const returnCam = JSON.parse(saved) as {
      x: number;
      y: number;
      zoom: number;
    };

    // 初始状态：遮罩可见
    setOverlayOpacity(1);
    setPhase("fading-in");

    // 淡入（遮罩消失）
    requestAnimationFrame(() => {
      setOverlayOpacity(0);

      // 淡入完成后缩回原始位置
      timerRef.current = setTimeout(() => {
        setPhase("zooming-out");
        cam.flyTo(returnCam.x, returnCam.y, returnCam.zoom);

        timerRef.current = setTimeout(() => {
          setPhase("idle");
        }, ZOOM_DURATION);
      }, FADE_DURATION);
    });
  }, [cam]);

  return {
    phase,
    overlayOpacity,
    enterArticle,
    handleReturn,
    isTransitioning: phase !== "idle",
    fadeDuration: FADE_DURATION,
  } as const;
}
