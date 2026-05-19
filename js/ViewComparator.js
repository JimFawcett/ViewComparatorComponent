const VC_STYLE = /* css */ `
  :host { display: inline-flex; flex-direction: column; }

  .container {
    display: flex;
    flex-direction: row;
    border: 2px solid var(--dark, #333);
    box-shadow: 5px 5px 5px #999;
    box-sizing: border-box;
    overflow: hidden;
  }

  .panel {
    display: flex;
    flex-direction: column;
    overflow-x: var(--panel-overflow-x, auto);
    overflow-y: auto;
    box-sizing: border-box;
    background-color: var(--panel-bg, #f8f8f8);
    color: var(--panel-fg, #333);
    cursor: pointer;
    user-select: none;
  }

  .panel-left  { flex: none; }
  .panel-right { flex: 1; min-width: 0; position: relative; }

  .splitter {
    flex: none;
    width: var(--bar-width, 6px);
    background-color: var(--bar-color, #888);
    cursor: col-resize;
    user-select: none;
  }

  .splitter:hover { filter: brightness(0.75); }

  .resizer {
    flex: none;
    height: var(--bar-width, 6px);
    background-color: var(--bar-color, #888);
    cursor: ns-resize;
    user-select: none;
  }

  .resizer:hover { filter: brightness(0.75); }

  ::slotted(pre) {
    flex: 1;
    min-height: 0;
    margin: 0 !important;
    padding: var(--panel-padding, 0.75rem 1rem);
    line-height: 1.4;
    white-space: pre;
    box-sizing: border-box;
    background: transparent;
    color: inherit;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 0.9rem;
  }

  .offset-controls {
    position: absolute;
    top: 4px;
    right: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 1;
    opacity: 0.3;
    transition: opacity 0.15s;
  }

  .panel-right:focus-within .offset-controls,
  .offset-controls:hover { opacity: 1; }

  .offset-btn {
    width: 22px;
    height: 22px;
    border: 1px solid var(--bar-color, #888);
    background: var(--panel-bg, #f8f8f8);
    color: var(--panel-fg, #333);
    cursor: pointer;
    font-size: 11px;
    line-height: 1;
    padding: 0;
    border-radius: 2px;
    user-select: none;
  }

  .offset-btn:hover { filter: brightness(0.85); }
`;

const VC_TEMPLATE = /* html */ `
  <style>${VC_STYLE}</style>
  <div class="container" part="container">
    <div class="panel panel-left" part="panel-left">
      <slot name="left"></slot>
    </div>
    <div class="splitter" part="splitter"></div>
    <div class="panel panel-right" part="panel-right" tabindex="-1">
      <div class="offset-controls" part="offset-controls">
        <button class="offset-btn" part="offset-up"    title="Shift content up (Alt+↑)">▲</button>
        <button class="offset-btn" part="offset-reset" title="Reset offset (Esc)">0</button>
        <button class="offset-btn" part="offset-down"  title="Shift content down (Alt+↓)">▼</button>
      </div>
      <slot name="right"></slot>
    </div>
  </div>
  <div class="resizer" part="resizer"></div>
`;

