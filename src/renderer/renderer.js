/**
 * Tessera — Renderer Process
 * Implements recursive split-pane layout with URL bar, link routing, and full customization.
 */

let config = {};
let activePaneId = null;
let paneCounter = 0;
let root = null;

const workspace = document.getElementById('workspace');

// ─── Init ───────────────────────────────────────────────────────────────────

(async () => {
  try {
    config = await window.tessera.getConfig();
  } catch (_) {}

  applyConfig();
  initLayout();
  wireToolbar();
  wireMenu();
  wireSettingsChanged();
})();

function applyConfig() {
  document.getElementById('app-title').textContent = config.appName || 'Tessera';
  document.title = config.appName || 'Tessera';

  // Apply accent color
  if (config.accentColor) {
    document.documentElement.style.setProperty('--accent', config.accentColor);
  }
}

function initLayout() {
  const layout = config.defaultLayout || 'single';
  switch (layout) {
    case '2-vertical':
      root = { type: 'split', dir: 'row', children: [createPaneNode(), createPaneNode()], sizes: [1, 1] };
      break;
    case '2-horizontal':
      root = { type: 'split', dir: 'col', children: [createPaneNode(), createPaneNode()], sizes: [1, 1] };
      break;
    case '2x2':
      root = {
        type: 'split', dir: 'col', sizes: [1, 1],
        children: [
          { type: 'split', dir: 'row', children: [createPaneNode(), createPaneNode()], sizes: [1, 1] },
          { type: 'split', dir: 'row', children: [createPaneNode(), createPaneNode()], sizes: [1, 1] }
        ]
      };
      break;
    default: // 'single'
      root = createPaneNode();
  }
  render();
  const first = firstPaneIn(root);
  if (first) setActivePane(first.id);
}

// ─── Pane creation ──────────────────────────────────────────────────────────

function nextPaneId() {
  return `pane-${++paneCounter}`;
}

