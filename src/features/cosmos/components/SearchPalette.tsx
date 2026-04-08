import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MiniSearch from "minisearch";
import type { CosmosNode, SearchIndexEntry } from "@/lib/content/types";
import { getPalette } from "@/lib/content/types";
import "@/styles/cosmos-ui.css";

type Props = {
  open: boolean;
  onClose: () => void;
  items: CosmosNode[];
  searchIndex: SearchIndexEntry[];
  onSelect: (node: CosmosNode) => void;
};

type ScoredResult = {
  node: CosmosNode;
  score: number;
};

export function SearchPalette({
  open,
  onClose,
  items,
  searchIndex,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  // slug → CosmosNode 映射
  const nodeMap = useMemo(() => {
    const map = new Map<string, CosmosNode>();
    for (const node of items) {
      map.set(node.slug, node);
    }
    return map;
  }, [items]);

  // 构建 MiniSearch 索引（模糊搜索 + 前缀匹配 + 字段权重）
  const miniSearch = useMemo(() => {
    const ms = new MiniSearch<{ id: string; title: string; summary: string; topics_text: string; body: string }>({
      fields: ["title", "summary", "topics_text", "body"],
      storeFields: ["id"],
      searchOptions: {
        boost: { title: 5, summary: 2, topics_text: 3, body: 1 },
        fuzzy: 0.2,
        prefix: true,
      },
    });

    ms.addAll(
      searchIndex.map((entry) => ({
        id: entry.slug,
        title: entry.title,
        summary: entry.summary,
        topics_text: entry.topics.join(" "),
        body: entry.body,
      })),
    );

    return ms;
  }, [searchIndex]);

  // 搜索结果
  const results: ScoredResult[] = useMemo(() => {
    if (!deferredQuery.trim()) {
      return items
        .map((node) => ({ node, score: 0 }))
        .sort(
          (a, b) =>
            new Date(b.node.date).getTime() - new Date(a.node.date).getTime(),
        );
    }

    return miniSearch
      .search(deferredQuery)
      .map((result) => {
        const node = nodeMap.get(result.id as string);
        return node ? { node, score: result.score } : null;
      })
      .filter((r): r is ScoredResult => r !== null);
  }, [deferredQuery, items, miniSearch, nodeMap]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [results.length, deferredQuery]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Small delay to wait for animation
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Trap focus inside palette
  useEffect(() => {
    if (!open) return;

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const palette = paletteRef.current;
      if (!palette) return;

      const focusable = palette.querySelectorAll<HTMLElement>(
        'input, button, a, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[activeIndex]) {
            onSelect(results[activeIndex].node);
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, activeIndex, onSelect, onClose]
  );

  // Scroll active result into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const active = resultsRef.current.querySelector(
      ".search-palette__result--active"
    );
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // Close on overlay click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className={`search-palette-overlay${open ? " search-palette-overlay--open" : ""}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="搜索文章"
    >
      <div
        ref={paletteRef}
        className="search-palette"
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="search-palette__input-wrap">
          <span className="search-palette__search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={inputRef}
            className="search-palette__input"
            type="text"
            placeholder="搜索文章..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="搜索文章"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="search-palette__results"
          role="listbox"
          aria-label="搜索结果"
        >
          {results.length === 0 && deferredQuery.trim() ? (
            <div className="search-palette__empty">未找到相关文章</div>
          ) : (
            results.map((result, i) => {
              const palette = getPalette(result.node.cluster);
              return (
                <div
                  key={result.node.slug}
                  className={`search-palette__result${i === activeIndex ? " search-palette__result--active" : ""}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => {
                    onSelect(result.node);
                    onClose();
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span
                    className="search-palette__result-dot"
                    style={{ background: palette.core[0] }}
                  />
                  <div className="search-palette__result-info">
                    <div className="search-palette__result-title">
                      {result.node.title}
                    </div>
                    <div className="search-palette__result-date">
                      {result.node.date}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Keyboard hints */}
        <div className="search-palette__hint">
          <span className="search-palette__hint-key">
            <kbd className="search-palette__hint-kbd">↑↓</kbd> 导航
          </span>
          <span className="search-palette__hint-key">
            <kbd className="search-palette__hint-kbd">↵</kbd> 选择
          </span>
          <span className="search-palette__hint-key">
            <kbd className="search-palette__hint-kbd">esc</kbd> 关闭
          </span>
        </div>
      </div>
    </div>
  );
}
