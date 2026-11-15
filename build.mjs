// Site builder. No dependencies: Markdown is parsed by the vendored copy of
// `marked` in lib/. Run `node build.mjs` to build into dist/, or
// `node build.mjs --dev` to build (drafts included), serve on
// http://localhost:4321 and rebuild whenever you save a file.

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { marked } from "./lib/marked.esm.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "dist");
const DEV = process.argv.includes("--dev");
const PORT = 4321;

// ---------- helpers ----------
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const write = (rel, content) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const copyDir = (from, to) => {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
};

// Tiny front matter reader: `key: value` lines between --- fences.
// Supports strings, numbers, true/false and [a, b] lists.
function parseFrontMatter(src, file) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i === -1) throw new Error(`${file}: can't read front matter line "${line}"`);
    const key = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(",").map((s) => unquote(s.trim())).filter(Boolean);
    else if (v === "true" || v === "false") v = v === "true";
    else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
    else v = unquote(v);
    data[key] = v;
  }
  return { data, body: src.slice(m[0].length) };
}
const unquote = (s) => s.replace(/^(["'])(.*)\1$/, "$2");

const fmtDate = (d) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

const STATUS = {
  working: "Working",
  "in-progress": "In progress",
  stalled: "Stalled",
  abandoned: "Abandoned",
};
const statusKey = (s = "") => String(s).toLowerCase().trim().replace(/\s+/g, "-");

// ---------- content ----------
function loadPosts() {
  const dir = path.join(ROOT, "posts");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => {
      const { data, body } = parseFrontMatter(fs.readFileSync(path.join(dir, f), "utf8"), f);
      if (!data.title) throw new Error(`posts/${f}: needs a title`);
      if (!data.date || isNaN(new Date(data.date))) throw new Error(`posts/${f}: needs a date like 2026-10-31`);
      return {
        ...data,
        slug: f.replace(/\.md$/, ""),
        date: new Date(data.date),
        status: statusKey(data.status),
        html: marked.parse(body),
      };
    })
    .filter((p) => DEV || !p.draft)
    .sort((a, b) => b.date - a.date);
}

// Ranked lists: each folder in lists/ holds items.json (the ranking) and
// page.html (that list's own theme, with <!--LIST--> where the rows go).
// These are read-only snapshots of the editable lists on claude.ai.
const LIST_ORDER = ["games", "albums", "ghibli", "anime", "cartoons"];

function loadLists() {
  const dir = path.join(ROOT, "lists");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, "items.json")))
    .map((e) => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, e.name, "items.json"), "utf8"));
      const page = fs.readFileSync(path.join(dir, e.name, "page.html"), "utf8");
      return { slug: e.name, page, ...data };
    })
    .sort((a, b) => {
      const ia = LIST_ORDER.indexOf(a.slug), ib = LIST_ORDER.indexOf(b.slug);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.slug.localeCompare(b.slug);
    });
}

// ---------- templates ----------
const SHELLS = [
  ["grape", "Grape"],
  ["berry", "Berry"],
  ["kiwi", "Kiwi"],
  ["dandelion", "Dandelion"],
  ["teal", "Teal"],
  ["atomic", "Atomic purple"],
];

function layout(site, { title, description, body, home = false, canonical = "/" }) {
  const full = title ? `${title} | ${site.title}` : site.title;
  return `<!doctype html>
<html lang="en" data-shell="${esc(site.defaultShell || "grape")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description || site.tagline)}">
<link rel="canonical" href="${esc(site.url.replace(/\/$/, "") + canonical)}">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="/feed.xml">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/cartridge.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="/style.css">
<script>try{var s=localStorage.getItem("shell");if(s)document.documentElement.dataset.shell=s}catch(e){}</script>
</head>
<body${home ? ' class="home"' : ""}>
<a class="skip" href="#main">Skip to content</a>
<header class="shell">
  <nav class="bar" aria-label="Site">
    <a class="brand" href="/"><span class="led" aria-hidden="true"></span>${esc(site.title)}</a>
    <ul>
      <li><a href="/">Posts</a></li>
      <li><a href="/lists/">Lists</a></li>
      <li><a href="/about/">About</a></li>
      <li><a href="/feed.xml">RSS</a></li>
    </ul>
  </nav>${home ? hero(site) : ""}
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="picker" role="group" aria-label="Shell color">
    <span>Shell color</span>
    ${SHELLS.map(([k, n]) => `<button type="button" data-pick="${k}" title="${n}" aria-label="${n}"></button>`).join("")}
  </div>
  <p>&copy; ${new Date().getFullYear()} ${esc(site.author)}</p>
</footer>
<script>
document.querySelectorAll("[data-pick]").forEach(function(b){
  var cur=document.documentElement.dataset.shell;
  b.setAttribute("aria-pressed", b.dataset.pick===cur);
  b.addEventListener("click",function(){
    document.documentElement.dataset.shell=b.dataset.pick;
    try{localStorage.setItem("shell",b.dataset.pick)}catch(e){}
    document.querySelectorAll("[data-pick]").forEach(function(x){x.setAttribute("aria-pressed",x===b)});
  });
});
</script>
</body>
</html>`;
}

