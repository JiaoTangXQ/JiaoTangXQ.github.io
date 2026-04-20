import "@/styles/cosmos-ui.css";

type Props = {
  visible: boolean;
  phase: "locating" | "jumping";
  reason?: string;
  cluster?: string;
};

/**
 * 异星跃迁期间的前景提示。两个 phase：
 *   - locating: 正在计算陌生星系
 *   - jumping:  已锁定，展示目标说明
 */
export function JumpToast({ visible, phase, reason, cluster }: Props) {
  return (
    <div
      className={`jump-toast${visible ? " jump-toast--visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="jump-toast__phase">
        {phase === "locating" ? "定位陌生星系" : "跃迁"}
      </div>
      <div className="jump-toast__reason">
        {phase === "locating" ? "正在分析你的阅读画像…" : reason || "跃迁中"}
      </div>
      {phase === "jumping" && cluster && (
        <div className="jump-toast__cluster">目的地 · {cluster}</div>
      )}
    </div>
  );
}
