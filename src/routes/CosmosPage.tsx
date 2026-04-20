import { useEffect, useState } from "react";
import type { CosmosData, SearchIndexEntry } from "../lib/content/types";
import type { DailyData } from "../features/daily/DailyTopicsHUD";
import { CosmosViewport } from "../features/cosmos/components/CosmosViewport";

export function CosmosPage() {
  const [data, setData] = useState<CosmosData | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndexEntry[]>([]);
  const [daily, setDaily] = useState<DailyData | null>(null);

  useEffect(() => {
    fetch("/data/cosmos.json")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);

    fetch("/data/search-index.json")
      .then((r) => r.json())
      .then(setSearchIndex)
      .catch(console.error);

    fetch("/data/daily.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DailyData | null) => setDaily(d))
      .catch(() => setDaily(null));
  }, []);

  return (
    <CosmosViewport dataset={data} searchIndex={searchIndex} daily={daily} />
  );
}
