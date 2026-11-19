// «Скетч» — бесконечная доска с мультиплеером (клон Excalidraw/Miro).
// API досок + WS-комнаты по board id. Доска хранится целиком в JSONB (elements_json).
import { createApp, json, badRequest, notFound } from './lib/http.mjs';
import { migrate, db, uid } from './lib/db.mjs';
import { ensureAuthTables, loginByName, currentUser } from './lib/auth.mjs';
import { setupWs, sendTo, broadcast } from './lib/ws.mjs';

migrate([
  {
    id: '001-boards',
    sql: `
      create table if not exists users (
        id text primary key,
        name text not null,
        created integer not null
      );
      create table if not exists boards (
        id text primary key,
        name text not null,
        elements_json text not null default '[]',
        updated_at integer not null
      );
    `,
  },
]);
ensureAuthTables(db);

// ---------- Демо-доска (сид) ----------
function ensureDemoBoard() {
  const exists = db.prepare(`select id from boards where id = 'demo'`).get();
  if (exists) return;
  const rnd = () => Math.floor(Math.random() * 2 ** 31);
  const els = [
    { id: 'demo-frame', type: 'rect', x: -30, y: -50, w: 780, h: 370, strokeColor: '#1e1e1e', fillColor: null, strokeWidth: 2, seed: rnd() },
    { id: 'demo-title', type: 'text', x: 60, y: 0, w: 10, h: 10, text: 'Архитектура', fontSize: 30, strokeColor: '#1e1e1e', fillColor: null, strokeWidth: 2, seed: rnd() },
    { id: 'demo-arrow-title', type: 'arrow', x: 250, y: 52, w: 70, h: 30, points: [[0, 0], [70, 30]], strokeColor: '#e03131', fillColor: null, strokeWidth: 2, seed: rnd() },
    { id: 'demo-client', type: 'rect', x: 60, y: 190, w: 170, h: 80, text: 'Клиент', fontSize: 20, strokeColor: '#1e1e1e', fillColor: '#dbeafe', strokeWidth: 2, seed: rnd() },
    { id: 'demo-server', type: 'rect', x: 330, y: 190, w: 170, h: 80, text: 'Сервер', fontSize: 20, strokeColor: '#1e1e1e', fillColor: '#dcfce7', strokeWidth: 2, seed: rnd() },
    { id: 'demo-db', type: 'rect', x: 600, y: 190, w: 170, h: 80, text: 'База данных', fontSize: 20, strokeColor: '#1e1e1e', fillColor: '#fef3c7', strokeWidth: 2, seed: rnd() },
    { id: 'demo-arrow-1', type: 'arrow', x: 230, y: 230, w: 100, h: 0, points: [[0, 0], [100, 0]], strokeColor: '#1e1e1e', fillColor: null, strokeWidth: 2, seed: rnd() },
    { id: 'demo-arrow-2', type: 'arrow', x: 500, y: 230, w: 100, h: 0, points: [[0, 0], [100, 0]], strokeColor: '#1e1e1e', fillColor: null, strokeWidth: 2, seed: rnd() },
  ];
  // Росчерк свободной рукой: синусоида, нормализованная в points относительно (x, y).
  const raw = [];
  for (let t = 0; t <= 48; t++) raw.push([555 + t * 3.6, 62 + Math.sin(t / 3.2) * 24 + Math.sin(t / 9) * 9]);
  const minX = Math.min(...raw.map((p) => p[0]));
  const minY = Math.min(...raw.map((p) => p[1]));
  const maxX = Math.max(...raw.map((p) => p[0]));
  const maxY = Math.max(...raw.map((p) => p[1]));
  els.push({
    id: 'demo-freedraw', type: 'freedraw', x: minX, y: minY, w: maxX - minX, h: maxY - minY,
    points: raw.map(([px, py]) => [Math.round(px - minX), Math.round(py - minY)]),
    strokeColor: '#1971c2', fillColor: null, strokeWidth: 2, seed: rnd(),
  });
  // Текст «Архитектура»: размеры пересчитает клиент при отрисовке, но зададим прикидку.
  const title = els[1];
  title.w = 200; title.h = 40;
  db.prepare(`insert into boards(id, name, elements_json, updated_at) values ('demo', 'Демо', ?, ?)`)
    .run(JSON.stringify(els), Date.now());
}
ensureDemoBoard();

const app = createApp({ publicDir: 'public', spa: true });

