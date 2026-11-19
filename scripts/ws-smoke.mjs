// WS-самотест: два клиента в комнате доски demo.
// client1 шлёт element:update и cursor — client2 должен их получить.
import WebSocket from 'ws';

const BOARD = process.argv[2] || 'demo';
const URL = `ws://127.0.0.1:${process.env.PORT || 3013}/ws?board=${BOARD}`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const messages = [];
    ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
    ws.on('open', () => resolve({ ws, messages, label }));
    ws.on('error', reject);
  });
}

const results = { hello: 0, peers: 0, elementUpdate: 0, cursor: 0 };
let failures = 0;

const c1 = await connect('client1');
const c2 = await connect('client2');
await wait(300);

results.hello = [c1, c2].filter((c) => c.messages.some((m) => m.type === 'hello')).length;
results.peers = c2.messages.some((m) => m.type === 'peers' && m.count >= 2) ? 1 : 0;

c1.ws.send(JSON.stringify({
  type: 'element:update',
  element: { id: 'smoke-el-1', type: 'rect', x: 10, y: 10, w: 50, h: 30, strokeColor: '#1e1e1e', fillColor: null, strokeWidth: 2, seed: 1 },
}));
c1.ws.send(JSON.stringify({ type: 'cursor', name: 'Тест', x: 100, y: 200, clientId: 'smoke-1' }));
await wait(500);

results.elementUpdate = c2.messages.some((m) => m.type === 'element:update' && m.element && m.element.id === 'smoke-el-1') ? 1 : 0;
results.cursor = c2.messages.some((m) => m.type === 'cursor' && m.name === 'Тест' && m.x === 100) ? 1 : 0;

// client1 не должен получать собственные сообщения
const echo = c1.messages.filter((m) => m.type === 'element:update' || m.type === 'cursor').length;
if (echo !== 0) { results.echo = echo; failures++; }

c1.ws.close();
c2.ws.close();
await wait(200);

const checks = [
  ['hello обоим клиентам', results.hello === 2],
  ['счётчик участников (peers.count >= 2)', results.peers === 1],
  ['element:update дошёл до client2', results.elementUpdate === 1],
  ['cursor дошёл до client2', results.cursor === 1],
  ['нет эха собственных сообщений', failures === 0],
];

console.log('WS-smoke, доска:', BOARD);
let ok = true;
for (const [name, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!passed) ok = false;
}
process.exit(ok ? 0 : 1);