class ViewComparator extends HTMLElement {
  static get observedAttributes() {
    return [
      'width', 'height', 'left-ratio', 'bar-width', 'bar-color',
      'bg-color', 'color', 'overflow-x', 'code-padding',
      'highlight', 'step-px', 'min-panel-px', 'min-height-px'
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = VC_TEMPLATE;

    this._els = {
      container:   this.shadowRoot.querySelector('.container'),
      panelLeft:   this.shadowRoot.querySelector('.panel-left'),
      splitter:    this.shadowRoot.querySelector('.splitter'),
      panelRight:  this.shadowRoot.querySelector('.panel-right'),
      resizer:     this.shadowRoot.querySelector('.resizer'),
      slotLeft:    this.shadowRoot.querySelector('slot[name="left"]'),
      slotRight:   this.shadowRoot.querySelector('slot[name="right"]'),
      btnUp:       this.shadowRoot.querySelector('[part="offset-up"]'),
      btnReset:    this.shadowRoot.querySelector('[part="offset-reset"]'),
      btnDown:     this.shadowRoot.querySelector('[part="offset-down"]'),
    };

    this._leftPx        = null;
    this._heightPx      = null;
    this._rightOffsetPx = 0;
    this._dragStartX    = 0;
    this._dragStartW    = 0;
    this._dragStartY    = 0;
    this._dragStartH    = 0;

    this._onMousedown        = e  => this._startDrag(e);
    this._onMousemove        = e  => this._onDrag(e);
    this._onMouseup          = () => this._endDrag();
    this._onResizerMousedown = e  => this._startHeightDrag(e);
    this._onResizerMousemove = e  => this._onHeightDrag(e);
    this._onResizerMouseup   = () => this._endHeightDrag();
    this._onClickLeft        = () => this._bump(+1);
    this._onClickRight       = () => this._bump(-1);
    this._onSlotChange       = () => { this._maybePrism(); this._harmonizeSlotted(); };
    this._onOffsetUp         = e  => { e.stopPropagation(); this._adjustOffset(-1); };
    this._onOffsetDown       = e  => { e.stopPropagation(); this._adjustOffset(+1); };
    this._onOffsetReset      = e  => { e.stopPropagation(); this._setRightOffset(0); };
    this._onKeydownRight     = e  => this._handleOffsetKey(e);
  }

  connectedCallback() {
    this._applyStyles();
    this._applyLayout();
    this._maybePrism();
    this._harmonizeSlotted();
    this._els.splitter.addEventListener('mousedown',   this._onMousedown);
    this._els.resizer.addEventListener('mousedown',    this._onResizerMousedown);
    this._els.panelLeft.addEventListener('click',      this._onClickLeft);
    this._els.panelRight.addEventListener('click',     this._onClickRight);
    this._els.slotLeft.addEventListener('slotchange',  this._onSlotChange);
    this._els.slotRight.addEventListener('slotchange', this._onSlotChange);
    this._els.btnUp.addEventListener('click',          this._onOffsetUp);
    this._els.btnDown.addEventListener('click',        this._onOffsetDown);
    this._els.btnReset.addEventListener('click',       this._onOffsetReset);
    this._els.panelRight.addEventListener('keydown',   this._onKeydownRight);
  }

  disconnectedCallback() {
    this._els.splitter.removeEventListener('mousedown',   this._onMousedown);
    this._els.resizer.removeEventListener('mousedown',    this._onResizerMousedown);
    this._els.panelLeft.removeEventListener('click',      this._onClickLeft);
    this._els.panelRight.removeEventListener('click',     this._onClickRight);
    this._els.slotLeft.removeEventListener('slotchange',  this._onSlotChange);
    this._els.slotRight.removeEventListener('slotchange', this._onSlotChange);
    this._els.btnUp.removeEventListener('click',          this._onOffsetUp);
    this._els.btnDown.removeEventListener('click',        this._onOffsetDown);
    this._els.btnReset.removeEventListener('click',       this._onOffsetReset);
    this._els.panelRight.removeEventListener('keydown',   this._onKeydownRight);
    document.removeEventListener('mousemove', this._onMousemove);
    document.removeEventListener('mouseup',   this._onMouseup);
    document.removeEventListener('mousemove', this._onResizerMousemove);
    document.removeEventListener('mouseup',   this._onResizerMouseup);
  }

  attributeChangedCallback() {
    this._leftPx   = null;
    this._heightPx = null;
    this._applyStyles();
    this._applyLayout();
  }

  // --- horizontal splitter drag ---

  _startDrag(e) {
    e.preventDefault();
    this._dragStartX = e.clientX;
    this._dragStartW = this._getLeftPx();
    document.addEventListener('mousemove', this._onMousemove);
    document.addEventListener('mouseup',   this._onMouseup);
  }

  _onDrag(e) {
    this._setLeftPx(this._dragStartW + (e.clientX - this._dragStartX));
  }

  _endDrag() {
    document.removeEventListener('mousemove', this._onMousemove);
    document.removeEventListener('mouseup',   this._onMouseup);
  }

  // --- bottom resizer drag ---

  _startHeightDrag(e) {
    e.preventDefault();
    this._dragStartY = e.clientY;
    this._dragStartH = this._getHeightPx();
    document.addEventListener('mousemove', this._onResizerMousemove);
    document.addEventListener('mouseup',   this._onResizerMouseup);
  }

  _onHeightDrag(e) {
    this._setHeightPx(this._dragStartH + (e.clientY - this._dragStartY));
  }

  _endHeightDrag() {
    document.removeEventListener('mousemove', this._onResizerMousemove);
    document.removeEventListener('mouseup',   this._onResizerMouseup);
  }

  // --- panel width helpers ---

  _bump(dir) {
    const step = parseFloat(this.getAttribute('step-px')) || 40;
    this._setLeftPx(this._getLeftPx() + dir * step);
  }

  _getLeftPx() {
    if (this._leftPx != null) return this._leftPx;
    const ratio     = parseFloat(this.getAttribute('left-ratio')) || 0.5;
    const available = this._availableWidth();
    this._leftPx    = Math.round(ratio * available);
    return this._leftPx;
  }

  _setLeftPx(px) {
    const minPx     = parseFloat(this.getAttribute('min-panel-px')) || 120;
    const available = this._availableWidth();
    this._leftPx    = Math.min(Math.max(Math.round(px), minPx), available - minPx);
    this._els.panelLeft.style.width = `${this._leftPx}px`;
  }

  _availableWidth() {
    return Math.max(this._totalWidthPx() - this._barWidthPx(), 1);
  }

  _barWidthPx() {
    return parseFloat(this.getAttribute('bar-width') || '6') || 6;
  }

  _totalWidthPx() {
    const w = this.getAttribute('width');
    if (w) {
      if (w.endsWith('rem')) {
        const rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        return parseFloat(w) * rootFs;
      }
      return parseFloat(w) || 600;
    }
    const r = this._els.container.getBoundingClientRect();
    return r.width > 0 ? r.width : 600;
  }

  // --- container height helpers ---

  _getHeightPx() {
    if (this._heightPx != null) return this._heightPx;
    const h = this.getAttribute('height');
    if (h) {
      if (h.endsWith('rem')) {
        const rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        this._heightPx = parseFloat(h) * rootFs;
      } else {
        this._heightPx = parseFloat(h) || 200;
      }
    } else {
      const r = this._els.container.getBoundingClientRect();
      this._heightPx = r.height > 0 ? r.height : 200;
    }
    return this._heightPx;
  }

  _setHeightPx(px) {
    const minPx    = parseFloat(this.getAttribute('min-height-px')) || 80;
    this._heightPx = Math.max(Math.round(px), minPx);
    this._els.container.style.height = `${this._heightPx}px`;
  }

  // --- right-panel offset ---

  _adjustOffset(dir) {
    const step = parseFloat(this.getAttribute('offset-step-px')) || 40;
    this._setRightOffset(this._rightOffsetPx + dir * step);
  }

  _setRightOffset(px) {
    this._rightOffsetPx = Math.max(0, Math.round(px));
    this._els.slotRight.assignedElements({ flatten: true }).forEach(el => {
      this._applyRightPaddingTop(el);
    });
  }

  _applyRightPaddingTop(el) {
    if (el.tagName !== 'PRE') return;
    const pad = this.getAttribute('code-padding') || '0.75rem 1rem';
    const basePadTop = pad.trim().split(/\s+/)[0];
    el.style.paddingTop = `calc(${basePadTop} + ${this._rightOffsetPx}px)`;
  }

  _handleOffsetKey(e) {
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      this._adjustOffset(+1);
    } else if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      this._adjustOffset(-1);
    } else if (e.key === 'Escape') {
      this._setRightOffset(0);
    }
  }

  // --- apply ---

  _applyStyles() {
    const bg  = this.getAttribute('bg-color')     || 'var(--light, #f8f8f8)';
    const fg  = this.getAttribute('color')        || 'var(--dark, #333)';
    const pad = this.getAttribute('code-padding') || '0.75rem 1rem';
    const ox  = this.getAttribute('overflow-x')   || 'auto';
    const bw  = this.getAttribute('bar-width')    || '6px';
    const bc  = this.getAttribute('bar-color')    || '#888';
    this.style.setProperty('--panel-bg',         bg);
    this.style.setProperty('--panel-fg',         fg);
    this.style.setProperty('--panel-padding',    pad);
    this.style.setProperty('--panel-overflow-x', ox);
    this.style.setProperty('--bar-width',        bw);
    this.style.setProperty('--bar-color',        bc);
  }

  _applyLayout() {
    const w = this.getAttribute('width');
    if (w) this._els.container.style.width = w;
    if (this.getAttribute('height') || this._heightPx != null) {
      this._els.container.style.height = `${this._getHeightPx()}px`;
    }
    this._els.panelLeft.style.width = `${this._getLeftPx()}px`;
  }

  _maybePrism() {
    if (this.getAttribute('highlight') !== 'prism' || !window.Prism) return;
    [this._els.slotLeft, this._els.slotRight].forEach(slot => {
      slot.assignedElements({ flatten: true }).forEach(el => {
        const codes = el.tagName === 'CODE' ? [el] : [...el.querySelectorAll('code')];
        codes.forEach(c => window.Prism.highlightElement(c));
      });
    });
  }

  _harmonizeSlotted() {
    const pad = this.getAttribute('code-padding') || '0.75rem 1rem';
    const apply = (el) => {
      if (el.tagName !== 'PRE') return;
      el.style.margin    = '0';
      el.style.padding   = pad;
      el.style.flex      = '1';
      el.style.minHeight = '0';
      el.style.boxSizing = 'border-box';
    };
    this._els.slotLeft.assignedElements({ flatten: true }).forEach(apply);
    this._els.slotRight.assignedElements({ flatten: true }).forEach(el => {
      apply(el);
      this._applyRightPaddingTop(el);
    });
  }
}

customElements.define('view-comparator', ViewComparator);
