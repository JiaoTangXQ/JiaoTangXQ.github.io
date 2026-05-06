import { readFileSync } from "node:fs";
import path from "node:path";
import satori from "satori";
import type { SatoriOptions } from "satori";
import { Resvg } from "@resvg/resvg-js";

type Range = [number, number];
type Subset = {
  file: string;
  ranges: Range[];
  family: string;
  weight: number;
  style: "normal" | "italic";
};

const FRAUNCES_DIR = path.resolve("node_modules/@fontsource/fraunces");
const NOTOSC_DIR = path.resolve("node_modules/@fontsource/noto-serif-sc");

function parseRanges(spec: string): Range[] {
  return spec.split(",").map((part) => {
    const cleaned = part.trim().replace(/^U\+/i, "");
    if (cleaned.includes("-")) {
      const [a, b] = cleaned.split("-");
      return [parseInt(a, 16), parseInt(b, 16)] as Range;
    }
    const cp = parseInt(cleaned, 16);
    return [cp, cp] as Range;
  });
}

function parseFontFaceCss(
  css: string,
  dir: string,
  weight: number,
  style: "normal" | "italic",
  prefix: string,
): Subset[] {
  const out: Subset[] = [];
  const blocks = css.split("@font-face").slice(1);
  let idx = 0;
  for (const block of blocks) {
    const woffMatch = block.match(/url\(\.\/files\/([^)]+\.woff)\)/);
    const rangeMatch = block.match(/unicode-range:\s*([^;]+);/i);
    if (!woffMatch || !rangeMatch) continue;
    const file = path.join(dir, "files", woffMatch[1]);
    const ranges = parseRanges(rangeMatch[1]);
    out.push({
      file,
      ranges,
      family: `${prefix}-${idx++}`,
      weight,
      style,
    });
  }
  return out;
}

const subsetCache = new Map<string, Subset[]>();

function getSubsets(
  dir: string,
  weight: number,
  style: "normal" | "italic",
  prefix: string,
): Subset[] {
  const cssName = style === "italic" ? `${weight}-italic.css` : `${weight}.css`;
  const key = `${dir}::${cssName}::${prefix}`;
  if (subsetCache.has(key)) return subsetCache.get(key)!;
  const css = readFileSync(path.join(dir, cssName), "utf8");
  const result = parseFontFaceCss(css, dir, weight, style, prefix);
  subsetCache.set(key, result);
  return result;
}

const fontDataCache = new Map<string, Buffer>();
function loadFontData(file: string): Buffer {
  if (fontDataCache.has(file)) return fontDataCache.get(file)!;
  const data = readFileSync(file);
  fontDataCache.set(file, data);
  return data;
}

function pickSubsets(text: string, allSubsets: Subset[]): Subset[] {
  const codepoints = new Set<number>();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) codepoints.add(cp);
  }
  const used = new Set<Subset>();
  for (const cp of codepoints) {
    for (const subset of allSubsets) {
      let matched = false;
      for (const [a, b] of subset.ranges) {
        if (cp >= a && cp <= b) {
          matched = true;
          break;
        }
      }
      if (matched) {
        used.add(subset);
        // 一个字符只需一个 subset 覆盖即可，找到就停
        break;
      }
    }
  }
  return [...used];
}

function buildFonts(text: string): {
  fonts: SatoriOptions["fonts"];
  serifFamily: string;
  italicFamily: string;
} {
  const frauncesNormal = getSubsets(FRAUNCES_DIR, 500, "normal", "fr-n");
  const frauncesItalic = getSubsets(FRAUNCES_DIR, 500, "italic", "fr-i");
  const notoNormal = getSubsets(NOTOSC_DIR, 500, "normal", "ns-n");

  // 优先级：Fraunces latin 覆盖 ASCII + 标点；Noto Serif SC 覆盖 CJK
  // satori 按字体顺序匹配，Fraunces 在前可以接管 ASCII，CJK 留给 Noto
  const allNormal = [...frauncesNormal, ...notoNormal];
  const usedNormal = pickSubsets(text, allNormal);
  const usedItalic = pickSubsets(text, frauncesItalic);

  const fonts: SatoriOptions["fonts"] = [];
  for (const s of usedNormal) {
    fonts.push({
      name: s.family,
      data: loadFontData(s.file),
      weight: s.weight as 500,
      style: s.style,
    });
  }
  for (const s of usedItalic) {
    fonts.push({
      name: s.family,
      data: loadFontData(s.file),
      weight: s.weight as 500,
      style: s.style,
    });
  }

  const serifFamily = usedNormal.map((s) => `"${s.family}"`).join(", ") || "serif";
  const italicFamily =
    [...usedItalic, ...usedNormal].map((s) => `"${s.family}"`).join(", ") || "serif";

  return { fonts, serifFamily, italicFamily };
}

type OgInput = {
  title: string;
  subtitle?: string;
  date: string; // 已格式化的日期，如 "2026.05.06"
  tags: string[];
};

