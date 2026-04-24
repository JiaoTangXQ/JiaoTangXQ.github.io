import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CosmosData,
  CosmosNode,
} from "@/lib/content/types";
import { CosmosScene } from "../scene/CosmosScene";
import { CosmosErrorBoundary } from "./ErrorBoundary";
import { useCamera } from "../camera/useCamera";
import { useAutoCruise } from "../camera/useAutoCruise";
import { useGestures } from "../camera/useGestures";
import { useZoomTransition } from "../camera/useZoomTransition";
import { loadCameraFromHash } from "../camera/urlState";
import { usePlanetClicks } from "@/lib/usePlanetClicks";
import { getLodMode } from "../nodes/nodeLod";
import { CosmosChrome } from "./CosmosChrome";
import { SummaryCard } from "./SummaryCard";
import { SearchPalette } from "./SearchPalette";
import { TransitionOverlay } from "./TransitionOverlay";
import { GalaxyCompass } from "./GalaxyCompass";
import { NodeLabels } from "./NodeLabels";
import { JumpToast } from "./JumpToast";
import { pickStrangestNode } from "../nodes/pickStrangestNode";
import { readVisited, recordVisit } from "../nodes/personalHistory";
import { BlindspotHUD } from "@/features/blindspot/BlindspotHUD";
import "@/styles/cosmos-ui.css";

type Props = {
  dataset: CosmosData | null;
};

