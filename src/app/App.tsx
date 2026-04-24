import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CosmosPage } from "../routes/CosmosPage";

const ArticlePage = lazy(() =>
  import("../routes/ArticlePage").then((mod) => ({
    default: mod.ArticlePage,
  })),
);

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--space-deep, #060a14)",
        color: "var(--text-muted, #a8b3cf)",
        fontFamily: "var(--font-display, system-ui, sans-serif)",
      }}
    >
      正在加载...
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CosmosPage />} />
        <Route
          path="/article/:slug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ArticlePage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