// The home page "screen": the site title drops in like a boot logo.
function hero(site) {
  const letters = [...site.title]
    .map((c, i) => (c === " " ? " " : `<span class="c${i % 5}">${esc(c)}</span>`))
    .join("");
  return `
  <div class="bezel">
    <div class="screen">
      <h1 class="boot" aria-label="${esc(site.title)}"><span aria-hidden="true">${letters}</span></h1>
      <p class="tagline">${esc(site.tagline)}</p>
    </div>
  </div>`;
}

const statusPill = (s) =>
  s && STATUS[s] ? `<span class="pill pill-${s}">${STATUS[s]}</span>` : "";

function meter(n) {
  const v = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  const cells = Array.from({ length: 5 }, (_, i) => `<i${i < v ? ' class="on"' : ""}></i>`).join("");
  const level = v <= 2 ? "low" : v === 3 ? "mid" : "high";
  return `<span class="meter meter-${level}" role="img" aria-label="Difficulty ${v} of 5">${cells}</span><span class="meter-num">${v}/5</span>`;
}

function postCard(p) {
  return `<li class="slot">
  <a href="/posts/${p.slug}/">
    <h3>${esc(p.title)}</h3>
    ${p.summary ? `<p>${esc(p.summary)}</p>` : ""}
    <div class="meta">
      <time datetime="${p.date.toISOString().slice(0, 10)}">${fmtDate(p.date)}</time>
      ${p.project ? `<span>${esc(p.project)}</span>` : ""}
      ${statusPill(p.status)}${p.draft ? '<span class="pill pill-draft">Draft</span>' : ""}
    </div>
  </a>
</li>`;
}

function homePage(site, posts) {
  const list = posts.length
    ? `<ol class="slots">${posts.map(postCard).join("\n")}</ol>`
    : `<p class="empty">No posts yet. Copy <code>posts/_template.md</code> to start one.</p>`;
  return `<div class="dialog intro"><p>${esc(site.intro)}</p><span class="more" aria-hidden="true">▼</span></div>
<section class="list" aria-labelledby="posts-h">
  <h2 id="posts-h">Posts</h2>
  <div class="dialog menu">${list}</div>
</section>`;
}