export function CosmosViewport({
  dataset,
}: Props) {
  // --- Camera system (owned here, shared with Three.js + DOM) ---
  const initialCamera = loadCameraFromHash();
  const cam = useCamera(initialCamera ?? undefined);
  const cruise = useAutoCruise(cam);
  const { containerRef, handlers } = useGestures(cam, cruise);
  const transition = useZoomTransition(cam);
  const { clicks, increment: incrementClick } = usePlanetClicks();

  // 从文章页返回时触发缩回动画
  useEffect(() => {
    transition.handleReturn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- UI state ---
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const hoveredSlugRef = useRef<string | null>(null);
  const [activeNode, setActiveNode] = useState<CosmosNode | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // --- Jump (异星跃迁) state ---
  const [jumpPhase, setJumpPhase] = useState<
    "idle" | "locating" | "jumping"
  >("idle");
  const [jumpInfo, setJumpInfo] = useState<{
    reason: string;
    cluster: string;
  } | null>(null);

  // --- Blindspot (盲区地图) state ---
  const [blindspotActive, setBlindspotActive] = useState(false);
  const [visitedSet, setVisitedSet] = useState<Set<string>>(() => readVisited());

  // 刷新本地阅读历史：组件 mount + 从文章返回后
  const refreshVisited = useCallback(() => {
    setVisitedSet(readVisited());
  }, []);

  useEffect(() => {
    refreshVisited();
    // storage 事件：跨标签同步
    const onStorage = () => refreshVisited();
    window.addEventListener("storage", onStorage);
    // focus 事件：回到标签页时刷新（覆盖"在文章页读完再回来"的场景）
    window.addEventListener("focus", refreshVisited);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshVisited);
    };
  }, [refreshVisited]);

  // --- DOM overlay camera state (updated via RAF for smooth labels) ---
  const [domCamera, setDomCamera] = useState(() => {
    const s = cam._stateRef.current;
    return { x: s.x, y: s.y, zoom: s.zoom };
  });
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  });
  const rafRef = useRef(0);

  // Sync camera ref → DOM state at ~30fps for labels/compass
  // 仅在相机真的动了时才 setState，避免静止时每帧重建对象触发 NodeLabels 重算
  const prevDomCamRef = useRef(domCamera);
  useEffect(() => {
    let running = true;
    let lastUpdate = 0;
    const tick = (now: number) => {
      if (!running) return;
      if (now - lastUpdate > 33) {
        const s = cam._stateRef.current;
        const prev = prevDomCamRef.current;
        // 像素级阈值：位移 >0.5 或 zoom 变化 >0.001 才算动了
        if (
          Math.abs(prev.x - s.x) > 0.5 ||
          Math.abs(prev.y - s.y) > 0.5 ||
          Math.abs(prev.zoom - s.zoom) > 0.001
        ) {
          prevDomCamRef.current = { x: s.x, y: s.y, zoom: s.zoom };
          setDomCamera({ x: s.x, y: s.y, zoom: s.zoom });
        }
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

  const lodMode = getLodMode(domCamera.zoom);

  const handleNodeClick = useCallback(
    (slug: string) => {
      if (!dataset) return;
      const node = dataset.nodes.find((n) => n.slug === slug);
      if (!node) return;

      incrementClick(slug);
      cruise.interrupt();

      const targetZoom = Math.max(cam._stateRef.current.zoom, 1.5);
      cam.flyTo(node.x, node.y, targetZoom);
      setTimeout(() => setActiveNode(node), 500);
    },
    [dataset, cam, cruise, incrementClick],
  );

  // 记录 mousedown 位置，区分拖拽和点击
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  /** 点击画布时，检查是否点中了某颗星球（排除拖拽） */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!dataset || activeNode || transition.isTransitioning) return;

      // 拖拽超过 5px 不算点击
      const down = pointerDownRef.current;
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (dx * dx + dy * dy > 25) return;
      }

      // 将屏幕坐标转为世界坐标
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { x: cx, y: cy, zoom } = cam._stateRef.current;
      const frustumW = 1600;
      const frustumH = 1200;
      const scaleX = (rect.width / frustumW) * zoom;
      const scaleY = (rect.height / frustumH) * zoom;
      const worldX = cx + (e.clientX - rect.left - rect.width / 2) / scaleX;
      const worldY = cy - (e.clientY - rect.top - rect.height / 2) / scaleY;

      // 找最近的星球（在点击半径内）
      const hitRadius = 40 / zoom; // 屏幕上 40px 的点击容差
      let closest: CosmosNode | null = null;
      let closestDist = Infinity;

      for (const node of dataset.nodes) {
        const dx = node.x - worldX;
        const dy = node.y - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < hitRadius && dist < closestDist) {
          closest = node;
          closestDist = dist;
        }
      }

      if (closest) {
        handleNodeClick(closest.slug);
      }
    },
    [dataset, activeNode, cam, transition.isTransitioning, handleNodeClick],
  );

  const handleNodeHover = useCallback((slug: string | null) => {
    if (hoveredSlugRef.current === slug) return;
    hoveredSlugRef.current = slug;
    setHoveredSlug(slug);
  }, []);

  /** 搜索飞行效果：先微缩 → 飞向目标 → 推近 → 展开卡片 */
  const handleSearchSelect = useCallback(
    (node: CosmosNode) => {
      setSearchOpen(false);
      cruise.interrupt();

      const current = cam._stateRef.current;
      const dx = node.x - current.x;
      const dy = node.y - current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 200) {
        // 近距离：直接飞过去
        cam.flyTo(node.x, node.y, 1.8);
        setTimeout(() => setActiveNode(node), 500);
      } else {
        // 远距离：先微缩出 → 飞行 → 推近
        const zoomOut = Math.max(0.6, current.zoom - 0.3);
        cam.flyTo(current.x, current.y, zoomOut);
        setTimeout(() => {
          cam.flyTo(node.x, node.y, 1.8);
          setTimeout(() => setActiveNode(node), 600);
        }, 300);
      }
    },
    [cam, cruise],
  );

  /** 从 SummaryCard 点击"阅读全文"：触发缩放过渡 */
  const handleNavigateToArticle = useCallback(
    (node: CosmosNode) => {
      recordVisit(node.slug);
      setActiveNode(null);
      cruise.interrupt();
      transition.enterArticle(node);
    },
    [cruise, transition],
  );

  const handleReset = useCallback(() => {
    cruise.interrupt();
    cam.reset();
  }, [cam, cruise]);

  /** 异星跃迁：拉远 → 定位陌生目标 → 飞过去 → 展开摘要卡 */
  const handleJump = useCallback(() => {
    if (!dataset || jumpPhase !== "idle") return;

    cruise.interrupt();
    setActiveNode(null);
    setJumpPhase("locating");

    // Phase 1: 拉远 + "定位中"
    const current = cam._stateRef.current;
    const zoomOut = Math.max(0.5, current.zoom - 0.35);
    cam.flyTo(current.x, current.y, zoomOut);

    // Phase 2: 600ms 后计算目标并开跳
    window.setTimeout(() => {
      const visited = readVisited();
      const result = pickStrangestNode(dataset.nodes, visited);
      if (!result) {
        setJumpPhase("idle");
        return;
      }
      setJumpInfo({ reason: result.reason, cluster: result.node.cluster });
      setJumpPhase("jumping");
      cam.flyTo(result.node.x, result.node.y, 1.8);

      // Phase 3: 到位后展开摘要卡并清理
      window.setTimeout(() => {
        setActiveNode(result.node);
        setJumpPhase("idle");
        window.setTimeout(() => setJumpInfo(null), 400);
      }, 800);
    }, 600);
  }, [dataset, jumpPhase, cam, cruise]);

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
      onPointerDown={handlePointerDown}
      onClick={handleCanvasClick}
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
      <CosmosErrorBoundary>
      <CosmosScene
        data={dataset}
        clicks={clicks}
        cameraRef={cam._stateRef}
        hoveredSlug={hoveredSlug}
        activeSlug={activeNode?.slug ?? null}
        activeTheme={null}
        visitedSet={visitedSet}
        blindspotTarget={blindspotActive ? 1 : 0}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
      />
      </CosmosErrorBoundary>

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
        onJump={handleJump}
        jumping={jumpPhase !== "idle"}
      />

      {/* 异星跃迁提示 */}
      <JumpToast
        visible={jumpPhase !== "idle"}
        phase={jumpPhase === "idle" ? "jumping" : jumpPhase}
        reason={jumpInfo?.reason}
        cluster={jumpInfo?.cluster}
      />

      {/* Bottom tools */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "flex-end",
          padding: "1.5rem",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <GalaxyCompass
            clusters={dataset.clusters}
            cameraX={domCamera.x}
            cameraY={domCamera.y}
          />
        </div>
      </div>

      {/* 缩放过渡遮罩 */}
      <TransitionOverlay
        opacity={transition.overlayOpacity}
        duration={transition.fadeDuration}
        visible={transition.isTransitioning}
      />

      {/* Summary card */}
      {activeNode && !transition.isTransitioning && (
        <SummaryCard
          node={activeNode}
          onClose={() => setActiveNode(null)}
          onNavigate={handleNavigateToArticle}
          cameraHash={`x=${Math.round(domCamera.x)}&y=${Math.round(domCamera.y)}&z=${domCamera.zoom.toFixed(2)}`}
        />
      )}

      {/* Search palette */}
      {searchOpen && (
        <SearchPalette
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          items={dataset.nodes}
          onSelect={handleSearchSelect}
        />
      )}

      {/* 盲区地图 HUD */}
      <BlindspotHUD
        nodes={dataset.nodes}
        visited={visitedSet}
        active={blindspotActive}
        onToggle={() => setBlindspotActive((v) => !v)}
        onJumpToBlindspot={handleJump}
      />
    </div>
  );
}
