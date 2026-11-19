// «Скетч» — клиент: список досок + редактор с мультиплеером.

// ---------- Иконки (инлайновые SVG) ----------
const svgWrap = (inner, filled = false) =>
  `<svg viewBox="0 0 20 20" fill="${filled ? 'currentColor' : 'none'}" stroke="${filled ? 'none' : 'currentColor'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const ICONS = {
  select: svgWrap('<path d="M6 3l9.5 7.2-4.4.7 2.5 4.8-2.2 1.1-2.5-4.8L6 15.5V3z" fill="currentColor" stroke="none"/>'),
  hand: svgWrap('<path d="M6.6 11V6.2a1.25 1.25 0 0 1 2.5 0V10 M9.1 9.8V4.9a1.25 1.25 0 0 1 2.5 0V10 M11.6 10V6a1.25 1.25 0 0 1 2.5 0v6.2c0 3.1-1.9 4.9-4.7 4.9-2.1 0-3-.7-4.3-2.5l-1.6-2.3c-.5-.8.4-1.9 1.4-1.5l1.7 1"/>'),
  rect: svgWrap('<rect x="4" y="5" width="12" height="10" rx="1"/>'),
  ellipse: svgWrap('<ellipse cx="10" cy="10" rx="6.5" ry="5"/>'),
  diamond: svgWrap('<path d="M10 3.2 16.8 10 10 16.8 3.2 10Z"/>'),
  line: svgWrap('<path d="M4 15.5 16 4.5"/>'),
  arrow: svgWrap('<path d="M4 15.5 16 4.5 M10 4.5h6v6"/>'),
  freedraw: svgWrap('<path d="M3 13.5c1.8-6 3.4 4 5.4-1.2s2.8 4.6 4.8-.8 1.8 2.4 2.8 1"/>'),
  text: svgWrap('<path d="M4.5 5.5h11 M10 5.5V15 M7.5 15h5"/>'),
  eraser: svgWrap('<path d="M3.8 13.8l5.3-5.3a1.3 1.3 0 0 1 1.8 0l2.6 2.6a1.3 1.3 0 0 1 0 1.8l-2.5 2.5H8l-4.2-1.6z M8.6 9l4.4 4.4 M9.5 15.4h7"/>'),
  back: svgWrap('<path d="M12 4.5 6.5 10l5.5 5.5"/>'),
  undo: svgWrap('<path d="M4 8.5h7.5a4.25 4.25 0 1 1 0 8.5H9 M4 8.5 7.5 5 M4 8.5 7.5 12"/>'),
  redo: svgWrap('<path d="M16 8.5H8.5a4.25 4.25 0 1 0 0 8.5H11 M16 8.5 12.5 5 M16 8.5 12.5 12"/>'),
  reset: svgWrap('<circle cx="10" cy="10" r="3.2"/><path d="M10 4V2.2 M10 17.8V16 M4 10H2.2 M17.8 10H16"/>'),
  download: svgWrap('<path d="M10 3.5v8.5 M6.5 9 10 12.5 13.5 9 M4 16h12"/>'),
  logo: '<svg viewBox="0 0 32 32" width="24" height="24"><rect width="32" height="32" rx="7" fill="#1971c2"/><path d="M9 23l2.2-6.6L21 6.6l4.4 4.4-9.8 9.8L9 23z" fill="#fffdf8"/><path d="M18.2 9.4l4.4 4.4" stroke="#1971c2" stroke-width="1.6"/></svg>',
};

// ---------- Утилиты ----------
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const uid = () => 'e_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
const FONT_STACK = '"Segoe UI", system-ui, sans-serif';
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ESC[ch]);

const PALETTE = ['#1e1e1e', '#e03131', '#f08c00', '#2f9e44', '#15aabf', '#1971c2', '#9c36b5', '#6b7280'];
const CURSOR_COLORS = ['#e03131', '#1971c2', '#2f9e44', '#9c36b5', '#f08c00', '#15aabf', '#d6336c', '#5f3dc4'];
const SHAPE_TYPES = ['rect', 'ellipse', 'diamond'];

function colorForName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CURSOR_COLORS[h % CURSOR_COLORS.length];
}

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- Измерение текста ----------
const measureCtx = document.createElement('canvas').getContext('2d');
function measureTextEl(el) {
  const fs = el.fontSize || 20;
  measureCtx.font = `${fs}px ${FONT_STACK}`;
  const lines = String(el.text || '').split('\n');
  let w = 0;
  for (const l of lines) w = Math.max(w, measureCtx.measureText(l).width);
  return { w: Math.ceil(w) + 4, h: Math.ceil(lines.length * fs * 1.35) + 2 };
}

// ---------- Отрисовка элемента ----------
function drawElement(ctx, el) {
  const x = el.w < 0 ? el.x + el.w : el.x;
  const y = el.h < 0 ? el.y + el.h : el.y;
  const w = Math.abs(el.w || 0);
  const h = Math.abs(el.h || 0);
  ctx.save();
  ctx.strokeStyle = el.strokeColor || '#1e1e1e';
  ctx.lineWidth = el.strokeWidth || 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (el.type === 'rect') {
    if (el.fillColor) { ctx.fillStyle = el.fillColor; ctx.fillRect(x, y, w, h); }
    ctx.strokeRect(x, y, w, h);
    drawLabel(ctx, el, x + w / 2, y + h / 2);
  } else if (el.type === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 0.5), Math.max(h / 2, 0.5), 0, 0, Math.PI * 2);
    if (el.fillColor) { ctx.fillStyle = el.fillColor; ctx.fill(); }
    ctx.stroke();
    drawLabel(ctx, el, x + w / 2, y + h / 2);
  } else if (el.type === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
    if (el.fillColor) { ctx.fillStyle = el.fillColor; ctx.fill(); }
    ctx.stroke();
    drawLabel(ctx, el, x + w / 2, y + h / 2);
  } else if (el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw') {
    const pts = (el.points || []).map(([dx, dy]) => [el.x + dx, el.y + dy]);
    if (pts.length >= 2) {
      ctx.beginPath();
      if (el.type === 'freedraw' && pts.length > 2) {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2;
          const my = (pts[i][1] + pts[i + 1][1]) / 2;
          ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      } else {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.stroke();
      if (el.type === 'arrow') drawArrowHead(ctx, pts, el.strokeColor || '#1e1e1e', el.strokeWidth || 2);
    }
  } else if (el.type === 'text') {
    const fs = el.fontSize || 20;
    ctx.fillStyle = el.strokeColor || '#1e1e1e';
    ctx.font = `${fs}px ${FONT_STACK}`;
    ctx.textBaseline = 'top';
    const lines = String(el.text || '').split('\n');
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], el.x + 2, el.y + 1 + i * fs * 1.35);
  }
  ctx.restore();
}

function drawLabel(ctx, el, cx, cy) {
  if (!el.text) return;
  const fs = el.fontSize || 20;
  const lines = String(el.text).split('\n');
  const lh = fs * 1.35;
  ctx.save();
  ctx.fillStyle = el.strokeColor || '#1e1e1e';
  ctx.font = `${fs}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startY = cy - ((lines.length - 1) * lh) / 2;
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], cx, startY + i * lh);
  ctx.restore();
}

