/**
 * 全屏过渡遮罩
 *
 * 用于宇宙缩放过渡动画的淡出/淡入效果。
 * 背景色使用深空色 var(--space-deep)，与宇宙画布无缝衔接。
 */

type Props = {
  opacity: number;
  duration: number;
  /** 当 opacity 为 0 且不需要显示时完全隐藏 */
  visible?: boolean;
};

export function TransitionOverlay({
  opacity,
  duration,
  visible = true,
}: Props) {
  if (!visible && opacity === 0) return null;

  return (
    <div
      className="transition-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "var(--space-deep, #060a14)",
        opacity,
        transition: `opacity ${duration}ms ease-in-out`,
        pointerEvents: opacity > 0 ? "all" : "none",
      }}
      aria-hidden="true"
    />
  );
}
