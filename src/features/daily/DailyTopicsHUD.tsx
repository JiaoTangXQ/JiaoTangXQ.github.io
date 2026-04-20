import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { CosmosNode } from "@/lib/content/types";
import { getPalette } from "@/lib/content/types";
import "@/styles/daily-hud.css";

type DailyView = {
  slug: string;
  stance: string;
  color: string;
};

type DailyTopic = {
  id: string;
  question: string;
  subtitle: string;
  views: DailyView[];
};

export type DailyData = {
  date: string;
  intro: string;
  topics: DailyTopic[];
};

const DISMISS_STORAGE_KEY = "jiaotang.dailyHud.dismissed";

function readDismissedDate(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(DISMISS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeDismissedDate(date: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, date);
  } catch {
    // ignore
  }
}

type Props = {
  data: DailyData | null;
  nodes: CosmosNode[];
};

/**
 * 今日三题 HUD：首屏浮层，三个议题 × 多视角对立，点击直达对应文章。
 * 同一天内主动关闭后今日不再自动弹出（localStorage），可通过顶部 pill 重新打开。
 */
export function DailyTopicsHUD({ data, nodes }: Props) {
  const [state, setState] = useState<"hidden" | "visible" | "dismissing">(
    "hidden",
  );

  // Index nodes by slug for quick lookup
  const nodeBySlug = useMemo(() => {
    const map = new Map<string, CosmosNode>();
    for (const n of nodes) map.set(n.slug, n);
    return map;
  }, [nodes]);

  // Decide whether to auto-show on first mount
  useEffect(() => {
    if (!data) return;
    const dismissed = readDismissedDate();
    if (dismissed === data.date) return; // already dismissed today
    // small delay so cosmos paints first
    const t = window.setTimeout(() => setState("visible"), 400);
    return () => window.clearTimeout(t);
  }, [data]);

  const close = useCallback(() => {
    if (!data) return;
    setState("dismissing");
    writeDismissedDate(data.date);
    window.setTimeout(() => setState("hidden"), 620);
  }, [data]);

  const reopen = useCallback(() => setState("visible"), []);

  // ESC closes
  useEffect(() => {
    if (state !== "visible") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, close]);

  if (!data) return null;

  // Show the reopen pill when closed (and there are nodes loaded)
  if (state === "hidden") {
    return (
      <button
        type="button"
        className="daily-hud-reopen"
        onClick={reopen}
        aria-label="重新打开今日三题"
      >
        <span className="daily-hud-reopen__dot" aria-hidden="true" />
        今日三题
      </button>
    );
  }

  return (
    <div
      className={`daily-hud${
        state === "visible" ? " daily-hud--visible" : " daily-hud--dismissing"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="今日三题"
    >
      <div className="daily-hud__header">
        <div className="daily-hud__eyebrow">{data.date}</div>
        <div className="daily-hud__title">{data.intro}</div>
        <div className="daily-hud__hint">
          每题三种立场并排展示 · 选一个你最不认同的读读看
        </div>
      </div>

      <div className="daily-hud__topics">
        {data.topics.map((topic) => {
          // use first view's color as topic glow tint
          const topicGlow = hexToGlow(topic.views[0]?.color ?? "#5cc8ff");
          return (
            <section
              key={topic.id}
              className="daily-topic"
              style={{ ["--topic-glow" as never]: topicGlow }}
            >
              <h2 className="daily-topic__question">{topic.question}</h2>
              <p className="daily-topic__subtitle">{topic.subtitle}</p>
              <div className="daily-topic__views">
                {topic.views.map((view) => {
                  const node = nodeBySlug.get(view.slug);
                  if (!node) return null;
                  const palette = getPalette(node.cluster);
                  const planetCore = palette.core[0];
                  const planetEdge = palette.core[1];
                  const planetGlow = palette.glow;
                  return (
                    <Link
                      key={view.slug}
                      to={`/article/${view.slug}`}
                      className="daily-view"
                      style={
                        {
                          ["--planet-core" as never]: planetCore,
                          ["--planet-edge" as never]: planetEdge,
                          ["--planet-glow" as never]: planetGlow,
                          ["--stance-color" as never]: view.color,
                        } as React.CSSProperties
                      }
                    >
                      <span
                        className="daily-view__planet"
                        aria-hidden="true"
                      />
                      <span className="daily-view__content">
                        <span className="daily-view__stance">
                          {view.stance}
                        </span>
                        <span className="daily-view__title">
                          {node.titleZh || node.title}
                        </span>
                        {node.sourceName && (
                          <span className="daily-view__source">
                            {node.sourceName}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="daily-hud__footer">
        <button
          type="button"
          className="daily-hud__enter"
          onClick={close}
        >
          进入宇宙
        </button>
        <button
          type="button"
          className="daily-hud__dismiss"
          onClick={close}
        >
          今天不再显示
        </button>
      </div>
    </div>
  );
}

/** "#RRGGBB" → "rgba(r,g,b,0.22)" — for topic glow tint */
function hexToGlow(hex: string): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return "rgba(92,200,255,0.18)";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},0.22)`;
}
