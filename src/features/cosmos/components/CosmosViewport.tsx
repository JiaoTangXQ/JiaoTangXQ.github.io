import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CosmosData,
  CosmosNode,
  SearchIndexEntry,
} from "@/lib/content/types";
import { CosmosScene } from "../scene/CosmosScene";
import { useCamera } from "../camera/useCamera";
import { useAutoCruise } from "../camera/useAutoCruise";
import { useGestures } from "../camera/useGestures";
import { loadCameraFromHash } from "../camera/urlState";
import { getLodMode } from "../nodes/nodeLod";
import { CosmosChrome } from "./CosmosChrome";
import { SummaryCard } from "./SummaryCard";
import { SearchPalette } from "./SearchPalette";
import { ThemeLens } from "./ThemeLens";
import { GalaxyCompass } from "./GalaxyCompass";
import { NodeLabels } from "./NodeLabels";
import "@/styles/cosmos-ui.css";

type Props = {
  dataset: CosmosData | null;
  searchIndex?: SearchIndexEntry[];
};

export function CosmosViewport({ dataset, searchIndex = [] }: Props) {
  // --- Camera system (owned here, shared with Three.js + DOM) ---
  const initialCamera = loadCameraFromHash();
  const cam = useCamera(initialCamera ?? undefined);
  const cruise = useAutoCruise(cam);
  const { containerRef, handlers } = useGestures(cam, cruise);

  // --- UI state ---
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<CosmosNode | null>(null);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // --- DOM overlay camera state (updated via RAF for smooth labels) ---
  const [domCamera, setDomCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  });
  const rafRef = useRef(0);

  // Sync camera ref → DOM state at ~30fps for labels/compass
  useEffect(() => {
    let running = true;
    let lastUpdate = 0;
    const tick = (now: number) => {
      if (!running) return;
      if (now - lastUpdate > 33) {
        // ~30fps
        const s = cam._stateRef.current;
        setDomCamera({ x: s.x, y: s.y, zoom: s.zoom });
        lastUpdate = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [cam]);

  // Viewport resize
  useEffect(() => {
    const onResize = () =>
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Cmd/Ctrl+K to open search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const themes = useMemo(() => {
    if (!dataset) return [];
    return Array.from(new Set(dataset.nodes.map((n) => n.cluster))).sort();
  }, [dataset]);

  const lodMode = getLodMode(domCamera.zoom);

  const handleNodeClick = useCallback(
    (slug: string) => {
      if (!dataset) return;
      const node = dataset.nodes.find((n) => n.slug === slug);
      if (node) setActiveNode(node);
    },
    [dataset],
  );

  const handleNodeHover = useCallback((slug: string | null) => {
    setHoveredSlug(slug);
  }, []);

  const handleSearchSelect = useCallback(
    (node: CosmosNode) => {
      setSearchOpen(false);
      cruise.interrupt();
      cam.flyTo(node.x, node.y, 1.8);
      setTimeout(() => setActiveNode(node), 800);
    },
    [cam, cruise],
  );

  const handleThemeChange = useCallback(
    (theme: string | null) => {
      setActiveTheme(theme);
      if (theme && dataset) {
        const cluster = dataset.clusters.find((c) => c.name === theme);
        if (cluster) {
          cruise.interrupt();
          cam.flyTo(cluster.centerX, cluster.centerY, 1.2);
        }
      }
    },
    [dataset, cam, cruise],
  );

  const handleReset = useCallback(() => {
    setActiveTheme(null);
    cruise.interrupt();
    cam.reset();
  }, [cam, cruise]);

  // --- Loading state ---
  if (!dataset) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--space-deep)",
          color: "var(--text-muted)",
          fontFamily: "var(--font-display)",
          fontSize: "1.2rem",
        }}
      >
        正在加载宇宙...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      {...handlers}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "var(--space-deep)",
        touchAction: "none",
        cursor: activeNode ? "default" : "grab",
      }}
    >
      {/* Three.js canvas */}
      <CosmosScene
        data={dataset}
        cameraRef={cam._stateRef}
        hoveredSlug={hoveredSlug}
        activeSlug={activeNode?.slug ?? null}
        activeTheme={activeTheme}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
      />

      {/* DOM overlay: node labels */}
      <NodeLabels
        nodes={dataset.nodes}
        camera={domCamera}
        viewportWidth={viewportSize.width}
        viewportHeight={viewportSize.height}
        lodMode={lodMode}
        onNodeClick={handleNodeClick}
      />

      {/* Site chrome */}
      <CosmosChrome
        onSearchOpen={() => setSearchOpen(true)}
        onReset={handleReset}
      />

      {/* Bottom tools */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          padding: "1.5rem",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <ThemeLens
            themes={themes}
            activeTheme={activeTheme}
            onChange={handleThemeChange}
          />
        </div>
        <div style={{ pointerEvents: "auto" }}>
          <GalaxyCompass
            clusters={dataset.clusters}
            cameraX={domCamera.x}
            cameraY={domCamera.y}
          />
        </div>
      </div>

      {/* Summary card */}
      {activeNode && (
        <SummaryCard
          node={activeNode}
          onClose={() => setActiveNode(null)}
          cameraHash={`x=${Math.round(domCamera.x)}&y=${Math.round(domCamera.y)}&z=${domCamera.zoom.toFixed(2)}`}
        />
      )}

      {/* Search palette */}
      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        items={dataset.nodes}
        searchIndex={searchIndex}
        onSelect={handleSearchSelect}
      />
    </div>
  );
}
