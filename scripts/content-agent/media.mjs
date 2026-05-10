import { absoluteUrl, decodeEntities, stableHash } from "./utils.mjs";

export function extractMediaFromHtml(html = "", { baseUrl = "" } = {}) {
  const text = decodeEntities(html);
  const images = [];
  const videos = [];

  for (const match of text.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    pushMedia(images, match[1], baseUrl);
  }
  for (const match of text.matchAll(/<video\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    pushMedia(videos, match[1], baseUrl);
  }
  for (const match of text.matchAll(/<source\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const tag = match[0];
    const target = /video|mp4|webm|mov/i.test(tag) ? videos : images;
    pushMedia(target, match[1], baseUrl);
  }
  for (const match of text.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    if (/youtube\.com|youtu\.be|bilibili\.com|vimeo\.com/i.test(match[1])) {
      pushMedia(videos, match[1], baseUrl);
    }
  }

  return { images: unique(images), videos: unique(videos) };
}

export function extractMediaFromXml(block = "", { baseUrl = "" } = {}) {
  const media = extractMediaFromHtml(block, { baseUrl });
  const text = decodeEntities(block);

  for (const match of text.matchAll(/<(media:content|media:thumbnail|enclosure)\b[^>]*\burl=["']([^"']+)["'][^>]*>/gi)) {
    const tag = match[0];
    const url = match[2];
    if (/video|mp4|webm|mov|medium=["']video/i.test(tag) || /\.(mp4|webm|mov)(?:[?#]|$)/i.test(url)) {
      pushMedia(media.videos, url, baseUrl);
    } else if (/image|jpg|jpeg|png|gif|webp|avif|medium=["']image/i.test(tag) || /\.(jpg|jpeg|png|gif|webp|avif)(?:[?#]|$)/i.test(url)) {
      pushMedia(media.images, url, baseUrl);
    }
  }

  return { images: unique(media.images), videos: unique(media.videos) };
}

export function mergeMedia(...items) {
  const images = [];
  const videos = [];
  for (const item of items) {
    images.push(...(item?.images ?? []));
    videos.push(...(item?.videos ?? []));
  }
  return { images: unique(images), videos: unique(videos) };
}

export function githubPreviewMedia(url) {
  const match = String(url ?? "").match(/^https:\/\/github\.com\/([^/?#]+)\/([^/?#]+)/i);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, "");
  return `https://opengraph.githubassets.com/${stableHash(`https://github.com/${owner}/${repo}`).slice(0, 8)}/${owner}/${repo}`;
}

function pushMedia(target, url, baseUrl) {
  const value = absoluteUrl(String(url ?? "").trim(), baseUrl);
  if (!value || /^data:/i.test(value) || isBoilerplateMedia(value)) return;
  target.push(value);
}

function isBoilerplateMedia(url) {
  return /qrcode|qr-code|favicon|logo|avatar|\/themes?\/|head\.jpg|placeholder|sprite/i.test(String(url ?? ""));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
