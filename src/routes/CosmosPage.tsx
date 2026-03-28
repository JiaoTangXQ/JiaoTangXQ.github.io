import { useEffect, useState } from "react";
import type { CosmosData, SearchIndexEntry } from "../lib/content/types";
import { CosmosViewport } from "../features/cosmos/components/CosmosViewport";

export function CosmosPage() {
  const [data, setData] = useState<CosmosData | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndexEntry[]>([]);

  useEffect(() => {
    fetch("/data/cosmos.json")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);

    fetch("/data/search-index.json")
      .then((r) => r.json())
      .then(setSearchIndex)
      .catch(console.error);
  }, []);

  return <CosmosViewport dataset={data} searchIndex={searchIndex} />;
}
