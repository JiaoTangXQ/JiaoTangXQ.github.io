/**
 * 星球点击计数 hook
 *
 * 从 Supabase 加载全局点击数据，提供 increment 方法。
 * 点击数影响星球大小：点击越多越大。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export type ClickMap = Record<string, number>;

export function usePlanetClicks() {
  const [clicks, setClicks] = useState<ClickMap>({});
  const loadedRef = useRef(false);

  // 启动时加载所有点击数
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    supabase
      .from("planet_clicks")
      .select("slug, count")
      .then(({ data, error }) => {
        if (error) {
          console.warn("[clicks] 加载失败:", error.message);
          return;
        }
        const map: ClickMap = {};
        for (const row of data ?? []) {
          map[row.slug] = row.count;
        }
        setClicks(map);
      });
  }, []);

  // 递增某个 slug 的点击数
  const increment = useCallback(async (slug: string) => {
    // 乐观更新本地状态
    setClicks((prev) => ({ ...prev, [slug]: (prev[slug] ?? 0) + 1 }));

    const { data, error } = await supabase.rpc("increment_click", {
      p_slug: slug,
    });

    if (error) {
      console.warn("[clicks] increment 失败:", error.message);
    }
  }, []);

  return { clicks, increment } as const;
}
