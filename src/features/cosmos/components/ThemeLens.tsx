import { getPalette } from "@/lib/content/types";
import "@/styles/cosmos-ui.css";

type Props = {
  themes: string[];
  activeTheme: string | null;
  onChange: (theme: string | null) => void;
};

export function ThemeLens({ themes, activeTheme, onChange }: Props) {
  return (
    <div className="theme-lens">
      {/* "All" reset pill */}
      <button
        className={`theme-lens__pill${activeTheme === null ? " theme-lens__pill--active" : ""}`}
        style={
          activeTheme === null
            ? {
                background: "rgba(255, 255, 255, 0.12)",
                borderColor: "transparent",
                color: "var(--text-primary)",
              }
            : undefined
        }
        onClick={() => onChange(null)}
        aria-pressed={activeTheme === null}
      >
        全域
      </button>

      {/* Theme pills */}
      {themes.map((theme) => {
        const palette = getPalette(theme);
        const isActive = activeTheme === theme;
        return (
          <button
            key={theme}
            className={`theme-lens__pill${isActive ? " theme-lens__pill--active" : ""}`}
            style={
              isActive
                ? {
                    background: `linear-gradient(135deg, ${palette.core[0]}, ${palette.core[1]})`,
                    borderColor: "transparent",
                    color: "#fff",
                  }
                : undefined
            }
            onClick={() => onChange(isActive ? null : theme)}
            aria-pressed={isActive}
          >
            <span
              className="theme-lens__dot"
              style={{ background: palette.core[0] }}
              aria-hidden="true"
            />
            {theme}
          </button>
        );
      })}
    </div>
  );
}
