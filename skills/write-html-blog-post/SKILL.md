---
name: write-html-blog-post
description: Create privacy-safe HTML blog articles for a personal Astro/GitHub Pages blog. Use when the user asks Codex to generate, rewrite, migrate, or publish a blog post from notes, Markdown, HTML, drafts, screenshots, or rough ideas.
---

# Write HTML Blog Post

## Core Rule

Generate a structured blog post, not a standalone web page. Default output is an HTML body fragment plus metadata so the site can render lists, RSS, search, OG tags, and an Obsidian-like graph.

## Repository Contract

When working in `JiaoTangXQ.github.io`, create the finished article directly in this exact location:

```text
src/content/html-posts/<slug>/
  meta.yaml
  index.html
  assets/        # optional; create only when the post uses local media
```

Do not create blog posts under `public/`, `dist/`, `src/pages/`, `src/content/dailies/`, or a new parallel content system.

Do not modify site renderer code, layouts, package files, existing posts, or global styles while creating a new article. The blog-writing agent owns only the new post folder.

Do not commit, push, deploy, or edit git history unless the user explicitly asks. Leave the generated post folder for the site integrator to review and submit.

If `src/content/html-posts/` does not exist, create it. If the repo later implements a different blog content path, inspect the repo and follow the existing renderer instead of reviving this path.

## Folder Naming

`<slug>` is the public URL slug for `/posts/<slug>/`.

Rules:

- Lowercase ASCII kebab-case only: `a-z`, `0-9`, `-`.
- Prefer 2-7 meaningful words: `why-i-use-html-posts`, not `post1` or a date-only name.
- Do not include private names, company/client names, local places, order IDs, repo names, or secrets.
- If the title is Chinese, use a short English or pinyin meaning-based slug.
- If a folder with the same slug exists, stop and ask before overwriting.

Valid:

```text
src/content/html-posts/my-codex-writing-flow/
src/content/html-posts/reading-note-on-agents/
```

Invalid:

```text
src/content/html-posts/2026-05-13/
src/content/html-posts/article1/
src/content/html-posts/my-client-incident/
```

## Required Files

Every post folder must contain exactly these required files:

```text
meta.yaml
index.html
```

Create `assets/` only if the article references local media.

Do not create standalone CSS, JS, JSON, Markdown, README, or duplicated export files unless the user explicitly asks and the reason is article-specific.

## Required Metadata

`meta.yaml` must include:

```yaml
title: "Readable title"
date: "YYYY-MM-DD"
description: "One concrete summary for SEO, RSS, cards, and sharing."
tags: ["tag-a", "tag-b"]
draft: true
ui: "minimal-essay"
```

Optional fields:

```yaml
updated: "YYYY-MM-DD"
originalUrl: "https://..."
canonical: "https://..."
cover: "./assets/cover.jpg"
coverAlt: "Specific, non-private image description"
lang: "zh-CN"
```

## Draft Policy

Use `draft: false` when the user asks for a blog post to be generated into this repository, committed, submitted, published, made visible, or handed off for deployment.

Use `draft: true` only when the user explicitly says it is a draft, work in progress, private review copy, unpublished note, or not ready to appear on the site.

If the user's intent is unclear, stop and ask. Do not guess.

Metadata rules:

- `title`: human-readable article title, not clickbait and not just a filename.
- `date`: use the user's requested publish date; otherwise use the current local date.
- `description`: 50-160 Chinese characters or 80-180 English characters; mention the actual topic.
- `tags`: 2-8 tags. Use tags for retrieval, not decoration.
- `ui`: must be one value from [UI variants](references/ui-variants.md).
- `cover` must point to a local asset path inside the same post folder.
- `draft: false` appears on the homepage, RSS, tag pages, search, and graph. `draft: true` only gets a direct article URL with `noindex`.

## HTML Rules

- Write `index.html` as a fragment: no `<!doctype>`, `<html>`, `<head>`, `<body>`, analytics, external fonts, or global CSS.
- Use semantic HTML: `<article>`, `<section>`, `<h2>`, `<p>`, `<blockquote>`, `<figure>`, `<figcaption>`, `<pre><code>`, `<ul>`, `<ol>`.
- Do not include inline scripts unless the article cannot work without interaction; if scripts are needed, explain the reason and isolate them.
- Use local asset paths such as `./assets/diagram.png`.
- Add useful `alt` text for images; do not put private details in `alt`, filenames, comments, or data attributes.
- Use `[[concept]]` for graph concepts and normal links for URLs. Add 3-8 meaningful wiki-links when the article naturally contains concepts worth connecting.
- Do not stuff tags or wiki-links. If a concept is not actually discussed, omit it.

`index.html` should normally start with:

```html
<article class="html-post html-post--minimal-essay">
  <header class="html-post__header">
    <p class="html-post__eyebrow">Note</p>
    <h1>Readable title</h1>
    <p class="html-post__deck">One paragraph that tells readers why this post exists.</p>
  </header>
  ...
</article>
```

Change the modifier class to match the selected `ui`, for example `html-post--case-study` or `html-post--code-lab`.

## Privacy Gate

Before writing the final article, remove or generalize private material:

- Exact address, phone, personal email, ID/passport/license numbers, bank/payment info.
- API keys, tokens, secrets, internal URLs, private repo names, local filesystem paths, order IDs.
- Names or identifying details of non-public people unless the user explicitly says they are public and publishable.
- Private employer/client/project details that could identify a person, company, unreleased product, contract, incident, or account.
- Screenshots or copied chat logs unless all personal data is redacted.
- Precise real-time location, travel plan, home/work routine, or family details.

If a source contains credentials or keys, stop and tell the user they should rotate them. If unsure whether a detail is private, redact or generalize it.

## Generation Workflow

1. Identify the source type: rough idea, notes, existing HTML, Markdown, transcript, or images.
2. Extract the publishable argument, examples, and evidence. Do not invent personal facts.
3. Choose a UI variant from [UI variants](references/ui-variants.md). Do not ask the user unless the UI affects meaning.
4. Choose a slug in lowercase kebab-case. Prefer meaning over date-only names.
5. Create `src/content/html-posts/<slug>/`.
6. Write `meta.yaml` and `index.html` in that folder.
7. Put local media under `assets/` and reference it with `./assets/...`.
8. Run a privacy self-audit against the gate above.
9. If working inside a repo, run the cheapest relevant validation command available. If no renderer exists yet, validate file paths and YAML syntax only.
10. Report the exact folder path, chosen UI variant, tags, wiki-links, redactions, and assumptions.

## Handoff Checklist

Before finishing, ensure:

- The post folder is under `src/content/html-posts/`.
- `meta.yaml` exists and has all required fields.
- `index.html` is an HTML fragment, not a full document.
- Every local image/video path resolves inside the post folder.
- No private material remains in text, filenames, alt text, comments, or metadata.
- The post has 2-8 tags and only natural `[[concept]]` links.
- The final response lists files created and whether `draft` is `true` or `false`.

## Quality Bar

- The article must have one clear center of gravity: a claim, story, note, guide, or record.
- The first screen should tell readers why this post exists.
- Keep structure scannable: short sections, concrete headings, no decorative filler.
- Prefer specific examples over broad claims.
- Preserve the user's voice when rewriting, but remove private or identifying details.