export async function generateOgPng(input: OgInput): Promise<Buffer> {
  const { title, subtitle, date, tags } = input;

  const visibleText = [
    title,
    subtitle ?? "",
    date,
    ...tags.map((t) => `#${t}`),
    "焦糖星球",
    "JIAOTANG XQ",
    "VOL. I",
    "·",
    "—",
  ].join("");

  const { fonts, serifFamily, italicFamily } = buildFonts(visibleText);

  // 标题字号自适应：根据字数（中文一字一格）
  const titleLength = [...title].length;
  const titleSize =
    titleLength <= 14 ? 88 : titleLength <= 22 ? 72 : titleLength <= 30 ? 60 : 52;

  type Node =
    | string
    | { type: string; props: { style?: Record<string, unknown>; children?: Node | Node[] } };

  const brandLine: Node = {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        fontSize: "22px",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "#6b5d4f",
        fontFamily: serifFamily,
        fontWeight: 500,
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#b16a1e",
            },
          },
        },
        {
          type: "span",
          props: {
            style: { display: "flex" },
            children: "焦糖星球",
          },
        },
        {
          type: "span",
          props: {
            style: {
              display: "flex",
              color: "#9a8c7c",
              letterSpacing: "0.22em",
            },
            children: "VOL. I",
          },
        },
      ],
    },
  };

  const titleNode: Node = {
    type: "div",
    props: {
      style: {
        display: "flex",
        fontSize: `${titleSize}px`,
        fontWeight: 500,
        lineHeight: 1.12,
        letterSpacing: "-0.018em",
        color: "#1c1610",
        fontFamily: serifFamily,
      },
      children: title,
    },
  };

  const subtitleNode: Node | null = subtitle
    ? {
        type: "div",
        props: {
          style: {
            display: "flex",
            fontSize: "30px",
            fontStyle: "italic",
            lineHeight: 1.4,
            color: "#6b5d4f",
            fontFamily: italicFamily,
            marginTop: "28px",
          },
          children: subtitle,
        },
      }
    : null;

  const middleBlock: Node = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: "center",
        paddingTop: "48px",
        paddingBottom: "48px",
      },
      children: [titleNode, ...(subtitleNode ? [subtitleNode] : [])],
    },
  };

  const metaItems: Node[] = [];
  metaItems.push({
    type: "span",
    props: {
      style: { display: "flex", color: "#6b5d4f", fontVariantNumeric: "tabular-nums" },
      children: date,
    },
  });
  for (const tag of tags) {
    metaItems.push({
      type: "span",
      props: {
        style: {
          display: "flex",
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          backgroundColor: "#d6c8b1",
        },
      },
    });
    metaItems.push({
      type: "span",
      props: {
        style: { display: "flex", color: "#5e7a64" },
        children: `#${tag}`,
      },
    });
  }

  const bottomLine: Node = {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        paddingTop: "32px",
        fontSize: "22px",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontFamily: serifFamily,
        fontWeight: 500,
        borderTop: "1px solid #d6c8b1",
      },
      children: metaItems,
    },
  };

  const root: Node = {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#fbf6ec",
        padding: "80px",
        color: "#1c1610",
        position: "relative",
      },
      children: [brandLine, middleBlock, bottomLine],
    },
  };

  const svg = await satori(root as never, {
    width: 1200,
    height: 630,
    fonts,
  });

  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  })
    .render()
    .asPng();

  return png;
}

type BrandedOgInput = {
  /** 顶部小字标签，默认 "焦糖星球 · VOL. I" */
  label?: string;
  /** 主标题 */
  title: string;
  /** 副标题（斜体） */
  subtitle?: string;
};

/**
 * 站默认 / hub 页用的品牌 OG 图。视觉与文章 OG 保持一致，但内容是站身份 + 主题标签。
 */
export async function generateBrandedOgPng(input: BrandedOgInput): Promise<Buffer> {
  const { label = "焦糖星球 · VOL. I", title, subtitle = "" } = input;

  const visibleText = [label, title, subtitle, "—", "·"].join("");
  const { fonts, serifFamily, italicFamily } = buildFonts(visibleText);

  const titleLength = [...title].length;
  const titleSize =
    titleLength <= 10 ? 96 : titleLength <= 18 ? 80 : titleLength <= 26 ? 64 : 56;

  type Node =
    | string
    | { type: string; props: { style?: Record<string, unknown>; children?: Node | Node[] } };

  const brandLine: Node = {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        fontSize: "24px",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: "#6b5d4f",
        fontFamily: serifFamily,
        fontWeight: 500,
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#b16a1e",
            },
          },
        },
        {
          type: "span",
          props: { style: { display: "flex" }, children: label },
        },
      ],
    },
  };

  const titleNode: Node = {
    type: "div",
    props: {
      style: {
        display: "flex",
        fontSize: `${titleSize}px`,
        fontWeight: 500,
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
        color: "#1c1610",
        fontFamily: serifFamily,
      },
      children: title,
    },
  };

  const subtitleNode: Node | null = subtitle
    ? {
        type: "div",
        props: {
          style: {
            display: "flex",
            fontSize: "32px",
            fontStyle: "italic",
            lineHeight: 1.4,
            color: "#6b5d4f",
            fontFamily: italicFamily,
            marginTop: "32px",
            maxWidth: "880px",
          },
          children: subtitle,
        },
      }
    : null;

  const middleBlock: Node = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: "center",
        paddingTop: "64px",
        paddingBottom: "64px",
      },
      children: [titleNode, ...(subtitleNode ? [subtitleNode] : [])],
    },
  };

  const tagline: Node = {
    type: "div",
    props: {
      style: {
        display: "flex",
        paddingTop: "32px",
        fontSize: "22px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        fontFamily: serifFamily,
        fontWeight: 500,
        color: "#5e7a64",
        borderTop: "1px solid #d6c8b1",
      },
      children: "中文 · AI 时代的工程实践",
    },
  };

  const root: Node = {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#fbf6ec",
        padding: "80px",
        color: "#1c1610",
        position: "relative",
      },
      children: [brandLine, middleBlock, tagline],
    },
  };

  const svg = await satori(root as never, {
    width: 1200,
    height: 630,
    fonts,
  });

  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  })
    .render()
    .asPng();

  return png;
}
