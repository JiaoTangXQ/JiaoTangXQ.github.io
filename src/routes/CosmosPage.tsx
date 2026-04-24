import { useEffect, useState } from "react";
import type { CosmosData, SearchIndexEntry } from "../lib/content/types";
import { CosmosViewport } from "../features/cosmos/components/CosmosViewport";
import { loadCosmos } from "../lib/content/cosmosCache";

export function CosmosPage() {
  const [data, setData] = useState<CosmosData | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndexEntry[]>([]);

  useEffect(() => {
    loadCosmos().then(setData).catch(console.error);

    fetch("/data/search-index.json")
      .then((r) => r.json())
      .then(setSearchIndex)
      .catch(console.error);
  }, []);

  return <CosmosViewport dataset={data} searchIndex={searchIndex} />;
}
