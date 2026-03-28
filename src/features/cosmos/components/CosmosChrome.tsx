import "@/styles/cosmos-ui.css";

type Props = {
  onSearchOpen: () => void;
  onReset: () => void;
};

export function CosmosChrome({ onSearchOpen, onReset }: Props) {
  return (
    <div className="cosmos-chrome">
      {/* Brand */}
      <div className="cosmos-chrome__brand">
        <div className="cosmos-chrome__eyebrow">JiaoTang Planet</div>
        <div className="cosmos-chrome__title">焦糖星球</div>
      </div>

      {/* Actions */}
      <div className="cosmos-chrome__actions">
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
