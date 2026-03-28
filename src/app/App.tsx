import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CosmosPage } from "../routes/CosmosPage";
import { ArticlePage } from "../routes/ArticlePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CosmosPage />} />
        <Route path="/article/:slug" element={<ArticlePage />} />
      </Routes>
    </BrowserRouter>
  );
}
