// Content Script for grabbr (formerly Smart Copier)

class Scraper {
  constructor() {
    this.extractedData = [];
    this.options = {
      removeDuplicates: false,
      keepNumbering: true,
      mergeBrokenSentences: false,
      ignoreTinyText: true,
      ignoreRepeatedHeaders: false
    };
    this.theme = 'dark'; // Default
  }

  // Main entry point (Async now)
  async extract(mode, options) {
    this.options = { ...this.options, ...options };
    this.extractedData = [];

    // 0. Auto-expand details/accordions
    await this.expandAll();

    // 1. Scan and structure content
    const elements = this.scanPage();

    // 2. Filter based on mode
    const filtered = this.filterByMode(elements, mode);

    // 3. Post-process (merge, dedup, clean)
    const processed = this.postProcess(filtered);

    // 4. Return structured JSON OR format to string
    const data = options.format === 'json' ? this.groupElements(processed) : this.formatOutput(processed, mode);

    return {
      data: data,
      theme: this.detectTheme()
    };
  }

  detectTheme() {
    // Basic brightness detection
    const bgColor = window.getComputedStyle(document.body).backgroundColor;
    const rgba = bgColor.match(/\d+/g);
    if (rgba && rgba.length >= 3) {
      const r = parseInt(rgba[0]);
      const g = parseInt(rgba[1]);
      const b = parseInt(rgba[2]);
      // simple brightness formula
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 128 ? 'light' : 'dark';
    }
    // Fallback: check prefers-color-scheme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  groupElements(elements) {
    const grouped = [];
    let currentGroup = null;

    for (const el of elements) {
      if (el.type === 'question') {
        if (currentGroup) grouped.push(currentGroup);
        currentGroup = {
          type: 'question',
          question: el.text,
          choices: [],
          imageDesc: el.imageDesc
        };
      } else if (el.type === 'choice' && currentGroup) {
        currentGroup.choices.push({
          text: el.text,
          isAnswer: el.isAnswer
        });
      } else {
        if (currentGroup) {
          grouped.push(currentGroup);
          currentGroup = null;
        }
        grouped.push(el);
      }
    }
    if (currentGroup) grouped.push(currentGroup);
    return grouped;
  }

