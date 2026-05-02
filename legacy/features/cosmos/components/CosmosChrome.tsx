import "@/styles/cosmos-ui.css";

type Props = {
  onSearchOpen: () => void;
  onReset: () => void;
  onJump: () => void;
  jumping?: boolean;
};

export function CosmosChrome({
  onSearchOpen,
  onReset,
  onJump,
  jumping = false,
}: Props) {
  return (
    <div className="cosmos-chrome">
      {/* Brand */}
      <div className="cosmos-chrome__brand">
        <div className="cosmos-chrome__eyebrow">JiaoTang Planet</div>
        <div className="cosmos-chrome__title-wrap">
          <div className="cosmos-chrome__title">焦糖星球</div>
          <div className="cosmos-chrome__descriptor">living thought cosmos</div>
        </div>
      </div>

      {/* Actions */}
      <div className="cosmos-chrome__actions">
        <button
          className="cosmos-chrome__btn cosmos-chrome__btn--jump"
          onClick={onJump}
          disabled={jumping}
          aria-label="异星跃迁：跳到陌生的星球"
          title="跳到你从未靠近过的星系"
        >
          <span className="cosmos-chrome__btn-icon" aria-hidden="true">
            ✧
          </span>
          {jumping ? "跃迁中…" : "异星跃迁"}
        </button>
        <button
          className="cosmos-chrome__btn"
          onClick={onSearchOpen}
          aria-label="搜索文章"
        >
          <span className="cosmos-chrome__btn-icon" aria-hidden="true">
            ⌘
          </span>
          搜索
        </button>
        <button
          className="cosmos-chrome__btn"
          onClick={onReset}
          aria-label="重置视角"
        >
          重置视角
        </button>
      </div>
    </div>
  );
}