function createPaneNode(url) {
  const id = nextPaneId();
  const paneUrl = url || config.defaultUrl || 'https://example.com';
  const el = document.createElement('div');
  el.className = 'pane';
  el.dataset.paneId = id;

  // Header
  const header = document.createElement('div');
  header.className = 'pane-header';
  if (config.paneHeaderVisibility === 'hidden') header.classList.add('hidden');
  else if (config.paneHeaderVisibility === 'hover') header.classList.add('hover-only');

  header.innerHTML = `
    <button class="pane-btn back" title="Back" disabled>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="10,3 5,8 10,13"/></svg>
    </button>
    <button class="pane-btn forward" title="Forward" disabled>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="6,3 11,8 6,13"/></svg>
    </button>
    <button class="pane-btn reload" title="Reload">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"/><polyline points="13.5,2 13.5,5 10.5,5"/></svg>
    </button>
    ${config.showHomepageButton ? `
    <button class="pane-btn home" title="Home">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 8l6-5.5L14 8"/><path d="M4 7.5V13.5a1 1 0 001 1h2v-3h2v3h2a1 1 0 001-1V7.5"/></svg>
    </button>
    ` : ''}
    ${config.showUrlBar ? `
    <div class="pane-url-bar">
      <input type="text" value="${escapeHtml(paneUrl)}" spellcheck="false" />
    </div>
    ` : `<div class="pane-title">Loading…</div>`}
    <button class="pane-btn pane-close" title="Close pane">
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
    </button>
  `;

  const body = document.createElement('div');
  body.className = 'pane-body';

  const wv = document.createElement('webview');
  wv.src = paneUrl;
  wv.setAttribute('partition', config.cookiePartition || 'persist:tessera');
  wv.setAttribute('allowpopups', '');
  if (config.customCSS || config.customJS) {
    // We'll inject after dom-ready
  }
  wv.style.cssText = 'flex:1; width:100%; height:100%;';
  body.appendChild(wv);

  el.appendChild(header);
  el.appendChild(body);

  // Wire header buttons
  const backBtn = header.querySelector('.back');
  const fwdBtn = header.querySelector('.forward');
  const reloadBtn = header.querySelector('.reload');
  const homeBtn = header.querySelector('.home');
  const closeBtn = header.querySelector('.pane-close');
  const urlInput = header.querySelector('.pane-url-bar input');
  const titleEl = header.querySelector('.pane-title');

  backBtn.addEventListener('click', (e) => { e.stopPropagation(); if (wv.canGoBack()) wv.goBack(); });
  fwdBtn.addEventListener('click', (e) => { e.stopPropagation(); if (wv.canGoForward()) wv.goForward(); });
  reloadBtn.addEventListener('click', (e) => { e.stopPropagation(); wv.reload(); });
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closePaneById(id); });

  if (homeBtn) {
    homeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const homeUrl = config.defaultUrl || 'https://example.com';
      wv.loadURL(homeUrl);
      if (urlInput) urlInput.value = homeUrl;
    });
  }

  // URL bar
  if (urlInput) {
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let val = urlInput.value.trim();
        if (val && !val.match(/^[a-zA-Z]+:\/\//)) val = 'https://' + val;
        wv.loadURL(val);
      }
    });
    urlInput.addEventListener('focus', () => urlInput.select());
  }

  // Webview events
  wv.addEventListener('page-title-updated', (e) => {
    if (titleEl) titleEl.textContent = e.title || config.appName || 'Tessera';
  });

  wv.addEventListener('did-navigate', (e) => {
    backBtn.disabled = !wv.canGoBack();
    fwdBtn.disabled = !wv.canGoForward();
    if (urlInput) urlInput.value = e.url || '';
  });

  wv.addEventListener('did-navigate-in-page', (e) => {
    backBtn.disabled = !wv.canGoBack();
    fwdBtn.disabled = !wv.canGoForward();
    if (urlInput && e.url) urlInput.value = e.url;
  });

  wv.addEventListener('did-fail-load', (e) => {
    if (e.errorCode === -3) return;
    if (titleEl) titleEl.textContent = `Failed to load (${e.errorCode})`;
  });

  // Inject custom CSS/JS after page loads
  wv.addEventListener('dom-ready', () => {
    if (config.customCSS) {
      wv.insertCSS(config.customCSS).catch(() => {});
    }
    if (config.customJS) {
      wv.executeJavaScript(config.customJS).catch(() => {});
    }
  });

  // Link / popup handling
  wv.addEventListener('new-window', (e) => {
    if (e.preventDefault) e.preventDefault();
    const url = e.url;
    if (!url) return;
    handleLinkClick(url, wv, urlInput);
  });

  wv.addEventListener('will-navigate', (e) => {
    const url = e.url;
    if (!url) return;
    // Update URL bar
    if (urlInput) urlInput.value = url;
  });

  el.addEventListener('mousedown', () => setActivePane(id));

  return { type: 'pane', id, el, webview: wv };
}