  async expandAll() {
    // Open native <details> elements
    const details = Array.from(document.querySelectorAll('details'));
    let changed = false;
    for (const d of details) {
      if (!d.open) {
        d.open = true;
        changed = true;
      }
    }

    if (changed) {
      // Wait for layout reflow/animation
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  scanPage() {
    const selector = 'p, h1, h2, h3, h4, h5, h6, li, td, th, div, span, label, dt, dd, strong, b, em, i';
    const rawElements = Array.from(document.querySelectorAll(selector));

    const candidates = [];

    for (const el of rawElements) {
      if (this.shouldIgnore(el)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.height === 0 || rect.width === 0) continue;

      if (this.options.ignoreTinyText) {
        const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
        if (fontSize < 10 && fontSize > 0) continue;
      }

      const text = this.getVisibleText(el);
      if (!text || text.length < 2) continue;

      if (this.hasSignificantChildNodes(el)) continue;

      candidates.push({
        element: el,
        text: text.trim(),
        rect: rect,
        type: this.classify(el, text),
        y: rect.top + window.scrollY,
        x: rect.left + window.scrollX,
        isAnswer: this.isPotentialAnswer(el),
        imageDesc: this.getNearbyImageDesc(el)
      });
    }

    // Strict Visual Sorting
    candidates.sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) < 10) return a.x - b.x;
      return yDiff;
    });

    return candidates;
  }

  shouldIgnore(el) {
    const ignoreTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'NAV', 'FOOTER', 'HEADER', 'ASIDE'];
    if (ignoreTags.includes(el.tagName)) return true;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return true;

    const ignoreClasses = ['nav', 'menu', 'footer', 'sidebar', 'ad-', 'ads', 'cookie', 'popup', 'modal', 'login', 'signup', 'share', 'social', 'breadcrumb', 'sr-only', 'hide', 'hidden'];
    const className = (el.className || '').toString().toLowerCase();
    const id = (el.id || '').toString().toLowerCase();

    if (ignoreClasses.some(cls => className.includes(cls) || id.includes(cls))) {
      if (!className.includes('question') && !id.includes('question') && !className.includes('content') && !id.includes('content')) return true;
    }

    // Filter out metadata/placeholder text
    const text = (el.innerText || '').trim().toLowerCase();
    const placeholders = ['more...', 'more', 'read more', 'click here', 'show more', 'expand', 'collapse', 'close'];
    if (placeholders.includes(text)) return true;

    return false;
  }

  hasSignificantChildNodes(el) {
    const children = Array.from(el.children);
    // If it has children that are likely to be their own blocks, we skip the parent
    const complexTags = ['DIV', 'P', 'UL', 'OL', 'LI', 'TABLE', 'TR', 'SECTION', 'ARTICLE', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LABEL', 'SPAN'];
    return children.some(c => complexTags.includes(c.tagName) && c.innerText.trim().length > 0);
  }

  getVisibleText(el) {
    let text = el.innerText || '';
    // Clean up "More..." and similar metadata links that often pollute innerText
    const junk = [/more\.\.\./gi, /read more/gi, /show more/gi, /expand/gi, /collapse/gi];
    junk.forEach(re => {
      text = text.replace(re, '');
    });
    return text.trim();
  }

  classify(el, text) {
    text = text.trim();

    const questionRegex = /^(Q\d+|Question\s?\d+|\d+[\.)]|\(\d+\))\s+/i;
    const isQuestionSentence = text.endsWith('?') && text.length > 12;
    const isQuestionClass = (el.className || '').toLowerCase().includes('question') || (el.className || '').toLowerCase().includes('prompt') || (el.className || '').toLowerCase().includes('qtext');

    if (questionRegex.test(text) || (isQuestionSentence && !text.startsWith('A.') && !text.startsWith('B.')) || isQuestionClass) {
      return 'question';
    }

    const choiceRegex = /^([A-Ea-e\d][\.)]|\([A-Ea-e\d]\))\s+/;
    const className = (el.className || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const parentClass = (el.parentElement?.className || '').toLowerCase();

    const choiceKeywords = ['choice', 'option', 'answer', 'radio', 'check', 'r0', 'r1', 'item'];
    const isChoiceContext = choiceKeywords.some(kw => className.includes(kw) || parentClass.includes(kw) || id.includes(kw));

    // Catch labels associated with inputs or siblings
    const isInputLabel = el.tagName === 'LABEL' && el.getAttribute('for');
    const hasInputInParent = el.parentElement && el.parentElement.querySelector('input[type="radio"], input[type="checkbox"]');

    if (choiceRegex.test(text) || (isChoiceContext && (el.tagName === 'LI' || el.tagName === 'LABEL' || el.tagName === 'DIV' || el.tagName === 'SPAN')) || isInputLabel || hasInputInParent) {
      if (text.length < 500) return 'choice';
    }

    if (el.tagName === 'DT') return 'term';
    if (el.tagName === 'DD') return 'definition';
    if (text.includes(' – ') || text.includes(': ')) {
      const parts = text.split(/[:–-]/);
      if (parts[0].length < 40 && parts.length > 1) return 'term-def';
    }

    if (/^H[1-6]$/.test(el.tagName)) return 'header';
    if (el.tagName === 'LI') return 'list-item';

    return 'text';
  }

  isPotentialAnswer(el) {
    const style = window.getComputedStyle(el);
    const color = style.color;
    // Common highlight colors for "correct" answers
    const isGreen = color.includes('rgb(0, 1') || color.includes('rgb(3, 1') || color.includes('rgba(0, 2');
    const isBold = parseInt(style.fontWeight) >= 600;

    // Also check class names for indicators
    const className = (el.className || '').toLowerCase();
    const isCorrectClass = className.includes('correct') || className.includes('success') || className.includes('right');

    return (isGreen || isBold || isCorrectClass) && this.classify(el, (el.innerText || '').trim()) === 'choice';
  }

  getNearbyImageDesc(el) {
    // Look for images within the same parent or nearby siblings
    if (!el.parentElement) return null;

    const siblingImgs = Array.from(el.parentElement.querySelectorAll('img'));
    for (const img of siblingImgs) {
      const alt = img.getAttribute('alt') || img.getAttribute('aria-label') || img.title;
      if (alt && alt.trim().length > 3) {
        return `[Visual Content: ${alt.trim()}]`;
      }
    }
    return null;
  }

  filterByMode(elements, mode) {
    if (mode === 'full') return elements;

    if (mode === 'smart') {
      const result = [];
      let lastIncludedType = null;
      let lastIncludedY = 0;

      for (const e of elements) {
        let shouldInclude = e.type === 'question' || e.type === 'choice';

        // Stateful inclusion for text nodes following questions/choices
        if (!shouldInclude && e.type === 'text' && (lastIncludedType === 'question' || lastIncludedType === 'choice')) {
          const yDist = e.y - lastIncludedY;
          if (yDist < 25 && e.text.length < 300) {
            shouldInclude = true;
          }
        }

        if (shouldInclude) {
          result.push(e);
          lastIncludedType = e.type;
          lastIncludedY = e.y;
        }
      }
      return result;
    }

    if (mode === 'reviewer' || mode === 'flashcard') {
      return elements.filter(e =>
        e.type === 'question' ||
        e.type === 'choice' ||
        e.type === 'term' ||
        e.type === 'definition' ||
        e.type === 'term-def'
      );
    }

    return elements;
  }

  postProcess(items) {
    if (this.options.removeDuplicates) {
      const unique = [];
      const seen = new Set();
      for (const item of items) {
        if (seen.has(item.text)) continue;
        seen.add(item.text);
        unique.push(item);
      }
      items = unique;
    }
    return items;
  }

  formatOutput(items, mode) {
    let output = '';
    let lastType = '';

    for (const item of items) {
      if (item.type === 'question') {
        if (output) output += '\n\n';
        output += `Question: ${item.text}\n`;
      } else if (item.type === 'choice') {
        if (lastType !== 'choice') {
          output += `Choices:\n`;
        }
        output += `   ${item.text}\n`;
      } else {
        if (output) output += '\n';
        output += item.text + '\n';
      }
      lastType = item.type;
    }

    return output.trim();
  }

  injectGhostUI() {
    if (document.getElementById('grabbr-ghost-root')) return;

    const root = document.createElement('div');
    root.id = 'grabbr-ghost-root';
    root.style.position = 'fixed';
    root.style.top = '20px';
    root.style.right = '20px';
    root.style.zIndex = '2147483647';

    const shadow = root.attachShadow({ mode: 'open' });

    const container = document.createElement('div');
    container.id = 'ghost-container';
    container.innerHTML = `
      <style>
        #ghost-container {
          width: 380px;
          height: 600px;
          background: rgba(9, 9, 11, 0.15);
          backdrop-filter: blur(8px) saturate(120%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: white;
          font-family: sans-serif;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0,0,0,0.4);
          cursor: move;
          position: relative;
          transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        #ghost-container.minimized {
          height: 220px;
        }
        .header { 
          padding: 8px 12px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          background: rgba(0,0,0,0.3);
          border-bottom: 1px solid rgba(255,255,255,0.05); 
        }
        .header-btns { display: flex; gap: 8px; align-items: center; }
        .content { flex: 1; display: flex; position: relative; overflow: hidden; }
        iframe { border: none; width: 100%; height: 100%; pointer-events: auto; }
        .drag-handle { position: absolute; top: 0; left: 0; right: 0; height: 35px; z-index: 10; cursor: move; }
        .win-btn { 
          background: rgba(255,255,255,0.1); 
          border: none; 
          color: white; 
          cursor: pointer; 
          width: 24px; 
          height: 24px; 
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          z-index: 20;
          transition: background 0.2s;
        }
        .win-btn:hover { background: rgba(255,255,255,0.2); }
        #close-ghost:hover { background: rgba(255,0,0,0.5); }
      </style>
      <div class="drag-handle"></div>
      <div class="header">
        <span style="font-size: 11px; font-weight: 700; opacity: 0.8; letter-spacing: 0.05em; text-transform: uppercase;">grabbr ghost</span>
        <div class="header-btns">
          <button id="min-max-ghost" class="win-btn" title="Minimize/Maximize">−/□</button>
          <button id="close-ghost" class="win-btn">✕</button>
        </div>
      </div>
      <div class="content">
        <iframe src="${chrome.runtime.getURL('popup.html')}?ghost=true"></iframe>
      </div>
    `;

    shadow.appendChild(container);
    document.body.appendChild(root);

    this.makeDraggable(container, root, shadow.querySelector('.drag-handle'));
    shadow.getElementById('close-ghost').onclick = () => this.removeGhostUI();

    shadow.getElementById('min-max-ghost').onclick = () => {
      container.classList.toggle('minimized');
    };
  }

  removeGhostUI() {
    const el = document.getElementById('grabbr-ghost-root');
    if (el) el.remove();
  }

  makeDraggable(container, root, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      root.style.top = (root.offsetTop - pos2) + "px";
      root.style.left = (root.offsetLeft - pos1) + "px";
      root.style.right = 'auto';
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }
}

// Updated Listener for Async
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleGhostMode') {
    const scraper = new Scraper();
    if (request.enabled) {
      scraper.injectGhostUI();
    } else {
      scraper.removeGhostUI();
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'extract') {
    const scraper = new Scraper();

    // Call async extraction
    scraper.extract(request.mode, request.options)
      .then(response => {
        sendResponse({ success: true, data: response.data, theme: response.theme });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.toString() });
      });

    return true; // Keep channel open for async response
  }
});
