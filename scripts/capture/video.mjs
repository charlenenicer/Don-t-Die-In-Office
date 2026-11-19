// Gameplay video. Playwright's fake clock drives timers and performance.now; the game's
// animate() runs exactly once per captured frame, so every frame is 1/30 s of game time.
import { chromium } from '/workspace/interview-rpg/node_modules/playwright/index.mjs';
import { mkdirSync, rmSync } from 'node:fs';
const DRY = process.env.DRY === '1';
const [W, H] = DRY ? [480, 270] : [1280, 720];
const frames = '/tmp/frames-video';
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push(String(e)));
await p.clock.install();
await p.goto('http://localhost:43123/?debug');
for (let i = 0; i < 300; i++) { await p.clock.runFor(200); if (await p.evaluate(() => !!window.__openPlan)) break; await new Promise(r => setTimeout(r, 100)); }
const g = (fn, a) => p.evaluate(fn, a);
await g(() => {
  const o = window.__openPlan;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { if (cb === o.animate) { window.__pending = cb; return 1; } return orig(cb); };
  window.__lines = []; window.addEventListener('transcript', (e) => window.__lines.push(e.detail.text));
});
{ const now = await g(() => Date.now()); await p.clock.pauseAt(now + 50); }
await p.clock.runFor(100);
const step = () => g(() => { const f = window.__pending; window.__pending = null; f && f(performance.now()); });
let n = 0, tick = 0;
const log = [];
const frame = async () => {
  await p.clock.runFor(tick++ % 3 === 2 ? 34 : 33);
  await step();
  if (!DRY) await p.screenshot({ path: `${frames}/f${String(n).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90, timeout: 120000 });
  n++;
};
const state = () => g(() => { const o = window.__openPlan; const v = o.getPlayerPosition(); return { x: +v.x.toFixed(2), z: +v.z.toFixed(2), room: o.playerRoom?.id ?? null, near: o.getNearbyCharacter()?.id ?? null, call: o.getVoiceClient().isActive(), lines: window.__lines.length, choice: !!o.getEngine().getState().activeChoice }; });
const mark = async (label) => { const s = await state(); const l = { f: n, t: +(n / 30).toFixed(1), label, ...s }; log.push(l); console.log(JSON.stringify(l)); };
const held = new Set();
const setKeys = async (want) => {
  for (const k of [...held]) if (!want.includes(k)) { await p.keyboard.up(k); held.delete(k); }
  for (const k of want) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); }
};
await g(() => {
  const o = window.__openPlan, S = 0.25, N = 200, off = 25;
  const free = (x, z) => o.isFree(x, z) && o.isFree(x + 0.2, z) && o.isFree(x - 0.2, z) && o.isFree(x, z + 0.2) && o.isFree(x, z - 0.2);
  window.__clear = (x0, z0, x1, z1) => { const d = Math.hypot(x1 - x0, z1 - z0); for (let t = 0; t <= d; t += 0.15) { const k = d ? t / d : 0; if (!free(x0 + (x1 - x0) * k, z0 + (z1 - z0) * k)) return false; } return true; };
  window.__path = (sx, sz, tx, tz) => {
    const id = (i, j) => i * N + j, ci = (x) => Math.round((x + off) / S);
    const prev = new Int32Array(N * N).fill(-1); const q = [id(ci(sx), ci(sz))]; prev[q[0]] = q[0];
    const goal = id(ci(tx), ci(tz));
    for (let h = 0; h < q.length; h++) { const c = q[h]; if (c === goal) break; const i = (c / N) | 0, j = c % N;
      for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const k = id(ni, nj); if (prev[k] !== -1) continue; if (k !== goal && !free(ni * S - off, nj * S - off)) continue; prev[k] = c; q.push(k); } }
    if (prev[goal] === -1) return null;
    const pts = []; for (let c = goal; ; c = prev[c]) { pts.push([((c / N) | 0) * S - off, (c % N) * S - off]); if (prev[c] === c) break; }
    return pts.reverse();
  };
});
const goto = async (tx, tz, max = 600, tol = 0.3) => {
  const start = await g(() => { const v = window.__openPlan.getPlayerPosition(); return [v.x, v.z]; });
  const path = await g(([a, b, c, d]) => window.__path(a, b, c, d), [start[0], start[1], tx, tz]);
  if (!path) { console.log('no path', start, tx, tz); return; }
  path.push([tx, tz]);
  let idx = 0; const hist = [];
  for (let i = 0; i < max; i++) {
    const [x, z] = await g(() => { const v = window.__openPlan.getPlayerPosition(); return [v.x, v.z]; });
    if (Math.hypot(tx - x, tz - z) < tol) break;
    while (idx < path.length - 1 && Math.hypot(path[idx][0] - x, path[idx][1] - z) < 0.6) idx++;
    let tgt = idx;
    for (let k = idx; k < path.length && Math.hypot(path[k][0] - x, path[k][1] - z) < 3; k++) if (await g(([a, b, c, d]) => window.__clear(a, b, c, d), [x, z, path[k][0], path[k][1]])) tgt = k;
    const [px, pz] = path[tgt];
    const ang = Math.atan2(pz - z, px - x); const oct = Math.round(ang / (Math.PI / 4));
    const dirs = { 0: ['d'], 1: ['d', 's'], 2: ['s'], 3: ['a', 's'], 4: ['a'], '-4': ['a'], '-3': ['a', 'w'], '-2': ['w'], '-1': ['d', 'w'] };
    const near = Math.hypot(tx - x, tz - z) < 0.8 && tgt === path.length - 1;
    const keys = near ? [...(Math.abs(tx - x) > tol * 0.6 ? [tx > x ? 'd' : 'a'] : []), ...(Math.abs(tz - z) > tol * 0.6 ? [tz > z ? 's' : 'w'] : [])] : dirs[oct];
    await setKeys(keys); await frame();
    hist.push([x, z]); if (hist.length > 30 && Math.hypot(hist.at(-1)[0] - hist.at(-30)[0], hist.at(-1)[1] - hist.at(-30)[1]) < 0.1) { console.log('stuck', x.toFixed(2), z.toFixed(2), '->', tx, tz); break; }
  }
  await setKeys([]);
};
const idle = async (k) => { for (let i = 0; i < k; i++) await frame(); };
const until = async (cond, max, arg) => { for (let i = 0; i < max; i++) { await frame(); if (await g(cond, arg)) return true; } return false; };

// start at the front, by reception
await g(() => { const o = window.__openPlan; o.playerPosition.set(-6, 0, 21.5); o.player.rotation.y = Math.PI; o.reducedMotion = true; });
await p.clock.runFor(33); await step(); await p.clock.runFor(33); await step();
await g(() => { window.__openPlan.reducedMotion = false; });
await mark('start');
await idle(50);                     await mark('idle at reception');
await goto(-6, 6.5);                await mark('past reception into the open office');
await goto(7, 6.5);                 await mark('along the desks');
await idle(14);                     await mark('pause (idle pose)');
await goto(7, -8.5);                await mark('up the east aisle');
await goto(0.3, -9.5);              await mark('to the manager door');
await goto(0.3, -14.5);             await mark('through the door, room revealed');
await goto(2.3, -16.85, 600, 0.15);             await mark('up to Brad');
await idle(15);                     await mark('beside Brad');
await p.keyboard.press('e');        await frame(); await mark('E: talk to Brad');
await until(() => !!window.__openPlan.getEngine().getState().activeChoice, 300); await mark('offer card');
await until(() => window.__lines.length >= 2, 300); await mark('closing line');
await until(() => !window.__openPlan.getVoiceClient().isActive(), 300); await mark('call ended by Brad');
await idle(45);
try { await p.click('.decline-button', { timeout: 3000 }); } catch { await g(() => window.__openPlan.getEngine().declineChoice()); console.log('declined via engine'); }
await frame(); await mark('declined');
await idle(10);
await goto(0.3, -14.5);             await goto(0.3, -9); await mark('back out of the room');
await goto(7, -8.5);                await goto(7, 3.4); await mark('down the aisle');
await goto(3.4, 3.4);               await mark('up to Marcus');
await idle(10);                     await mark('beside Marcus');
const before = await g(() => window.__lines.length);
await p.keyboard.press('e');        await frame(); await mark('E: talk to Marcus');
await until((b) => window.__lines.length > b, 300, before); await idle(45); await mark('his opener');
await goto(7, 3.4);                 await goto(7, 6.6); await mark('walking away');
await goto(1, 7.2);                 await mark('walked away');
await until(() => !window.__openPlan.getVoiceClient().isActive(), 300); await mark('call ended on walk-away');
await idle(75);                     await mark('end');
console.log(JSON.stringify({ frames: n, seconds: +(n / 30).toFixed(1), errs, lines: await g(() => window.__lines) }));

await b.close();
