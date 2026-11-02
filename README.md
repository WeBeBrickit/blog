# Post-Ops

A small static blog for project write-ups. You write posts as Markdown files, and `build.mjs` turns them into plain HTML in `dist/`. It has no dependencies to install.

## Writing a post

1. Copy `posts/_template.md` and rename the copy, for example `posts/kitchen-tablet.md`. The file name becomes the URL (`/posts/kitchen-tablet/`).
2. Fill in the front matter at the top and write the post below it.
3. Put photos in `public/img/` and add them to a post with `![description](/img/photo.jpg)`.
4. Keep `draft: true` while you're working on it. Drafts appear in the local preview but not on the live site.

Front matter fields:

| Field | Example | Notes |
|---|---|---|
| `title` | `Getting Otto to walk` | Required |
| `date` | `2026-10-07` | Required, in year-month-day format |
| `project` | `Otto DIY` | Short tag shown next to the date |
| `summary` | `One or two sentences.` | Shown in the post list and link previews |
| `status` | `working` | One of `working`, `in progress`, `stalled`, `abandoned` |
| `time` | `3 weekends` | Free text |
| `cost` | `$40` | Free text |
| `difficulty` | `3` | A number from 1 to 5, drawn as a bar |
| `draft` | `true` | Hides the post from the live site |

Each value has to fit on one line.

## Previewing on your computer

You need [Node.js](https://nodejs.org) version 20 or newer.

```
npm run dev
```

Then open http://localhost:4321. The site rebuilds every time you save a file. Press Ctrl+C to stop.

## Changing things

- **Site name, tagline, intro text, your name, URL:** `site.config.json`
- **Colors and layout:** `style.css`
- **About page:** `pages/about.md`. Any `.md` file you add to `pages/` becomes a page (for example, `pages/uses.md` becomes `/uses/`).
- **Pixel font:** the glyphs are drawn as text in `tools/make-font.py`. Edit them, then run `npm run font`. This step needs Python 3 and fontTools (`pip install fonttools`).

## Publishing

See `DEPLOY.md`. Once it's set up, every push to GitHub rebuilds the live site.