// ---------- Вход по имени (для подписи курсоров) ----------
app.post('/api/login', (ctx) => {
  const user = loginByName(db, ctx.res, ctx.body.name);
  if (!user) return json(ctx.res, 400, { error: 'need_name' });
  json(ctx.res, 200, { user });
});

app.get('/api/me', (ctx) => {
  json(ctx.res, 200, { user: currentUser(db, ctx) });
});

// ---------- Доски ----------
const boardPublic = (b) => ({ id: b.id, name: b.name, updated_at: b.updated_at });

app.get('/api/boards', (ctx) => {
  const boards = db.prepare('select * from boards order by updated_at desc').all().map(boardPublic);
  json(ctx.res, 200, { boards });
});

app.post('/api/boards', (ctx) => {
  const name = String(ctx.body.name || '').trim().slice(0, 80);
  if (!name) return badRequest(ctx.res, 'need_name');
  const id = uid('b_');
  db.prepare('insert into boards(id, name, elements_json, updated_at) values (?, ?, ?, ?)')
    .run(id, name, '[]', Date.now());
  const board = db.prepare('select * from boards where id = ?').get(id);
  json(ctx.res, 200, { board: boardPublic(board) });
});

app.get('/api/boards/:id', (ctx) => {
  const board = db.prepare('select * from boards where id = ?').get(ctx.params.id);
  if (!board) return notFound(ctx.res);
  let elements = [];
  try { elements = JSON.parse(board.elements_json) || []; } catch { elements = []; }
  json(ctx.res, 200, { board: boardPublic(board), elements });
});

// Сохранение доски. PUT — обычное сохранение, POST — алиас для navigator.sendBeacon.
function saveBoardHandler(ctx) {
  const board = db.prepare('select id from boards where id = ?').get(ctx.params.id);
  if (!board) return notFound(ctx.res);
  const elements = ctx.body.elements;
  if (!Array.isArray(elements)) return badRequest(ctx.res, 'elements_array_required');
  // Отбрасываем некорректные элементы, чтобы JSON в БД всегда был валидным.
  const clean = elements.filter(
    (e) => e && typeof e === 'object' && typeof e.id === 'string' && typeof e.type === 'string'
  );
  db.prepare('update boards set elements_json = ?, updated_at = ? where id = ?')
    .run(JSON.stringify(clean), Date.now(), ctx.params.id);
  json(ctx.res, 200, { ok: true, count: clean.length });
}
app.put('/api/boards/:id', saveBoardHandler);
app.post('/api/boards/:id', saveBoardHandler);

app.delete('/api/boards/:id', (ctx) => {
  const info = db.prepare('delete from boards where id = ?').run(ctx.params.id);
  if (!info.changes) return notFound(ctx.res);
  json(ctx.res, 200, { ok: true });
});

// ---------- WebSocket: комнаты по board id ----------
// Клиент шлёт: {type:'cursor', name, x, y} | {type:'element:update', element} | {type:'element:delete', id}
// Сервер бродкастит всем остальным в комнате и держит счётчик участников.
const rooms = new Map(); // boardId -> Set<ws>

function roomOf(boardId) {
  if (!rooms.has(boardId)) rooms.set(boardId, new Set());
  return rooms.get(boardId);
}

function onConn(ws, url) {
  const boardId = url.searchParams.get('board') || '';
  const room = roomOf(boardId);
  room.add(ws);

  sendTo(ws, 'hello', { board: boardId, peers: room.size });
  broadcast(room, 'peers', { count: room.size });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg !== 'object' || !msg.type) return;

    if (msg.type === 'cursor') {
      const name = String(msg.name || '').slice(0, 32);
      const x = Number(msg.x), y = Number(msg.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const clientId = String(msg.clientId || '').slice(0, 64);
      broadcast(room, 'cursor', { name, x, y, clientId }, ws);
    } else if (msg.type === 'element:update') {
      const el = msg.element;
      if (!el || typeof el !== 'object' || typeof el.id !== 'string' || typeof el.type !== 'string') return;
      broadcast(room, 'element:update', { element: el }, ws);
    } else if (msg.type === 'element:delete') {
      if (typeof msg.id !== 'string') return;
      broadcast(room, 'element:delete', { id: msg.id }, ws);
    } else if (msg.type === 'ping') {
      sendTo(ws, 'pong', {});
    }
  });

  ws.on('close', () => {
    room.delete(ws);
    if (!room.size) rooms.delete(boardId);
    else broadcast(room, 'peers', { count: room.size });
  });
}

const PORT = process.env.PORT || 3013;
app.listen(PORT, (server) => setupWs(server, /^\/ws$/, onConn));