function postPage(p, prev, next) {
  const stats = [
    ["Status", STATUS[p.status] ? statusPill(p.status) : ""],
    ["Time spent", esc(p.time || "")],
    ["Cost", esc(p.cost || "")],
    ["Difficulty", p.difficulty ? meter(p.difficulty) : ""],
  ].filter(([, v]) => v);
  return `<article class="post">
  <header>
    <p class="meta">
      <time datetime="${p.date.toISOString().slice(0, 10)}">${fmtDate(p.date)}</time>
      ${p.project ? `<span>${esc(p.project)}</span>` : ""}
      ${p.draft ? '<span class="pill pill-draft">Draft</span>' : ""}
    </p>
    <h1>${esc(p.title)}</h1>
    ${p.summary ? `<p class="lede">${esc(p.summary)}</p>` : ""}
  </header>
  ${stats.length ? `<dl class="dialog stats">${stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}
  <div class="prose">
${p.html}
  </div>
</article>
<nav class="pager" aria-label="More posts">
  ${next ? `<a rel="next" href="/posts/${next.slug}/"><span>Newer</span>${esc(next.title)}</a>` : "<span></span>"}
  ${prev ? `<a rel="prev" href="/posts/${prev.slug}/"><span>Older</span>${esc(prev.title)}</a>` : "<span></span>"}
</nav>`;
}

const EXT_ICON = '<svg class="ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

// One themed, read-only page per list. Rows use the same markup as the
// claude.ai pages so their CSS applies unchanged.
function listPage(site, list) {
  const rows = list.items
    .map((it, i) => {
      const cover = it.cover
        ? `<div class="cover has-art"><img src="${esc(it.cover)}" alt="" loading="${i < 8 ? "eager" : "lazy"}" decoding="async"></div>`
        : `<div class="cover"></div>`;
      const title = it.link
        ? `<a class="title" href="${esc(it.link)}" target="_blank" rel="noopener noreferrer">${esc(it.title)}${EXT_ICON}</a>`
        : `<span class="title">${esc(it.title)}</span>`;
      const meta = it.meta ? `<span class="meta">${esc(it.meta)}</span>` : "";
      return `<li class="game${i < 3 ? " top" : ""}"><div class="rank">${i + 1}</div>${cover}<div class="info">${title}${meta}</div></li>`;
    })
    .join("\n");
  const synced = list.synced ? fmtDate(new Date(list.synced)) : "";
  return list.page
    .replace("<!--LIST-->", rows)
    .replaceAll("{{SITE}}", esc(site.title))
    .replaceAll("{{SYNCED}}", esc(synced));
}

function listsIndex(lists) {
  const cards = lists
    .map((l) => {
      const strip = l.items
        .slice(0, 6)
        .filter((it) => it.cover)
        .map((it) => `<img src="${esc(it.cover)}" alt="" loading="lazy">`)
        .join("");
      return `<li class="slot">
  <a href="/lists/${l.slug}/">
    <h3>${esc(l.title)}</h3>
    ${l.description ? `<p>${esc(l.description)}</p>` : ""}
    ${strip ? `<div class="strip" aria-hidden="true">${strip}</div>` : ""}
    <div class="meta"><span>${l.items.length} ranked</span>${l.items[0] ? `<span>#1 ${esc(l.items[0].title)}</span>` : ""}</div>
  </a>
</li>`;
    })
    .join("\n");
  return `<article class="post page"><header><h1>Lists</h1><p class="lede">Things I love, ranked. #1 is the all-time favorite.</p></header></article>
<section class="list" aria-label="Lists">
  <div class="dialog menu">${lists.length ? `<ol class="slots">${cards}</ol>` : '<p class="empty">No lists yet.</p>'}</div>
</section>`;
}

function rss(site, posts) {
  const base = site.url.replace(/\/$/, "");
  const items = posts
    .map(
      (p) => `<item>
  <title>${esc(p.title)}</title>
  <link>${base}/posts/${p.slug}/</link>
  <guid>${base}/posts/${p.slug}/</guid>
  <pubDate>${p.date.toUTCString()}</pubDate>
  ${p.summary ? `<description>${esc(p.summary)}</description>` : ""}
</item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(site.title)}</title>
<link>${base}/</link>
<description>${esc(site.tagline)}</description>
${items}
</channel></rss>`;
}

// ---------- build ----------
function build() {
  const t = Date.now();
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
  const posts = loadPosts();

  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(path.join(ROOT, "public"), OUT);
  fs.copyFileSync(path.join(ROOT, "style.css"), path.join(OUT, "style.css"));

  write("index.html", layout(site, { home: true, body: homePage(site, posts) }));

  posts.forEach((p, i) => {
    const body = postPage(p, posts[i + 1], posts[i - 1]);
    write(`posts/${p.slug}/index.html`, layout(site, { title: p.title, description: p.summary, body, canonical: `/posts/${p.slug}/` }));
  });

  const pagesDir = path.join(ROOT, "pages");
  for (const f of fs.readdirSync(pagesDir).filter((f) => f.endsWith(".md"))) {
    const { data, body } = parseFrontMatter(fs.readFileSync(path.join(pagesDir, f), "utf8"), f);
    const slug = f.replace(/\.md$/, "");
    const html = `<article class="post page"><header><h1>${esc(data.title || slug)}</h1></header><div class="prose">${marked.parse(body)}</div></article>`;
    write(`${slug}/index.html`, layout(site, { title: data.title, body: html, canonical: `/${slug}/` }));
  }

  const lists = loadLists();
  write("lists/index.html", layout(site, { title: "Lists", description: "Things I love, ranked.", body: listsIndex(lists), canonical: "/lists/" }));
  for (const l of lists) write(`lists/${l.slug}/index.html`, listPage(site, l));

  write("404.html", layout(site, {
    title: "Not found",
    body: `<div class="dialog lost"><p>This cartridge slot is empty. The page may have moved or never existed.</p><p><a href="/">Back to all posts</a></p></div>`,
  }));
  write("feed.xml", rss(site, posts.filter((p) => !p.draft)));

  console.log(`Built ${posts.length} post(s) and ${lists.length} list(s) in ${Date.now() - t}ms${DEV ? " (drafts included)" : ""}`);
}

try {
  build();
} catch (e) {
  console.error("Build failed:", e.message);
  if (!DEV) process.exit(1);
}

// ---------- dev server ----------
if (DEV) {
  const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".woff": "font/woff", ".ttf": "font/ttf", ".xml": "application/xml" };
  http
    .createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let file = path.join(OUT, p);
      if (!file.startsWith(OUT)) return res.writeHead(403).end();
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!fs.existsSync(file)) {
        res.writeHead(404, { "content-type": "text/html" });
        return res.end(fs.readFileSync(path.join(OUT, "404.html")));
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    })
    .listen(PORT, () => console.log(`Previewing at http://localhost:${PORT}  (Ctrl+C to stop)`));

  let timer;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { build(); } catch (e) { console.error("Build failed:", e.message); }
    }, 100);
  };
  for (const d of ["posts", "pages", "public", "lists"]) fs.watch(path.join(ROOT, d), { recursive: true }, rebuild);
  for (const f of ["style.css", "site.config.json"]) fs.watch(path.join(ROOT, f), rebuild);
}
