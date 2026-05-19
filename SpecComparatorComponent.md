# Spec: ViewComparatorComponent

## Purpose

`<view-comparator>` is a W3C custom element (Shadow DOM) that displays two adjacent panels separated by a narrow draggable splitter bar. Total component width is fixed; moving the bar redistributes width between the two panels.

- **Drag bar left** — left panel shrinks, right panel grows.
- **Drag bar right** — right panel shrinks, left panel grows.
- **Click in left panel** — left panel grows by one step, right panel shrinks by the same step.
- **Click in right panel** — right panel grows by one step, left panel shrinks by the same step.

Either panel may display text or code. Each panel accepts a slot that may hold a `<pre><code>` block with an optional `language` attribute for Prism styling.

---

## Element Registration

```js
customElements.define('view-comparator', ViewComparator);
```

---

## Attributes

| Attribute        | Type   | Default         | Description                                           |
|------------------|--------|-----------------|-------------------------------------------------------|
| `width`          | string | `auto`          | Total component width (any CSS length)                |
| `height`         | string | `auto`          | Height of both panels                                 |
| `left-ratio`     | number | `0.5`           | Initial fraction of total width given to left panel   |
| `bar-width`      | string | `6px`           | Width of the splitter bar                             |
| `bar-color`      | string | `#888`          | Color of the splitter bar                             |
| `bg-color`       | string | `var(--light)`  | Background of both panels                             |
| `color`          | string | `var(--dark)`   | Foreground (text) color of both panels                |
| `overflow-x`     | string | `auto`          | `auto`, `scroll`, or `hidden` — applied to both panels|
| `code-padding`   | string | `0.75rem 1rem`  | Padding inside each panel's code/text area            |
| `highlight`      | string | (none)          | Set to `prism` to enable Prism.js highlighting        |
| `step-px`        | number | `40`            | Pixels transferred per panel click                    |
| `min-panel-px`   | number | `120`           | Minimum width in pixels for either panel              |
| `min-height-px`  | number | `80`            | Minimum height in pixels for the component            |
| `offset-step-px` | number | `40`            | Pixels shifted per offset button click or key nudge   |

---

## Shadow DOM Structure

```
:host (inline-flex, column)
├── div.container          ← flex row, full width, border, box-shadow
│   ├── div.panel-left     ← flex: none, width from left-ratio, overflow-x
│   │   └── slot[name="left"]
│   ├── div.splitter       ← fixed bar-width, cursor: col-resize
│   └── div.panel-right    ← flex: 1, overflow-x, position: relative, tabindex="-1"
│       ├── div.offset-controls  ← absolute, top-right corner; contains ▲ 0 ▼ buttons
│       └── slot[name="right"]
└── div.resizer            ← height drag handle, cursor: ns-resize
```

`div.container` owns the total width. `div.panel-left` holds an explicit pixel width; `div.panel-right` fills the remainder via `flex: 1`. `div.resizer` sits below `div.container` and controls component height.

---

## Content Slots

### Named slot `left`

Accepts a `<pre><code>` block or plain text for the left panel.

```html
<pre slot="left"><code class="language-cpp">
  // left panel content
</code></pre>
```

### Named slot `right`

Accepts a `<pre><code>` block or plain text for the right panel.

```html
<pre slot="right"><code class="language-cpp">
  // right panel content
</code></pre>
```

In Prism mode (`highlight="prism"`), the `class="language-*"` attribute on the `<code>` element activates Prism highlighting when Prism.js is loaded on the host page.

---

## Behavior

### Splitter drag

- `mousedown` on `div.splitter` begins a drag.
- `mousemove` on `document` recomputes `panel-left` width from cursor delta.
- `mouseup` on `document` ends the drag.
- Total component width does not change during drag.
- Both `min-panel-px` limits are enforced on every move event.

### Panel click

- `click` on `div.panel-left` (not on the splitter) transfers `step-px` pixels from right to left.
- `click` on `div.panel-right` transfers `step-px` pixels from left to right.
- Both `min-panel-px` limits are enforced.

### Right-panel offset

The offset is applied as extra `paddingTop` on the right slot's `<pre>` element — computed as `calc(basePadTop + _rightOffsetPx + px)`. Because the padding area belongs to the `<pre>` element itself, its background (whether from Prism or any host-page CSS) extends seamlessly into the added space.

**Button controls** — three small buttons (▲ 0 ▼) are absolutely positioned in the top-right corner of the right panel. They are shown at low opacity and become fully visible on hover or when the panel has focus.

- ▼ — adds `offset-step-px` pixels to `_rightOffsetPx` (content shifts down)
- ▲ — removes `offset-step-px` pixels from `_rightOffsetPx` (content shifts up), floored at 0
- 0 — resets `_rightOffsetPx` to 0

Button clicks call `stopPropagation` so they do not trigger the panel-click width-bump.

**Keyboard controls** — `div.panel-right` has `tabindex="-1"`, so it receives focus on click. While focused:

- Alt+↓ — same as ▼
- Alt+↑ — same as ▲
- Escape — same as 0

### Height drag

- `mousedown` on `div.resizer` begins a vertical drag.
- `mousemove` on `document` recomputes `container` height from cursor delta.
- `mouseup` on `document` ends the drag.
- `min-height-px` (default 80px) is enforced on every move event.

### Attribute change

Re-applies layout and colors when any observed attribute changes.

---

## CSS Custom Properties (internal)

Set on `:host` during initialization:

| Property            | Controlled by attribute |
|---------------------|------------------------|
| `--bar-color`       | `bar-color`            |
| `--bar-width`       | `bar-width`            |
| `--panel-bg`        | `bg-color`             |
| `--panel-fg`        | `color`                |
| `--panel-padding`   | `code-padding`         |
| `--panel-overflow-x`| `overflow-x`           |

---

## Inline Style Notes

- `font-size` cascades through the shadow boundary; set it on the host element directly.
- `height` does not inherit — use the `height` attribute rather than `style="height: ..."` on the host.

---

## Dependencies

- **Prism.js** — optional; load both files before the component script when `highlight="prism"` is used.
  - `../js/prism.js`
  - `../css/prism.css`
- No other runtime dependencies.

---

## File Layout

```
ViewComparatorComponent/
  js/
    ViewComparator.js          ← component definition
  css/
    ViewComparator.css         ← host-page placement helpers
  ViewComparatorComponent.html ← demo / test page
  SpecComparatorComponent.md   ← this file
```

---

## Usage Examples

### Plain text

```html
<script src="js/ViewComparator.js" defer></script>

<view-comparator width="60rem" height="20rem" left-ratio="0.45">
  <pre slot="left">Left panel plain text content.</pre>
  <pre slot="right">Right panel plain text content.</pre>
</view-comparator>
```

### Prism highlighting

```html
<link rel="stylesheet" href="../css/prism.css">
<script src="../js/prism.js" defer></script>
<script src="js/ViewComparator.js" defer></script>

<view-comparator width="70rem" height="24rem" highlight="prism" left-ratio="0.5">
  <pre slot="left"><code class="language-cpp">
int main() {
    return 0;
}
  </code></pre>
  <pre slot="right"><code class="language-rust">
fn main() {
    println!("Hello");
}
  </code></pre>
</view-comparator>
```
