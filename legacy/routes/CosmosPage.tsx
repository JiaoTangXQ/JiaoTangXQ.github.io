import { useEffect, useState } from "react";
import type { CosmosData } from "../lib/content/types";
import { CosmosViewport } from "../features/cosmos/components/CosmosViewport";
import { loadCosmos } from "../lib/content/cosmosCache";

export function CosmosPage() {
  const [data, setData] = useState<CosmosData | null>(null);

  useEffect(() => {
    loadCosmos().then(setData).catch(console.error);
  }, []);

  return <CosmosViewport dataset={data} />;
}