function drawArrowHead(ctx, pts, color, strokeWidth) {
  const end = pts[pts.length - 1];
  const prev = pts[pts.length - 2] || pts[0];
  let dx = end[0] - prev[0], dy = end[1] - prev[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  dx /= len; dy /= len;
  const size = 8 + strokeWidth * 2.5;
  const bx = end[0] - dx * size, by = end[1] - dy * size;
  const px = -dy, py = dx;
  const w2 = size * 0.42;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(end[0], end[1]);
  ctx.lineTo(bx + px * w2, by + py * w2);
  ctx.lineTo(bx - px * w2, by - py * w2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------- Геометрия / попадания ----------
function elBBox(el) {
  return { x: el.x, y: el.y, w: el.w || 0, h: el.h || 0 };
}

function combinedBBox(els) {
  if (!els.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of els) {
    const b = elBBox(el);
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function rectsIntersect(a, b) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

function distPointSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function hitTest(el, wx, wy, tol) {
  const b = elBBox(el);
  if (el.type === 'text') {
    return wx >= b.x - 2 && wx <= b.x + b.w + 2 && wy >= b.y - 2 && wy <= b.y + b.h + 2;
  }
  // Фигуры выделяются по всей внутренней области (как в Excalidraw)
  if (el.type === 'rect') {
    return wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h;
  }
  if (el.type === 'ellipse') {
    const rx = b.w / 2, ry = b.h / 2;
    if (rx < 0.5 || ry < 0.5) return false;
    return ((wx - (b.x + rx)) / rx) ** 2 + ((wy - (b.y + ry)) / ry) ** 2 <= 1;
  }
  if (el.type === 'diamond') {
    const rx = Math.max(b.w / 2, 0.5), ry = Math.max(b.h / 2, 0.5);
    return Math.abs(wx - (b.x + rx)) / rx + Math.abs(wy - (b.y + ry)) / ry <= 1;
  }
  if (el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw') {
    const pts = (el.points || []).map(([dx, dy]) => [el.x + dx, el.y + dy]);
    const t = tol + (el.strokeWidth || 2);
    for (let i = 0; i < pts.length - 1; i++) {
      if (distPointSeg(wx, wy, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <= t) return true;
    }
    return pts.length === 1 && Math.hypot(wx - pts[0][0], wy - pts[0][1]) <= t;
  }
  return false;
}

// ---------- Точка входа / маршрутизация ----------
const app = document.getElementById('app');
const path = location.pathname;
const boardMatch = path.match(/^\/b\/([^/]+)$/);
if (boardMatch) initEditor(decodeURIComponent(boardMatch[1]));
else initHome();

// ---------- Главная: список досок ----------
async function initHome() {
  let boards = [];
  try {
    const res = await fetch('/api/boards');
    boards = (await res.json()).boards || [];
  } catch { boards = []; }
  const fmt = (ts) => new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  app.innerHTML = `
    <main class="home">
      <div class="logo">
        <span class="logo-mark">${ICONS.logo}</span>
        <h1>Скетч</h1>
      </div>
      <p class="subtitle">Бесконечная доска для набросков и схем. Рисуйте сами или позовите кого-нибудь по ссылке.</p>
      <form class="new-board" id="newBoardForm">
        <input type="text" id="boardNameInput" placeholder="Название доски" maxlength="80">
        <button type="submit" class="primary">Новая доска</button>
      </form>
      <div class="board-list">
        ${boards.length ? boards.map((b) => `
          <a class="board-card" href="/b/${b.id}">
            <div class="thumb">${ICONS.logo}</div>
            <div class="name">${esc(b.name)}</div>
            <div class="meta">Изменена ${fmt(b.updated_at)}</div>
          </a>`).join('') : '<p class="empty">Пока нет ни одной доски. Создайте первую.</p>'}
      </div>
    </main>`;
  document.getElementById('newBoardForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('boardNameInput').value.trim() || 'Новая доска';
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.board) location.href = '/b/' + data.board.id;
  });
}

// ---------- Редактор ----------
async function initEditor(boardId) {
  const res = await fetch('/api/boards/' + encodeURIComponent(boardId));
  if (!res.ok) {
    app.innerHTML = `
      <main class="home">
        <h1>Доска не найдена</h1>
        <p class="subtitle">Возможно, ссылка неверная или доску удалили.</p>
        <p><a href="/">Вернуться к списку досок</a></p>
      </main>`;
    return;
  }
  const data = await res.json();
  let elements = (data.elements || []).map((el) => ({ ...el }));
  for (const el of elements) if (el.type === 'text') { const m = measureTextEl(el); el.w = m.w; el.h = m.h; }
  const boardName = data.board.name;

  // ----- Состояние -----
  const view = { x: 0, y: 0, zoom: 1 };
  let tool = 'select';
  const defaults = { strokeColor: '#1e1e1e', fillColor: null, strokeWidth: 2, fontSize: 20 };
  let selectedIds = new Set();
  let draft = null;
  let action = null;
  let spaceDown = false;
  let dirty = true;

  const undoStack = [];
  const redoStack = [];
  const snapshot = () => JSON.stringify(elements);
  const pushUndo = (preState) => {
    undoStack.push(preState ?? snapshot());
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
  };

  // ----- Имя пользователя -----
  let userName = localStorage.getItem('sketch.name') || '';
  const clientId = crypto.randomUUID();

  // ----- DOM -----
  app.innerHTML = `
    <div class="editor">
      <canvas id="sceneCanvas" class="layer"></canvas>
      <canvas id="overlayCanvas" class="layer"></canvas>
      <div class="topbar">
        <a class="back" href="/">${ICONS.back.replace('<svg', '<svg width="14" height="14"')} Доски</a>
        <span class="divider"></span>
        <span class="board-name">${esc(boardName)}</span>
        <span class="spacer"></span>
        <input type="text" class="name-input" id="nameInput" placeholder="Ваше имя" maxlength="32" value="${esc(userName)}">
        <span class="peers" id="peersLabel">Участники: 1</span>
        <span class="divider"></span>
        <button class="icon" id="undoBtn" title="Отменить (Ctrl+Z)">${ICONS.undo}</button>
        <button class="icon" id="redoBtn" title="Вернуть (Ctrl+Shift+Z)">${ICONS.redo}</button>
        <span class="divider"></span>
        <span class="zoom" id="zoomLabel">100%</span>
        <button class="labeled" id="resetViewBtn" title="Сброс вида">${ICONS.reset} Сброс вида</button>
        <span class="divider"></span>
        <button class="labeled" id="exportPngBtn">${ICONS.download} PNG</button>
        <button class="labeled" id="exportSvgBtn">${ICONS.download} SVG</button>
        <span class="save-status" id="saveStatus">Сохранено</span>
      </div>
      <div class="toolbar" id="toolbar"></div>
      <div class="properties" id="properties"></div>
      <div id="toast"></div>
    </div>`;

  const editorEl = app.querySelector('.editor');
  const sceneCanvas = document.getElementById('sceneCanvas');
  const overlayCanvas = document.getElementById('overlayCanvas');
  const sctx = sceneCanvas.getContext('2d');
  const octx = overlayCanvas.getContext('2d');
  const peersLabel = document.getElementById('peersLabel');
  const zoomLabel = document.getElementById('zoomLabel');
  const saveStatusEl = document.getElementById('saveStatus');
  let dpr = window.devicePixelRatio || 1;
  let W = 0, H = 0;

  function resizeCanvases() {
    dpr = window.devicePixelRatio || 1;
    W = editorEl.clientWidth; H = editorEl.clientHeight;
    for (const c of [sceneCanvas, overlayCanvas]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    dirty = true;
  }
  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);

  // ----- Координаты -----
  const screenToWorld = (sx, sy) => ({ x: view.x + sx / view.zoom, y: view.y + sy / view.zoom });
  const worldToScreen = (wx, wy) => ({ x: (wx - view.x) * view.zoom, y: (wy - view.y) * view.zoom });

  function updateZoomLabel() { zoomLabel.textContent = Math.round(view.zoom * 100) + '%'; }

  function resetView() {
    view.zoom = 1;
    const b = elements.length ? combinedBBox(elements) : null;
    if (b) {
      view.x = b.x + b.w / 2 - W / 2;
      view.y = b.y + b.h / 2 - H / 2;
    } else {
      view.x = -W / 2; view.y = -H / 2;
    }
    updateZoomLabel();
    dirty = true;
  }

  function zoomAt(sx, sy, factor) {
    const nz = clamp(view.zoom * factor, 0.2, 4);
    const wx = view.x + sx / view.zoom;
    const wy = view.y + sy / view.zoom;
    view.zoom = nz;
    view.x = wx - sx / nz;
    view.y = wy - sy / nz;
    updateZoomLabel();
    dirty = true;
  }

  // ----- WebSocket -----
  let ws = null;
  let wsTimer = null;
  const cursors = new Map(); // clientId -> {name, x, y, color, t}
  const draggingIds = new Set();

  function sendWs(type, data = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...data }));
  }

  function broadcastElement(el) { sendWs('element:update', { element: el }); }

  function deleteElementRemote(id) { sendWs('element:delete', { id }); }

  // Отправка изменений при перетаскивании (троттлинг)
  const pendingSync = new Map();
  let syncTimer = null;
  function queueSync(el) {
    pendingSync.set(el.id, el);
    if (!syncTimer) {
      syncTimer = setTimeout(() => {
        syncTimer = null;
        for (const el2 of pendingSync.values()) broadcastElement(el2);
        pendingSync.clear();
      }, 50);
    }
  }

  // Diff-синхронизация (после undo/redo)
  function syncDiff(fromArr, toArr) {
    const fromMap = new Map(fromArr.map((e) => [e.id, e]));
    const toMap = new Map(toArr.map((e) => [e.id, e]));
    for (const id of fromMap.keys()) if (!toMap.has(id)) deleteElementRemote(id);
    for (const [id, el] of toMap) {
      const prev = fromMap.get(id);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(el)) broadcastElement(el);
    }
  }

  let lastCursorSent = 0;
  function sendCursor(wx, wy) {
    const t = performance.now();
    if (t - lastCursorSent < 30) return;
    lastCursorSent = t;
    sendWs('cursor', { name: userName || 'Гость', x: Math.round(wx), y: Math.round(wy), clientId });
  }

  function connect() {
    clearTimeout(wsTimer);
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws?board=${encodeURIComponent(boardId)}`);
    ws.onopen = () => { peersLabel.textContent = 'Участники: 1'; };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (!msg || !msg.type) return;
      if (msg.type === 'peers') {
        peersLabel.textContent = 'Участники: ' + msg.count;
      } else if (msg.type === 'cursor') {
        if (msg.clientId === clientId) return;
        cursors.set(msg.clientId || msg.name, {
          name: msg.name || 'Гость',
          x: msg.x, y: msg.y,
          color: colorForName(msg.name || 'Гость'),
          t: performance.now(),
        });
      } else if (msg.type === 'element:update') {
        const el = msg.element;
        if (!el || !el.id || draggingIds.has(el.id)) return;
        if (editing && editing.el.id === el.id) return;
        const i = elements.findIndex((e) => e.id === el.id);
        if (i >= 0) elements[i] = el; else elements.push(el);
        dirty = true;
        scheduleSave();
      } else if (msg.type === 'element:delete') {
        if (draggingIds.has(msg.id)) return;
        const i = elements.findIndex((e) => e.id === msg.id);
        if (i >= 0) elements.splice(i, 1);
        selectedIds.delete(msg.id);
        dirty = true;
        scheduleSave();
      }
    };
    ws.onclose = () => { wsTimer = setTimeout(connect, 2000); };
  }

  // ----- Сохранение -----
  let saveTimer = null;
  let hasUnsaved = false;
  function scheduleSave() {
    hasUnsaved = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveBoard, 800);
  }
  async function saveBoard() {
    clearTimeout(saveTimer);
    saveTimer = null;
    saveStatusEl.textContent = 'Сохранение…';
    try {
      const r = await fetch(`/api/boards/${encodeURIComponent(boardId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements }),
      });
      if (!r.ok) throw new Error('bad status');
      hasUnsaved = false;
      saveStatusEl.textContent = 'Сохранено';
    } catch {
      saveStatusEl.textContent = 'Ошибка сохранения';
    }
  }
  window.addEventListener('pagehide', () => {
    if (!hasUnsaved) return;
    const blob = new Blob([JSON.stringify({ elements })], { type: 'application/json' });
    navigator.sendBeacon(`/api/boards/${encodeURIComponent(boardId)}`, blob);
  });

  // ----- Тулбар -----
  const TOOLS = [
    { id: 'select', title: 'Выделение (V)' },
    { id: 'hand', title: 'Рука — перемещение доски (H)' },
    { id: 'rect', title: 'Прямоугольник (R)' },
    { id: 'ellipse', title: 'Эллипс (O)' },
    { id: 'diamond', title: 'Ромб (D)' },
    { id: 'line', title: 'Линия (L)' },
    { id: 'arrow', title: 'Стрелка (A)' },
    { id: 'freedraw', title: 'Карандаш (P)' },
    { id: 'text', title: 'Текст (T)' },
    { id: 'eraser', title: 'Ластик (E)' },
  ];
  const TOOL_KEYS = { v: 'select', h: 'hand', r: 'rect', o: 'ellipse', d: 'diamond', l: 'line', a: 'arrow', p: 'freedraw', t: 'text', e: 'eraser' };
  const toolbarEl = document.getElementById('toolbar');
  toolbarEl.innerHTML = TOOLS.map((t) =>
    `<button data-tool="${t.id}" title="${t.title}">${ICONS[t.id]}</button>`).join('');
  toolbarEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tool]');
    if (btn) setTool(btn.dataset.tool);
  });

  function setTool(t) {
    tool = t;
    selectedIds.clear();
    for (const btn of toolbarEl.querySelectorAll('button[data-tool]')) {
      btn.classList.toggle('active', btn.dataset.tool === t);
    }
    updateCursorStyle();
    dirty = true;
  }

  // ----- Панель свойств -----
  const propsEl = document.getElementById('properties');
  propsEl.innerHTML = `
    <div class="prop"><span class="prop-label">Обводка</span><span class="swatches" id="strokeSwatches"></span></div>
    <div class="divider"></div>
    <div class="prop"><span class="prop-label">Заливка</span><span class="swatches" id="fillSwatches"></span></div>
    <div class="divider"></div>
    <div class="prop"><span class="prop-label">Толщина</span>
      <span class="seg" id="widthSeg">
        <button data-w="1">1</button><button data-w="2">2</button><button data-w="4">4</button>
      </span>
    </div>
    <div class="divider"></div>
    <div class="prop"><span class="prop-label">Шрифт</span>
      <span class="seg" id="fontSeg">
        <button data-f="16">16</button><button data-f="20">20</button><button data-f="28">28</button>
      </span>
    </div>`;

  const strokeSwatches = document.getElementById('strokeSwatches');
  const fillSwatches = document.getElementById('fillSwatches');
  strokeSwatches.innerHTML = PALETTE.map((c) =>
    `<button class="swatch" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('');
  fillSwatches.innerHTML =
    `<button class="swatch none" data-c="" title="Без заливки"></button>` +
    PALETTE.map((c) => `<button class="swatch" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('');

  function refElement() {
    for (const id of selectedIds) {
      const el = elements.find((e) => e.id === id);
      if (el) return el;
    }
    return null;
  }

  function updatePropsUI() {
    const ref = refElement();
    const stroke = ref ? ref.strokeColor : defaults.strokeColor;
    const fill = ref ? (ref.fillColor || '') : (defaults.fillColor || '');
    const width = ref ? ref.strokeWidth : defaults.strokeWidth;
    const font = ref ? (ref.fontSize || 20) : defaults.fontSize;
    for (const b of strokeSwatches.querySelectorAll('.swatch')) b.classList.toggle('active', b.dataset.c === stroke);
    for (const b of fillSwatches.querySelectorAll('.swatch')) b.classList.toggle('active', b.dataset.c === fill);
    for (const b of document.querySelectorAll('#widthSeg button')) b.classList.toggle('active', Number(b.dataset.w) === width);
    for (const b of document.querySelectorAll('#fontSeg button')) b.classList.toggle('active', Number(b.dataset.f) === font);
  }

  function applyStyle(patch) {
    const sel = elements.filter((e) => selectedIds.has(e.id));
    if (!sel.length) {
      Object.assign(defaults, patch);
      updatePropsUI();
      return;
    }
    const pre = snapshot();
    for (const el of sel) {
      let changed = false;
      if (patch.strokeColor !== undefined && el.strokeColor !== patch.strokeColor) { el.strokeColor = patch.strokeColor; changed = true; }
      if (patch.strokeWidth !== undefined && el.strokeWidth !== patch.strokeWidth) { el.strokeWidth = patch.strokeWidth; changed = true; }
      if (patch.fillColor !== undefined && SHAPE_TYPES.includes(el.type) && (el.fillColor || null) !== patch.fillColor) { el.fillColor = patch.fillColor; changed = true; }
      if (patch.fontSize !== undefined && (el.type === 'text' || SHAPE_TYPES.includes(el.type)) && el.fontSize !== patch.fontSize) {
        el.fontSize = patch.fontSize;
        if (el.type === 'text') { const m = measureTextEl(el); el.w = m.w; el.h = m.h; }
        changed = true;
      }
      if (changed) broadcastElement(el);
    }
    pushUndo(pre);
    scheduleSave();
    updatePropsUI();
    dirty = true;
  }

  strokeSwatches.addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (b) applyStyle({ strokeColor: b.dataset.c });
  });
  fillSwatches.addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (b) applyStyle({ fillColor: b.dataset.c || null });
  });
  document.getElementById('widthSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) applyStyle({ strokeWidth: Number(b.dataset.w) });
  });
  document.getElementById('fontSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) applyStyle({ fontSize: Number(b.dataset.f) });
  });

  // ----- Отмена/повтор -----
  function undo() {
    if (!undoStack.length) return;
    const cur = snapshot();
    const prev = undoStack.pop();
    redoStack.push(cur);
    elements = JSON.parse(prev);
    selectedIds = new Set([...selectedIds].filter((id) => elements.some((e) => e.id === id)));
    syncDiff(JSON.parse(cur), elements);
    scheduleSave();
    updatePropsUI();
    dirty = true;
  }
  function redo() {
    if (!redoStack.length) return;
    const cur = snapshot();
    const next = redoStack.pop();
    undoStack.push(cur);
    elements = JSON.parse(next);
    selectedIds = new Set([...selectedIds].filter((id) => elements.some((e) => e.id === id)));
    syncDiff(JSON.parse(cur), elements);
    scheduleSave();
    updatePropsUI();
    dirty = true;
  }
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);

  function deleteSelection() {
    const sel = elements.filter((e) => selectedIds.has(e.id));
    if (!sel.length) return;
    pushUndo();
    for (const el of sel) {
      elements = elements.filter((e) => e.id !== el.id);
      deleteElementRemote(el.id);
    }
    selectedIds.clear();
    scheduleSave();
    updatePropsUI();
    dirty = true;
  }

  // ----- Выделение / ручки -----
  function selectedEls() { return elements.filter((e) => selectedIds.has(e.id)); }

  function topmostHit(wx, wy, tol) {
    for (let i = elements.length - 1; i >= 0; i--) {
      if (hitTest(elements[i], wx, wy, tol)) return elements[i];
    }
    return null;
  }

  function handlePoints() {
    const b = combinedBBox(selectedEls());
    if (!b) return [];
    return [
      { id: 'nw', x: b.x, y: b.y },
      { id: 'ne', x: b.x + b.w, y: b.y },
      { id: 'sw', x: b.x, y: b.y + b.h },
      { id: 'se', x: b.x + b.w, y: b.y + b.h },
    ];
  }

  function handleAt(sx, sy) {
    for (const hp of handlePoints()) {
      const s = worldToScreen(hp.x, hp.y);
      if (Math.hypot(s.x - sx, s.y - sy) <= 10) return hp.id;
    }
    return null;
  }

  // ----- Редактирование текста -----
  let editing = null;
  function openTextEditor(el, isNew) {
    closeTextEditor(true);
    const ta = document.createElement('textarea');
    ta.id = 'textEditor';
    const s = worldToScreen(el.x, el.y);
    ta.style.left = s.x + 'px';
    ta.style.top = s.y + 'px';
    ta.style.fontSize = (el.fontSize || 20) * view.zoom + 'px';
    ta.style.lineHeight = '1.35';
    ta.style.color = el.strokeColor || '#1e1e1e';
    ta.style.width = Math.max((el.w || 0) * view.zoom + 14, 120) + 'px';
    ta.value = el.text || '';
    editorEl.appendChild(ta);
    editing = { el, isNew, ta, cancel: false };
    ta.addEventListener('blur', commitText);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { editing.cancel = true; ta.blur(); }
      e.stopPropagation();
    });
    ta.focus();
  }

  function commitText() {
    if (!editing) return;
    const { el, isNew, ta, cancel } = editing;
    editing = null;
    ta.remove();
    if (cancel) { dirty = true; return; }
    const text = ta.value.replace(/\r/g, '').replace(/\s+$/g, '');
    if (!text.trim()) {
      if (!isNew) {
        pushUndo();
        elements = elements.filter((e) => e.id !== el.id);
        deleteElementRemote(el.id);
        selectedIds.delete(el.id);
        scheduleSave();
      }
      dirty = true;
      return;
    }
    const pre = snapshot();
    el.text = text;
    const m = measureTextEl(el);
    el.w = m.w; el.h = m.h;
    if (isNew) elements.push(el);
    pushUndo(pre);
    broadcastElement(el);
    selectedIds = new Set([el.id]);
    scheduleSave();
    updatePropsUI();
    dirty = true;
  }

  function closeTextEditor(discardOnly) {
    if (!editing) return;
    if (discardOnly) {
      const { ta } = editing;
      editing = null;
      ta.remove();
    } else {
      editing.ta.blur();
    }
  }

  function createTextAt(w) {
    const el = {
      id: uid(), type: 'text', x: w.x, y: w.y, w: 0, h: 0, text: '',
      fontSize: defaults.fontSize, strokeColor: defaults.strokeColor,
      fillColor: null, strokeWidth: 2, seed: (Math.random() * 2 ** 31) | 0,
    };
    openTextEditor(el, true);
  }

  // ----- Ластик -----
  function eraseAt(w) {
    const hit = topmostHit(w.x, w.y, 6 / view.zoom);
    if (!hit) return;
    if (!action.erased) { pushUndo(); action.erased = true; }
    elements = elements.filter((e) => e.id !== hit.id);
    selectedIds.delete(hit.id);
    deleteElementRemote(hit.id);
    scheduleSave();
    dirty = true;
  }

  // ----- Указатель -----
  function updateCursorStyle(hoverEl) {
    let cur = 'default';
    if (tool === 'hand') cur = 'grab';
    else if (tool === 'text') cur = 'text';
    else if (tool === 'select') {
      const h = handleAt(lastSX, lastSY);
      if (h === 'nw' || h === 'se') cur = 'nwse-resize';
      else if (h === 'ne' || h === 'sw') cur = 'nesw-resize';
      else if (hoverEl) cur = 'move';
    } else cur = 'crosshair';
    overlayCanvas.style.cursor = cur;
  }

  let lastSX = 0, lastSY = 0;

  overlayCanvas.addEventListener('pointerdown', (e) => {
    // Без этого браузерный дефолт mousedown снимет фокус с textarea-оверлея
    // (если успел открыться) до основного клика.
    e.preventDefault();
    closeTextEditor(false); // блюр текстового поля, если открыто
    lastSX = e.offsetX; lastSY = e.offsetY;
    if (e.button === 1 || spaceDown || tool === 'hand') {
      action = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
      overlayCanvas.style.cursor = 'grabbing';
      overlayCanvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const w = screenToWorld(e.offsetX, e.offsetY);

    if (tool === 'text') { createTextAt(w); return; }
    if (tool === 'eraser') {
      action = { mode: 'erase', erased: false };
      overlayCanvas.setPointerCapture(e.pointerId);
      eraseAt(w);
      return;
    }
    if (tool === 'select') {
      const handle = handleAt(e.offsetX, e.offsetY);
      if (handle) {
        const sel = selectedEls();
        action = {
          mode: 'resize', handle,
          oldBBox: combinedBBox(sel),
          origEls: new Map(sel.map((el) => [el.id, JSON.parse(JSON.stringify(el))])),
          preState: snapshot(),
          moved: false,
        };
        overlayCanvas.setPointerCapture(e.pointerId);
        return;
      }
      const hit = topmostHit(w.x, w.y, 6 / view.zoom);
      if (hit) {
        if (e.shiftKey) {
          if (selectedIds.has(hit.id)) selectedIds.delete(hit.id);
          else selectedIds.add(hit.id);
        } else if (!selectedIds.has(hit.id)) {
          selectedIds = new Set([hit.id]);
        }
        const sel = selectedEls();
        action = {
          mode: 'move', start: w,
          origEls: new Map(sel.map((el) => [el.id, JSON.parse(JSON.stringify(el))])),
          preState: snapshot(),
          moved: false,
        };
        draggingIds.clear();
        for (const el of sel) draggingIds.add(el.id);
        overlayCanvas.setPointerCapture(e.pointerId);
        updatePropsUI();
        dirty = true;
        return;
      }
      if (!e.shiftKey) selectedIds.clear();
      action = { mode: 'marquee', start: w, cur: w, base: new Set(selectedIds) };
      overlayCanvas.setPointerCapture(e.pointerId);
      updatePropsUI();
      dirty = true;
      return;
    }

    // Инструменты рисования
    const el = {
      id: uid(), type: tool, x: w.x, y: w.y, w: 0, h: 0,
      strokeColor: defaults.strokeColor,
      fillColor: SHAPE_TYPES.includes(tool) ? defaults.fillColor : null,
      strokeWidth: defaults.strokeWidth,
      seed: (Math.random() * 2 ** 31) | 0,
    };
    if (tool === 'line' || tool === 'arrow' || tool === 'freedraw') {
      el.points = [[0, 0]];
      el.fillColor = null;
    } else {
      el.fontSize = defaults.fontSize;
    }
    draft = el;
    action = { mode: 'draw', start: w };
    overlayCanvas.setPointerCapture(e.pointerId);
    dirty = true;
  });

  overlayCanvas.addEventListener('pointermove', (e) => {
    lastSX = e.offsetX; lastSY = e.offsetY;
    const w = screenToWorld(e.offsetX, e.offsetY);
    sendCursor(w.x, w.y);

    if (!action) {
      if (tool === 'select') updateCursorStyle(topmostHit(w.x, w.y, 6 / view.zoom));
      return;
    }

    if (action.mode === 'pan') {
      view.x = action.vx - (e.clientX - action.sx) / view.zoom;
      view.y = action.vy - (e.clientY - action.sy) / view.zoom;
      dirty = true;
    } else if (action.mode === 'draw') {
      if (draft.type === 'freedraw') {
        const pts = draft.points;
        const last = pts[pts.length - 1];
        const nx = w.x - draft.x, ny = w.y - draft.y;
        if (Math.hypot(nx - last[0], ny - last[1]) > 1.2 / view.zoom) pts.push([nx, ny]);
      } else if (draft.type === 'line' || draft.type === 'arrow') {
        draft.points = [[0, 0], [w.x - draft.x, w.y - draft.y]];
      }
      draft.w = w.x - draft.x;
      draft.h = w.y - draft.y;
      dirty = true;
    } else if (action.mode === 'move') {
      const dx = w.x - action.start.x;
      const dy = w.y - action.start.y;
      if (Math.hypot(dx, dy) > 0.5) action.moved = true;
      for (const el of elements) {
        const orig = action.origEls.get(el.id);
        if (!orig) continue;
        el.x = orig.x + dx;
        el.y = orig.y + dy;
        queueSync(el);
      }
      dirty = true;
    } else if (action.mode === 'resize') {
      applyResize(w, e.shiftKey);
      action.moved = true;
      dirty = true;
    } else if (action.mode === 'marquee') {
      action.cur = w;
      dirty = true;
    } else if (action.mode === 'erase') {
      eraseAt(w);
    }
  });

  overlayCanvas.addEventListener('pointerup', (e) => {
    if (!action) return;
    const a = action;
    action = null;
    draggingIds.clear();
    overlayCanvas.style.cursor = tool === 'hand' ? 'grab' : 'default';

    if (a.mode === 'pan') { updateCursorStyle(); return; }

    if (a.mode === 'draw' && draft) {
      finalizeDraft(a);
      return;
    }

    if (a.mode === 'move') {
      if (a.moved) {
        undoStack.push(a.preState);
        if (undoStack.length > 100) undoStack.shift();
        redoStack.length = 0;
        for (const el of elements) if (a.origEls.has(el.id)) broadcastElement(el);
        scheduleSave();
      }
      updateCursorStyle();
      dirty = true;
      return;
    }

    if (a.mode === 'resize') {
      if (a.moved) {
        undoStack.push(a.preState);
        if (undoStack.length > 100) undoStack.shift();
        redoStack.length = 0;
        for (const el of elements) if (a.origEls.has(el.id)) broadcastElement(el);
        scheduleSave();
      }
      updatePropsUI();
      dirty = true;
      return;
    }

    if (a.mode === 'marquee') {
      const rect = normRect(a.start, a.cur);
      if (rect.w > 4 || rect.h > 4) {
        const hits = elements.filter((el) => rectsIntersect(rect, elBBox(el)));
        const base = e.shiftKey ? new Set(a.base) : new Set();
        for (const el of hits) base.add(el.id);
        selectedIds = base;
      }
      updatePropsUI();
      dirty = true;
      return;
    }

    if (a.mode === 'erase') { scheduleSave(); }
  });

  overlayCanvas.addEventListener('pointerleave', () => {
    if (!action) updateCursorStyle();
  });

  function normRect(p1, p2) {
    return { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y) };
  }

  function finalizeDraft(a) {
    const el = draft;
    draft = null;
    if (el.type === 'freedraw') {
      if (!el.points || el.points.length < 2) { dirty = true; return; }
      normalizePoints(el);
    } else if (el.type === 'line' || el.type === 'arrow') {
      // рисование: старт в (el.x, el.y), конец в (el.x + el.w, el.y + el.h)
      const dx = el.w, dy = el.h;
      if (Math.hypot(dx, dy) < 5) { dirty = true; return; }
      const sx0 = el.x, sy0 = el.y; // точка старта
      el.x = Math.min(sx0, sx0 + dx);
      el.y = Math.min(sy0, sy0 + dy);
      el.w = Math.abs(dx);
      el.h = Math.abs(dy);
      el.points = [
        [sx0 - el.x, sy0 - el.y],
        [sx0 + dx - el.x, sy0 + dy - el.y],
      ];
    } else {
      const r = normRect({ x: el.x, y: el.y }, { x: el.x + el.w, y: el.y + el.h });
      if (r.w < 6 && r.h < 6) { r.x -= 60; r.y -= 40; r.w = 120; r.h = 80; }
      el.x = r.x; el.y = r.y; el.w = r.w; el.h = r.h;
    }
    const pre = snapshot();
    elements.push(el);
    undoStack.push(pre);
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
    selectedIds = new Set([el.id]);
    broadcastElement(el);
    scheduleSave();
    updatePropsUI();
    dirty = true;
  }

  function normalizePoints(el) {
    const pts = el.points;
    const minX = Math.min(...pts.map((p) => p[0]));
    const minY = Math.min(...pts.map((p) => p[1]));
    const maxX = Math.max(...pts.map((p) => p[0]));
    const maxY = Math.max(...pts.map((p) => p[1]));
    el.x += minX; el.y += minY;
    el.w = Math.max(maxX - minX, 1);
    el.h = Math.max(maxY - minY, 1);
    el.points = pts.map(([dx, dy]) => [dx - minX, dy - minY]);
  }

  function applyResize(w, uniform) {
    const a = action;
    const old = a.oldBBox;
    if (!old || old.w < 1 || old.h < 1) return;
    const fx = a.handle.includes('w') ? old.x + old.w : old.x;
    const fy = a.handle.includes('n') ? old.y + old.h : old.y;
    let nx = Math.min(fx, w.x), ny = Math.min(fy, w.y);
    let nw = Math.max(4, Math.abs(fx - w.x));
    let nh = Math.max(4, Math.abs(fy - w.y));
    if (uniform) {
      const s = Math.max(nw / old.w, nh / old.h);
      nw = old.w * s; nh = old.h * s;
      const sxn = Math.sign(w.x - fx) || 1;
      const syn = Math.sign(w.y - fy) || 1;
      nx = sxn > 0 ? fx : fx - nw;
      ny = syn > 0 ? fy : fy - nh;
    }
    const sx = nw / old.w;
    const sy = nh / old.h;
    for (const el of elements) {
      const orig = a.origEls.get(el.id);
      if (!orig) continue;
      el.x = nx + (orig.x - old.x) * sx;
      el.y = ny + (orig.y - old.y) * sy;
      if (el.type === 'text') {
        const s = Math.max(sx, sy);
        el.fontSize = clamp(Math.round(orig.fontSize * s), 8, 120);
        const m = measureTextEl({ text: orig.text, fontSize: el.fontSize });
        el.w = m.w; el.h = m.h;
      } else {
        el.w = Math.max(2, (orig.w || 0) * sx);
        el.h = Math.max(2, (orig.h || 0) * sy);
        if (orig.points) {
          el.points = orig.points.map(([dx, dy]) => [dx * sx, dy * sy]);
        }
      }
      queueSync(el);
    }
  }

  // ----- Двойной клик: текст -----
  overlayCanvas.addEventListener('dblclick', (e) => {
    if (tool !== 'select') return;
    const w = screenToWorld(e.offsetX, e.offsetY);
    // сначала текстовые элементы
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.type === 'text' && hitTest(el, w.x, w.y, 6 / view.zoom)) {
        openTextEditor(el, false);
        return;
      }
    }
    createTextAt(w);
  });

  // ----- Колесо: зум -----
  overlayCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = Math.pow(1.0015, -e.deltaY);
    zoomAt(e.offsetX, e.offsetY, factor);
  }, { passive: false });

  overlayCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ----- Клавиатура -----
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.code === 'Space') { spaceDown = true; if (tool !== 'hand') overlayCanvas.style.cursor = 'grab'; e.preventDefault(); return; }
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
    if (e.key === 'Escape') {
      if (draft) { draft = null; action = null; }
      else selectedIds.clear();
      dirty = true;
      return;
    }
    if (!e.ctrlKey && !e.metaKey && TOOL_KEYS[k]) setTool(TOOL_KEYS[k]);
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spaceDown = false;
      if (tool !== 'hand') updateCursorStyle();
    }
  });

  // ----- Имя пользователя -----
  const nameInput = document.getElementById('nameInput');
  let loginTimer = null;
  nameInput.addEventListener('input', () => {
    userName = nameInput.value.trim().slice(0, 32);
    localStorage.setItem('sketch.name', userName);
    clearTimeout(loginTimer);
    loginTimer = setTimeout(() => {
      if (!userName) return;
      fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName }),
      }).catch(() => {});
    }, 500);
  });

  // ----- Кнопки верхней панели -----
  document.getElementById('resetViewBtn').addEventListener('click', resetView);
  document.getElementById('exportPngBtn').addEventListener('click', exportPng);
  document.getElementById('exportSvgBtn').addEventListener('click', exportSvg);

  // ----- Экспорт -----
  function exportBBox() {
    const b = combinedBBox(elements);
    if (!b) { toast('Доска пуста — нечего экспортировать'); return null; }
    return b;
  }
  const safeFileName = () => (boardName || 'Доска').replace(/[\\/:*?"<>|]+/g, '').trim() || 'Доска';

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function exportPng() {
    const b = exportBBox();
    if (!b) return;
    const pad = 24;
    const scale = 2;
    const c = document.createElement('canvas');
    c.width = Math.round((b.w + pad * 2) * scale);
    c.height = Math.round((b.h + pad * 2) * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.setTransform(scale, 0, 0, scale, -(b.x - pad) * scale, -(b.y - pad) * scale);
    for (const el of elements) drawElement(ctx, el);
    c.toBlob((blob) => blob && downloadBlob(blob, safeFileName() + '.png'), 'image/png');
    toast('PNG сохранён в загрузки');
  }

  function svgCommon(el) {
    const stroke = esc(el.strokeColor || '#1e1e1e');
    const fill = el.fillColor ? esc(el.fillColor) : 'none';
    return `stroke="${stroke}" fill="${fill}" stroke-width="${el.strokeWidth || 2}" stroke-linecap="round" stroke-linejoin="round"`;
  }

  function svgLabel(el, cx, cy) {
    if (!el.text) return '';
    const fs = el.fontSize || 20;
    const lines = esc(el.text).split('\n');
    const lh = fs * 1.35;
    const first = cy - ((lines.length - 1) * lh) / 2;
    const tspans = lines.map((l, i) => `<tspan x="${cx}" y="${first + i * lh}">${l}</tspan>`).join('');
    return `<text font-size="${fs}" fill="${esc(el.strokeColor || '#1e1e1e')}" text-anchor="middle" dominant-baseline="central" font-family="Segoe UI, sans-serif">${tspans}</text>`;
  }

  function elToSvg(el) {
    const x = el.w < 0 ? el.x + el.w : el.x;
    const y = el.h < 0 ? el.y + el.h : el.y;
    const w = Math.abs(el.w || 0);
    const h = Math.abs(el.h || 0);
    const r2 = (n) => Math.round(n * 100) / 100;
    if (el.type === 'rect') {
      return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" ${svgCommon(el)}/>` + svgLabel(el, x + w / 2, y + h / 2);
    }
    if (el.type === 'ellipse') {
      return `<ellipse cx="${r2(x + w / 2)}" cy="${r2(y + h / 2)}" rx="${r2(w / 2)}" ry="${r2(h / 2)}" ${svgCommon(el)}/>` + svgLabel(el, x + w / 2, y + h / 2);
    }
    if (el.type === 'diamond') {
      const pts = `${r2(x + w / 2)},${r2(y)} ${r2(x + w)},${r2(y + h / 2)} ${r2(x + w / 2)},${r2(y + h)} ${r2(x)},${r2(y + h / 2)}`;
      return `<polygon points="${pts}" ${svgCommon(el)}/>` + svgLabel(el, x + w / 2, y + h / 2);
    }
    if (el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw') {
      const pts = (el.points || []).map(([dx, dy]) => `${r2(el.x + dx)},${r2(el.y + dy)}`).join(' ');
      const line = `<polyline points="${pts}" ${svgCommon(el)}/>`;
      if (el.type !== 'arrow') return line;
      // головка стрелки — треугольник
      const abs = (el.points || []).map(([dx, dy]) => [el.x + dx, el.y + dy]);
      if (abs.length < 2) return line;
      const end = abs[abs.length - 1];
      const prev = abs[abs.length - 2];
      let dx = end[0] - prev[0], dy = end[1] - prev[1];
      const len = Math.hypot(dx, dy);
      if (!len) return line;
      dx /= len; dy /= len;
      const size = 8 + (el.strokeWidth || 2) * 2.5;
      const bx = end[0] - dx * size, by = end[1] - dy * size;
      const px = -dy, py = dx;
      const w2 = size * 0.42;
      const tri = [end, [bx + px * w2, by + py * w2], [bx - px * w2, by - py * w2]]
        .map((p) => `${r2(p[0])},${r2(p[1])}`).join(' ');
      return line + `<polygon points="${tri}" fill="${esc(el.strokeColor || '#1e1e1e')}"/>`;
    }
    if (el.type === 'text') {
      const fs = el.fontSize || 20;
      const lines = esc(el.text || '').split('\n');
      const lh = fs * 1.35;
      const tspans = lines.map((l, i) => `<tspan x="${r2(el.x + 2)}" y="${r2(el.y + 1 + i * lh + fs * 0.8)}">${l}</tspan>`).join('');
      return `<text font-size="${fs}" fill="${esc(el.strokeColor || '#1e1e1e')}" font-family="Segoe UI, sans-serif">${tspans}</text>`;
    }
    return '';
  }

  function exportSvg() {
    const b = exportBBox();
    if (!b) return;
    const pad = 24;
    const body = elements.map(elToSvg).join('\n');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}" width="${Math.round(b.w + pad * 2)}" height="${Math.round(b.h + pad * 2)}">
<rect x="${b.x - pad}" y="${b.y - pad}" width="${b.w + pad * 2}" height="${b.h + pad * 2}" fill="#ffffff"/>
${body}
</svg>`;
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), safeFileName() + '.svg');
    toast('SVG сохранён в загрузки');
  }

  // ----- Отрисовка -----
  function drawGrid(ctx) {
    let step = 26;
    while (step * view.zoom < 18) step *= 2;
    const x0 = Math.floor(view.x / step) * step;
    const y0 = Math.floor(view.y / step) * step;
    const x1 = view.x + W / view.zoom;
    const y1 = view.y + H / view.zoom;
    ctx.fillStyle = 'rgba(120, 105, 80, 0.16)';
    for (let wx = x0; wx <= x1; wx += step) {
      for (let wy = y0; wy <= y1; wy += step) {
        const s = worldToScreen(wx, wy);
        ctx.fillRect(s.x, s.y, 1.2, 1.2);
      }
    }
  }

  function drawScene() {
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, W, H);
    drawGrid(sctx);
    sctx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, -view.x * view.zoom * dpr, -view.y * view.zoom * dpr);
    for (const el of elements) {
      if (editing && editing.el.id === el.id) continue;
      drawElement(sctx, el);
    }
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCursorArrow(ctx, sx, sy, c) {
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 13, sy + 4.5);
    ctx.lineTo(sx + 5.5, sy + 8);
    ctx.lineTo(sx + 3, sy + 15);
    ctx.closePath();
    ctx.fill();
    ctx.font = '11px ' + FONT_STACK;
    const label = c.name.slice(0, 16);
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = c.color;
    rr(ctx, sx + 10, sy + 13, tw + 12, 18, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, sx + 16, sy + 22.5);
  }

  function drawOverlay() {
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, W, H);

    // мировые координаты: черновик, выделение, рамка
    octx.setTransform(dpr * view.zoom, 0, 0, dpr * view.zoom, -view.x * view.zoom * dpr, -view.y * view.zoom * dpr);
    const iz = 1 / view.zoom;

    if (draft) drawElement(octx, draft);

    const sel = selectedEls();
    if (sel.length && tool === 'select') {
      octx.strokeStyle = '#1971c2';
      octx.lineWidth = iz;
      octx.setLineDash([4 * iz, 4 * iz]);
      for (const el of sel) {
        const b = elBBox(el);
        octx.strokeRect(b.x - 2 * iz, b.y - 2 * iz, b.w + 4 * iz, b.h + 4 * iz);
      }
      octx.setLineDash([]);
      octx.strokeStyle = '#1971c2';
      octx.lineWidth = iz;
      octx.fillStyle = '#ffffff';
      const hs = 8 * iz;
      for (const hp of handlePoints()) {
        octx.fillRect(hp.x - hs / 2, hp.y - hs / 2, hs, hs);
        octx.strokeRect(hp.x - hs / 2, hp.y - hs / 2, hs, hs);
      }
    }

    if (action && action.mode === 'marquee') {
      const rect = normRect(action.start, action.cur);
      octx.strokeStyle = '#1971c2';
      octx.lineWidth = iz;
      octx.setLineDash([5 * iz, 4 * iz]);
      octx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      octx.setLineDash([]);
    }

    // курсоры участников (экранные координаты)
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const now = performance.now();
    for (const [id, c] of [...cursors]) {
      if (now - c.t > 10000) { cursors.delete(id); continue; }
      const s = worldToScreen(c.x, c.y);
      drawCursorArrow(octx, s.x, s.y, c);
    }
  }

  function loop() {
    if (dirty) { drawScene(); dirty = false; }
    drawOverlay();
    requestAnimationFrame(loop);
  }

  // ----- Старт -----
  setTool('select');
  updatePropsUI();
  resetView();
  connect();
  requestAnimationFrame(loop);

  // Отладочный хук для автотестов (не участвует в UI)
  window.__sketch = {
    boardId,
    getView: () => ({ ...view }),
    getElements: () => elements.map((e) => ({ ...e })),
    getSelection: () => [...selectedIds],
    worldToScreen,
    screenToWorld,
  };
}
