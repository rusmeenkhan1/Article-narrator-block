# Article Narrator Block

An [AEM Edge Delivery Services](https://www.aem.live/) block that turns any article page into a listenable, accessible reading experience. Authors add a single zero-config block; visitors get a polished floating player with text-to-speech, word-by-word highlighting, and full playback controls.

Built for contribution to the [AEM Block Party](https://www.aem.live/developer/block-party/) community.

## Environments

- **Preview:** https://main--article-narrator-block--rusmeenkhan1.aem.page/
- **Live:** https://main--article-narrator-block--rusmeenkhan1.aem.live/

---

## Article Narrator

### Overview

The **article-narrator** block scans the readable content inside `<main>` on a page and reads it aloud using the browser's built-in [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API). As the article is narrated, the current word is highlighted in place (karaoke-style) so readers can follow along visually.

No API keys, no external libraries, and no build step — just vanilla JavaScript and CSS following EDS best practices.

### Use cases

| Scenario | How it helps |
| --- | --- |
| **Accessibility** | Gives visitors an alternative way to consume long-form content, especially users with visual impairments or reading difficulties. |
| **Multitasking** | Lets users listen while commuting, cooking, or exercising without leaving the page. |
| **Long articles & blogs** | Reduces fatigue on dense editorial content by offering audio playback with progress tracking. |
| **Learning & comprehension** | Word-by-word highlighting helps language learners and students follow narration in sync with the text. |
| **Mobile reading** | Provides a podcast-like experience on mobile without a separate app or RSS feed. |

### Features

- **Zero-config authoring** — place the block anywhere; no fields or settings required
- **Sticky floating player** — fixed to the bottom of the viewport with slide-in animation
- **Playback controls** — play/pause, seekable progress bar, speed (0.75×–1.5×), voice selector, close/dismiss
- **Karaoke highlighting** — current word wrapped in `<mark>` using `Range.surroundContents()` without restructuring the DOM
- **Wake Lock** — keeps the screen awake during playback (where supported)
- **Themeable** — inherits site colours via CSS custom properties
- **Accessible** — ARIA landmarks, dynamic labels, keyboard seek, focus rings, `prefers-reduced-motion` support
- **Progressive enhancement** — silently exits when Web Speech API is unavailable

### Browser support

| Feature | Chrome | Safari | Firefox | Edge |
| --- | --- | --- | --- | --- |
| Text-to-speech | ✅ | ✅ | ✅ | ✅ |
| Word boundary highlighting | ✅ | ✅ | ⚠️ Limited | ✅ |
| Wake Lock | ✅ | ✅ (iOS 16.4+) | ❌ | ✅ |

> **Note:** Word-level karaoke highlighting depends on the browser firing `SpeechSynthesisUtterance` `boundary` events with `event.name === 'word'`. Chrome and Safari provide the best experience. In unsupported browsers the player still works, but highlighting may be less precise.

---

## Setup (developers)

Follow these steps to add the block to your own AEM Edge Delivery project.

### 1. Copy the block files

Copy the entire block folder into your project's `blocks/` directory:

```
blocks/
└── article-narrator/
    ├── article-narrator.js
    └── article-narrator.css
```

EDS automatically loads `article-narrator.js` and `article-narrator.css` when a block named `article-narrator` is present on a page. No changes to `scripts.js` or `fstab.yaml` are required.

### 2. Commit and push

AEM Code Sync serves code from your GitHub repository. The block will not appear on preview or live environments until the files are pushed:

```sh
git add blocks/article-narrator/
git commit -m "Add article-narrator block"
git push origin main
```

Wait 1–2 minutes for Code Sync, then verify the assets are available:

```sh
curl -I https://main--{repo}--{owner}.aem.live/blocks/article-narrator/article-narrator.js
# Expect: HTTP/2 200
```

### 3. Local development

```sh
npm install
npx -y @adobe/aem-cli up --no-open --forward-browser-logs
```

Open `http://localhost:3000` and navigate to a page that contains the block and article content.

**Optional:** Create a static test page in a `drafts/` folder and start the dev server with:

```sh
npx -y @adobe/aem-cli up --html-folder drafts
```

### 4. Lint before committing

```sh
npm run lint        # check
npm run lint:fix    # auto-fix
```

---

## Authoring (content authors)

The block requires **no configuration**. Authors only need to place it on a page that contains readable article content.

### Step 1 — Open your source document

Use your usual authoring workflow in **Google Docs** or **Microsoft Word** (via SharePoint / OneDrive).

### Step 2 — Add the block table

Insert a block table anywhere in the document. The simplest form is a **single-row table** with the block name in the first cell:

| Article Narrator |
| --- |

> The name `Article Narrator` is normalised by AEM to the block ID `article-narrator`, which maps to `blocks/article-narrator/`.

A second empty row (two columns) is harmless — the block clears all authored content at runtime — but it is not required.

### Step 3 — Place it on an article page

Add the block to any page with body copy in `<main>`. Common placements:

- At the top of the article (before the first paragraph)
- At the bottom of the article (after the conclusion)
- In its own section between section breaks

The player is `position: fixed` at the bottom of the viewport, so its position in the document does not affect where it appears visually.

### Step 4 — Preview and publish

1. Preview the page in AEM (`*.aem.page`)
2. Confirm the player slides in at the bottom of the viewport
3. Click **Play** and verify narration and word highlighting
4. Publish when ready

### What content is read?

The block collects text from these elements inside `<main>`:

- `p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `li`, `blockquote`

It **skips** text inside:

- `header`, `footer`, `nav`
- The `.article-narrator` block itself
- Any element with a `data-narrator-skip` attribute

Nested elements are deduplicated (e.g. a `p` inside a `blockquote` is read once, not twice).

### Excluding specific content

Add `data-narrator-skip` to any element you want the narrator to ignore:

```html
<aside data-narrator-skip>
  <p>This promotional callout will not be read aloud.</p>
</aside>
```

In document authoring, this attribute can be set via metadata or by a developer in block decoration code.

---

## End-user experience

When a visitor loads a page with the block:

1. **Support check** — if the browser lacks `speechSynthesis`, the block exits silently (a message is logged to the console for developers).
2. **Content scan** — readable text in `<main>` is collected and split into a word index.
3. **Player appears** — a sticky bar slides up from the bottom of the screen.
4. **Playback** — the visitor presses Play; narration begins and the current word is highlighted in the article.
5. **Controls:**
   - **Play / Pause** — pause and resume from the same position
   - **Progress bar** — click or use arrow keys to seek to any point in the article
   - **Time remaining** — estimated minutes left based on word count and speed
   - **Speed** — cycles 0.75× → 1× → 1.25× → 1.5×
   - **Voice** — dropdown populated from system voices, filtered to the page language (`<html lang="...">`)
   - **Close** — stops playback and removes the player

---

## Theming

The player inherits your site's design tokens and can be customised with CSS custom properties:

| Property | Default | Description |
| --- | --- | --- |
| `--narrator-bg` | `--background-color` (88% opacity) | Player background |
| `--narrator-color` | `--text-color` | Player text colour |
| `--narrator-accent` | `--link-color` | Play button and progress fill |
| `--narrator-accent-hover` | `--link-hover-color` | Play button hover state |
| `--narrator-border` | `rgb(0 0 0 / 8%)` | Top border |
| `--narrator-muted` | `--dark-color` | Labels and secondary text |
| `--narrator-focus` | `--narrator-accent` | Focus ring colour |
| `--narrator-highlight-bg` | `#e1f5ee` | Karaoke highlight background |
| `--narrator-highlight-color` | `#085041` | Karaoke highlight text |

Example override in your site's CSS:

```css
:root {
  --narrator-accent: #e34850;
  --narrator-highlight-bg: #fff3e0;
  --narrator-highlight-color: #8a2f00;
}
```

---

## Accessibility

The block is built to [WCAG 2.1 AA](https://www.w3.org/WAI/WCAG21/quickref/) principles:

- Player region: `role="region"` with `aria-label="Article narrator"`
- Play/pause button: dynamic `aria-label` ("Play article" / "Pause article")
- Progress bar: `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
- Speed button: `aria-label="Playback speed, currently 1x"`
- Close button: `aria-label="Close narrator"`
- All icon-only buttons have visible `:focus-visible` rings
- `prefers-reduced-motion: reduce` disables smooth scroll on word highlight

---

## File structure

```
blocks/
└── article-narrator/
    ├── article-narrator.js   # Block decoration, speech logic, player UI
    └── article-narrator.css  # Player styles and karaoke highlight
```

---

## Documentation

Before using the AEM boilerplate, we recommend going through the documentation at https://www.aem.live/docs/, and more specifically:

1. [Developer Tutorial](https://www.aem.live/developer/tutorial)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Web Performance](https://www.aem.live/developer/keeping-it-100)
4. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)
5. [Block Party](https://www.aem.live/developer/block-party/)

## Installation

```sh
npm install
```

## Linting

```sh
npm run lint
```

## Local development

1. Clone this repository
2. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository
3. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
4. Start the dev server: `aem up` (opens your browser at `http://localhost:3000`)
5. Open the project in your IDE and start coding

## License

Apache License 2.0 — see [LICENSE](LICENSE).