async function handleLinkClick(url, wv, urlInput) {
  const stayInApp = await window.tessera.shouldStayInApp(url);
  if (stayInApp) {
    // Load in same pane (for SSO flows) or open in new pane for internal links
    try { wv.loadURL(url); } catch (_) {}
    if (urlInput) urlInput.value = url;
  } else {
    window.tessera.openExternal(url);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Tree operations ────────────────────────────────────────────────────────

function findNode(node, id) {
  if (!node) return null;
  if (node.type === 'pane' && node.id === id) return { node, parent: null, index: -1 };
  if (node.type === 'split') {
    for (let i = 0; i < node.children.length; i++) {
      if (node.children[i].type === 'pane' && node.children[i].id === id) {
        return { node: node.children[i], parent: node, index: i };
      }
      const r = findNode(node.children[i], id);
      if (r) {
        if (!r.parent) r.parent = node;
        return r;
      }
    }
  }
  return null;
}

function firstPaneIn(node) {
  if (!node) return null;
  if (node.type === 'pane') return node;
  for (const c of node.children) {
    const r = firstPaneIn(c);
    if (r) return r;
  }
  return null;
}

function setActivePane(id) {
  activePaneId = id;
  document.querySelectorAll('.pane').forEach(p => {
    p.classList.toggle('active', p.dataset.paneId === id);
  });
  updateStatus();
}

function countPanes(node) {
  if (!node) return 0;
  if (node.type === 'pane') return 1;
  return node.children.reduce((s, c) => s + countPanes(c), 0);
}

function updateStatus() {
  const n = countPanes(root);
  document.getElementById('pane-count').textContent = `${n} pane${n === 1 ? '' : 's'}`;
}

// ─── Rendering ──────────────────────────────────────────────────────────────

function render() {
  workspace.innerHTML = '';
  if (!root) return;
  const el = renderNode(root);
  el.style.flex = '1 1 0';
  el.style.minWidth = '0';
  el.style.minHeight = '0';
  workspace.appendChild(el);
  updateStatus();
}

function renderNode(node) {
  if (node.type === 'pane') return node.el;

  const container = document.createElement('div');
  container.className = `split ${node.dir}`;
  if (!node.sizes || node.sizes.length !== node.children.length) {
    node.sizes = node.children.map(() => 1);
  }
  node.children.forEach((child, i) => {
    const childEl = renderNode(child);
    childEl.style.flex = `${node.sizes[i]} 1 0`;
    container.appendChild(childEl);
    if (i < node.children.length - 1) {
      const resizer = document.createElement('div');
      resizer.className = `resizer ${node.dir}`;
      // Apply thickness
      const thickness = config.resizerThickness || 'normal';
      if (thickness !== 'normal') resizer.classList.add(thickness);
      attachResizer(resizer, node, i, container);
      container.appendChild(resizer);
    }
  });
  return container;
}

function attachResizer(resizer, splitNode, index, container) {
  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    resizer.classList.add('dragging');
    const isRow = splitNode.dir === 'row';
    const startPos = isRow ? e.clientX : e.clientY;
    const rect = container.getBoundingClientRect();
    const totalSize = isRow ? rect.width : rect.height;
    const sumFlex = splitNode.sizes.reduce((a, b) => a + b, 0);
    const startA = splitNode.sizes[index];
    const startB = splitNode.sizes[index + 1];
    const startAB = startA + startB;

    // Add overlay to prevent webview from capturing mouse events
    const overlay = document.createElement('div');
    overlay.className = `resize-overlay ${splitNode.dir === 'row' ? 'row' : 'col'}`;
    document.body.appendChild(overlay);

    function onMove(ev) {
      const delta = (isRow ? ev.clientX : ev.clientY) - startPos;
      const abShareSize = (startAB / sumFlex) * totalSize;
      if (abShareSize <= 0) return;
      const ratio = delta / abShareSize;
      let newA = startA + startAB * ratio;
      let newB = startAB - newA;
      const minFlex = startAB * 0.1;
      if (newA < minFlex) { newA = minFlex; newB = startAB - newA; }
      if (newB < minFlex) { newB = minFlex; newA = startAB - newB; }
      splitNode.sizes[index] = newA;
      splitNode.sizes[index + 1] = newB;

      const childrenEls = Array.from(container.children).filter(el => !el.classList.contains('resizer'));
      childrenEls.forEach((el, i) => {
        el.style.flex = `${splitNode.sizes[i]} 1 0`;
      });
    }
    function onUp() {
      resizer.classList.remove('dragging');
      overlay.remove();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ─── Split / Add / Close ────────────────────────────────────────────────────

function splitActivePane(dir) {
  if (!activePaneId) return;
  const maxPanes = config.maxPanes || 0;
  if (maxPanes > 0 && countPanes(root) >= maxPanes) return;

  const found = findNode(root, activePaneId);
  if (!found) return;
  const newPane = createPaneNode();

  if (!found.parent) {
    root = { type: 'split', dir, children: [found.node, newPane], sizes: [1, 1] };
  } else if (found.parent.dir === dir) {
    found.parent.children.splice(found.index + 1, 0, newPane);
    found.parent.sizes.splice(found.index + 1, 0, 1);
  } else {
    const wrapper = { type: 'split', dir, children: [found.node, newPane], sizes: [1, 1] };
    found.parent.children[found.index] = wrapper;
  }

  render();
  setActivePane(newPane.id);
}

function addPane(url) {
  const maxPanes = config.maxPanes || 0;
  if (maxPanes > 0 && countPanes(root) >= maxPanes) return;

  if (!root) {
    root = createPaneNode(url);
    render();
    setActivePane(root.id);
    return;
  }

  const newPane = createPaneNode(url);
  const position = config.newPanePosition || 'right';
  const dir = position === 'below' ? 'col' : 'row';

  const found = activePaneId ? findNode(root, activePaneId) : null;
  if (!found || !found.parent) {
    if (root.type === 'pane') {
      root = { type: 'split', dir, children: [root, newPane], sizes: [1, 1] };
    } else {
      root.children.push(newPane);
      root.sizes.push(1);
    }
  } else if (found.parent.dir === dir) {
    found.parent.children.splice(found.index + 1, 0, newPane);
    found.parent.sizes.splice(found.index + 1, 0, 1);
  } else {
    const wrapper = { type: 'split', dir, children: [found.node, newPane], sizes: [1, 1] };
    found.parent.children[found.index] = wrapper;
  }

  render();
  setActivePane(newPane.id);
}

function closePaneById(id) {
  const found = findNode(root, id);
  if (!found) return;

  if (!found.parent) {
    root = createPaneNode();
    render();
    setActivePane(root.id);
    return;
  }

  found.parent.children.splice(found.index, 1);
  found.parent.sizes.splice(found.index, 1);
  simplify(root);
  render();
  const next = firstPaneIn(root);
  if (next) setActivePane(next.id);
}

function simplify(node) {
  if (!node || node.type !== 'split') return;
  for (const c of node.children) simplify(c);
  node.children = node.children.map(c => {
    if (c.type === 'split' && c.children.length === 1) return c.children[0];
    return c;
  });
  if (node === root && node.children.length === 1) {
    root = node.children[0];
  }
}

function closeActivePane() {
  if (activePaneId) closePaneById(activePaneId);
}

// ─── Toolbar ────────────────────────────────────────────────────────────────

function wireToolbar() {
  document.getElementById('btn-split-v').addEventListener('click', () => splitActivePane('row'));
  document.getElementById('btn-split-h').addEventListener('click', () => splitActivePane('col'));
  document.getElementById('btn-add-pane').addEventListener('click', () => addPane());
  document.getElementById('btn-close-pane').addEventListener('click', closeActivePane);
  document.getElementById('btn-settings').addEventListener('click', () => window.tessera.openSettings());
}

// ─── Menu actions from main process ─────────────────────────────────────────

function wireMenu() {
  window.tessera.onMenu((action) => {
    switch (action) {
      case 'new-pane': addPane(); break;
      case 'close-pane': closeActivePane(); break;
      case 'split-vertical': splitActivePane('row'); break;
      case 'split-horizontal': splitActivePane('col'); break;
      case 'reload-pane': {
        const f = findNode(root, activePaneId);
        if (f?.node.webview) f.node.webview.reload();
        break;
      }
      case 'reload-pane-hard': {
        const f = findNode(root, activePaneId);
        if (f?.node.webview) f.node.webview.reloadIgnoringCache();
        break;
      }
      case 'toggle-devtools': {
        if (!config.devToolsEnabled) break;
        const f = findNode(root, activePaneId);
        if (f?.node.webview) {
          if (f.node.webview.isDevToolsOpened()) f.node.webview.closeDevTools();
          else f.node.webview.openDevTools();
        }
        break;
      }
    }
  });

  window.tessera.onOpenInNewPane((url) => {
    addPane(url);
  });
}

// ─── Settings changed ───────────────────────────────────────────────────────

function wireSettingsChanged() {
  window.tessera.onSettingsChanged((settings) => {
    // Re-fetch config and apply
    window.tessera.getConfig().then(newConfig => {
      config = newConfig;
      applyConfig();
    });
  });
}
