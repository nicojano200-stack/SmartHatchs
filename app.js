'use strict';
/* SmartHatch prototype. All data is simulated in memory. Replace the tick() simulation with
   Firebase reads/writes (see README) when the real ESP32 incubator is ready. */
const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';

const PWR = s => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3v9"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/></svg>`;
const STAGE = { incubate: 'Incubation', hatch: 'Hatching', brood: 'Brooding', idle: 'Idle' };
const COLS = { readings: ['id', 'time', 'temp', 'hum', 'src', 'fan', 'heat'], power_events: ['id', 'time', 'type', 'detail', 'bat'], alerts: ['id', 'time', 'level', 'msg'], batches: ['id', 'start', 'eggs', 'hatched', 'rate'] };
const NAMES = { readings: 'sensor_readings', power_events: 'power_events', alerts: 'alerts', batches: 'batches' };
const TH = { tmax: 38.5, tmin: 36.5, blow: 20, push: true, sms: false };
const S = {
  on: false, busy: false, wifi: true, mains: true, bat: 100, tab: 'home', db: 'readings', user: 'Farmer', email: '',
  t: 27, h: 50, stage: 'idle', day: 0, batch: null, fan: true, heater: true, turner: true, uv: false, warm: false,
  sp: { incubate: [37.7, 55], hatch: [37.2, 70], brood: [35, 50], idle: [0, 0] },
  hist: [], last: 0, turnIn: 120, rid: 1, eid: 1, aid: 1, timer: null,
  data: { readings: [], power_events: [], alerts: [], batches: [] }
};
const sp = () => S.sp[S.stage];
const uvOk = () => S.mains && S.wifi && S.stage === 'idle';
const now = () => new Date().toTimeString().slice(0, 8);
const ago = () => { if (!S.last) return 'never'; const s = Math.round((Date.now() - S.last) / 1000); return s < 5 ? 'just now' : s < 60 ? s + ' sec ago' : Math.floor(s / 60) + ' min ago'; };
const chip = (t, c = '') => `<span class="chip ${c}">${t}</span>`;

function toast(m) { const t = $('toast'); t.textContent = m; t.classList.remove('off'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; clearTimeout(toast.k); toast.k = setTimeout(() => t.classList.add('off'), 2600); }
const log = (type, detail) => S.data.power_events.unshift({ id: 'E-' + (S.eid++), time: now(), type, detail, bat: Math.round(S.bat) + '%' });
function alertUp(level, msg) {
  S.data.alerts.unshift({ id: 'A-' + (S.aid++), time: now(), level, msg });
  const b = $('bc'); b.textContent = S.data.alerts.length; b.classList.remove('off');
  $('bell').animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-18deg)' }, { transform: 'rotate(16deg)' }, { transform: 'rotate(-10deg)' }, { transform: 'rotate(0)' }], { duration: 600 });
  toast('⚠ ' + msg);
}
function enter() {
  const m = $('main'); m.classList.remove('enter'); void m.offsetWidth;
  [...m.children].forEach((c, i) => c.style.animationDelay = i * .06 + 's');
  m.classList.add('enter'); clearTimeout(enter.t); enter.t = setTimeout(() => m.classList.remove('enter'), 1100);
}

/* ---------- Power: connect / disconnect ---------- */
async function power() {
  if (S.busy) return;
  if (S.on) { S.on = false; clearInterval(S.timer); toast('Disconnected from INC-001'); head(); render(); enter(); return; }
  S.busy = true; const c = $('conn'); c.classList.remove('off');
  const L = [...c.querySelectorAll('li')]; L.forEach(l => l.className = '');
  for (const l of L) { l.className = 'run'; await wait(850); l.className = 'ok'; }
  await wait(450); c.classList.add('off');
  S.on = true; S.wifi = true; S.last = Date.now(); S.busy = false;
  log('Connected', 'App linked to INC-001');
  S.timer = setInterval(tick, 2000); head(); render(); enter(); toast('Connected to INC-001');
}

/* ---------- Live simulation (replace with Firebase) ---------- */
function tick() {
  if (S.wifi) {
    S.last = Date.now();
    const [st, sh] = sp();
    if (S.stage === 'idle') { S.t += (27 - S.t) * .05; S.h += (50 - S.h) * .05; }
    else { S.t += (st - S.t) * (S.heater ? .2 : .02) + (Math.random() - .5) * .1; S.h += (sh - S.h) * .15 + (Math.random() - .5) * .5; if (Math.abs(S.t - st) < .4) S.warm = true; }
    S.bat = S.mains ? Math.min(100, S.bat + .4) : Math.max(0, S.bat - 1.2);
    if (!S.mains) S.uv = false;
    if (S.turner && S.stage === 'incubate') { S.turnIn -= 3; if (S.turnIn <= 0) { S.turnIn = 120; log('Egg turn', 'Automatic turn completed'); } }
    S.hist.push({ t: S.t, h: S.h }); if (S.hist.length > 40) S.hist.shift();
    S.data.readings.unshift({ id: 'R-' + (S.rid++), time: now(), temp: S.t.toFixed(1), hum: Math.round(S.h), src: S.mains ? 'Mains' : 'Battery', fan: S.fan ? 'ON' : 'OFF', heat: S.heater && S.stage !== 'idle' ? 'ON' : 'OFF', tgt: st });
    if (S.data.readings.length > 200) S.data.readings.pop();
    if (S.warm && S.stage !== 'idle' && (S.t > TH.tmax || S.t < TH.tmin)) { if (!S.tw) { S.tw = 1; alertUp('Warning', 'Temperature out of range: ' + S.t.toFixed(1) + ' °C'); } } else S.tw = 0;
    if (!S.mains && S.bat < TH.blow) { if (!S.bl) { S.bl = 1; alertUp('Critical', 'Battery below ' + TH.blow + '%'); } } else S.bl = 0;
  }
  head(); render(true);
}

/* ---------- Actions ---------- */
const offline = () => { if (!S.wifi) { toast('Offline. Cannot send command now'); return true; } };
function startBatch(n) {
  const id = 'B-' + String(S.data.batches.length + 1).padStart(3, '0');
  S.batch = { id, eggs: n }; S.day = 1; S.stage = 'incubate'; S.warm = false; S.turnIn = 120;
  S.data.batches.unshift({ id, start: new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' }), eggs: n, hatched: '—', rate: 'In progress' });
  log('Batch started', id + ' · ' + n + ' eggs'); toast('Batch ' + id + ' started. Heating to 37.7 °C'); render(); enter();
}
function advanceDay() {
  if (!S.batch) return toast('Start a batch first');
  if (S.day >= 21) return toast('Batch is ready. Record the hatch result');
  S.day++;
  if (S.day === 18) { S.stage = 'hatch'; S.warm = false; log('Lockdown', 'Day 18: switched to hatching mode'); toast('Day 18: hatching mode, humidity up to 70%'); } else toast('Day ' + S.day);
  render();
}
function finishBatch() {
  const el = $('hc'), n = +el.value, b = S.batch;
  if (!el.value || n < 0 || n > b.eggs) return toast('Enter chicks hatched (0 to ' + b.eggs + ')');
  const row = S.data.batches.find(r => r.id === b.id); row.hatched = n; row.rate = (n / b.eggs * 100).toFixed(1) + '%';
  S.batch = null; S.day = 0; S.stage = 'brood'; S.warm = false; log('Batch finished', b.id + ': ' + n + ' of ' + b.eggs + ' hatched'); toast('Saved. Brooding mode is on'); render(); enter();
}
function setStage(k) { if (offline()) return; S.stage = k; S.warm = false; if (k !== 'idle') S.uv = false; log('Stage changed', STAGE[k]); toast('Stage: ' + STAGE[k]); render(); }
function tog(k) { if (offline()) return; if (k === 'uv' && !uvOk()) return; S[k] = !S[k]; log(k.toUpperCase() + (S[k] ? ' on' : ' off'), 'Changed from app'); render(); }
function turnNow() { if (offline()) return; S.turnIn = 120; log('Manual turn', 'Command sent from app'); toast('Egg turner activated'); }
function outage() {
  S.mains = !S.mains;
  if (!S.mains) { log('Power outage', 'Switched to battery, UV disabled'); alertUp('Critical', 'Power outage. Running on battery ' + Math.round(S.bat) + '%'); }
  else { S.bl = 0; log('Power restored', 'Mains back, battery charging'); toast('Mains power restored'); }
  render();
}
function wifi() { S.wifi = !S.wifi; if (S.wifi) { S.last = Date.now(); log('Reconnected', 'Incubator back online, data synced'); toast('Incubator back online'); } else toast('Incubator offline. App shows last data'); head(); render(); }
function clearData() { S.data = { readings: [], power_events: [], alerts: [], batches: [] }; S.hist = []; S.batch = null; S.day = 0; S.stage = 'idle'; S.t = 27; S.h = 50; S.warm = false; $('bc').classList.add('off'); toast('All records cleared'); render(); }
function theme() { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark'; render(); }
function csv() {
  const k = S.db, cols = COLS[k], rows = S.data[k]; if (!rows.length) return toast('No records to export');
  const t = [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/csv' })); a.download = NAMES[k] + '.csv'; a.click(); toast('Exported ' + NAMES[k] + '.csv');
}

/* ---------- Views ---------- */
const lockView = () => `<div class="lock"><div class="ghost">${PWR(40)}</div><h2>Incubator is off</h2><p>Press the power button below to connect SmartHatch to your incubator. Your home, controls, database and reports appear once it is on.</p></div><div class="sk"></div><div class="sk s2"></div><div class="sk s3"></div>`;
const ring = (v, mn, mx, c, txt, l, tg) => { const f = Math.max(0, Math.min(1, (v - mn) / (mx - mn))); return `<div class="card tile"><svg viewBox="0 0 100 100" width="108" height="108" role="img" aria-label="${l} ${txt}"><circle cx="50" cy="50" r="38" fill="none" stroke="var(--line)" stroke-width="9"/><circle cx="50" cy="50" r="38" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(f * 238.8).toFixed(1)} 238.8" transform="rotate(-90 50 50)"/><text x="50" y="56" text-anchor="middle" font-size="19" font-weight="800" fill="var(--ink)" font-family="Manrope,system-ui">${txt}</text></svg><div style="font-weight:800;font-size:13px">${l}</div><div class="l">Target ${tg}</div></div>`; };
function chart() {
  const h = S.hist, n = h.length; if (n < 2) return '<p class="mut">Collecting data…</p>';
  const x = i => i * 300 / (n - 1), T = v => 76 - (Math.max(20, Math.min(40, v)) - 20) * 3.5, H = v => 76 - Math.max(0, Math.min(100, v)) * .74;
  const pl = (f, k, c) => `<polyline fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round" points="${h.map((p, i) => x(i).toFixed(1) + ',' + f(p[k]).toFixed(1)).join(' ')}"/>`;
  return `<svg viewBox="0 0 300 80" width="100%" height="96" role="img" aria-label="Temperature and humidity trend">${pl(T, 't', 'var(--heat)')}${pl(H, 'h', 'var(--acc)')}</svg><div class="leg"><span><i style="background:var(--heat)"></i>Temperature</span><span><i style="background:var(--acc)"></i>Humidity</span></div>`;
}
function home() {
  const [st, sh] = sp(); let hero;
  if (!S.batch) hero = `<div class="card hero"><div class="big" style="font-size:22px">No active batch</div><small>Load your eggs, then choose how many you set.</small><div class="seg">${[24, 36, 48].map(n => `<button onclick="startBatch(${n})">${n} eggs</button>`).join('')}</div></div>`;
  else hero = `<div class="card hero"><div class="row"><div><small>Batch ${S.batch.id} · ${S.batch.eggs} eggs</small><div class="big">Day ${S.day} <span>of 21</span></div></div>${chip(STAGE[S.stage], 'lt')}</div><div class="bar"><i style="width:${Math.round(S.day / 21 * 100)}%"></i></div>${S.day >= 21 ? `<div class="row" style="margin-top:12px"><input class="fld" id="hc" type="number" min="0" max="${S.batch.eggs}" placeholder="Chicks hatched"><button class="btn sm" style="background:#fff;color:#0f4a47" onclick="finishBatch()">Save result</button></div>` : `<small style="display:block;margin-top:8px">Hatching in ${21 - S.day} days · next egg turn in ${S.turnIn} min</small>`}</div>`;
  const tl = S.batch ? `<div class="card"><h3>21-day schedule</h3><div class="tl">${[[1, 'Set eggs'], [7, 'Candle'], [14, 'Candle'], [18, 'Lockdown'], [21, 'Hatch']].map(([d, n]) => `<div class="${S.day >= d ? 'done' : ''}"><i></i>${n}<small>Day ${d}</small></div>`).join('')}</div></div>` : '';
  const b = Math.round(S.bat);
  return `${S.wifi ? '' : `<div class="card" style="border-color:var(--bad)"><b style="color:var(--bad)">Incubator offline</b><p class="mut" style="font-size:12px;margin-top:4px">Showing last data from ${ago()}. The incubator keeps running on its own set points. Commands resume when it reconnects.</p></div>`}${hero}
<div class="grid">${ring(S.t, 20, 40, 'var(--heat)', S.t.toFixed(1) + '°', 'Temperature', st ? st + '°C' : '—')}${ring(S.h, 0, 100, 'var(--acc)', Math.round(S.h) + '%', 'Humidity', sh ? sh + '%' : '—')}</div>
<div class="card"><h3>Temperature and humidity</h3>${chart()}</div>${tl}
<div class="card"><h3>System status</h3>
<div class="row item"><span>Power source</span>${chip(S.mains ? 'Mains' : 'Battery', S.mains ? 'ok' : 'bad')}</div>
<div class="item"><div class="row"><span>Backup battery</span><b>${b}%</b></div><div class="batt"><i style="width:${b}%;background:${b < TH.blow ? 'var(--bad)' : 'var(--ok)'}"></i></div><p>${S.mains ? 'Charging from mains' : '~' + (S.bat / 100 * 8).toFixed(1) + ' h of backup left'}</p></div>
<div class="row item"><span>Ventilation fan</span>${chip(S.fan ? 'Running' : 'Off', S.fan ? 'ok' : '')}</div>
<div class="row item"><span>Egg turner</span>${chip(S.turner ? 'Auto' : 'Off', S.turner ? 'ok' : '')}</div>
<div class="row item"><span>UV disinfection</span>${chip(S.uv ? 'Active' : 'Standby', S.uv ? 'warn' : '')}</div>
<div class="row item"><span>Cloud database</span>${chip(S.wifi ? 'Synced · ' + ago() : 'Offline · ' + ago(), S.wifi ? 'ok' : 'bad')}</div></div>`;
}
function ctrl() {
  const [st, sh] = sp(), u = uvOk();
  return `<div class="card"><h3>Stage</h3><div class="seg">${Object.keys(STAGE).map(k => `<button class="${S.stage === k ? 'on' : ''}" onclick="setStage('${k}')">${STAGE[k]}</button>`).join('')}</div><p class="mut" style="font-size:12px;margin-top:10px">Incubation 37.7 °C / 55%, hatching 37.2 °C / 70%, brooding 35 °C / 50%.</p></div>
<div class="card"><h3>Set points</h3>
<div class="item"><div class="row"><span>Temperature</span><b>${st ? st.toFixed(1) + ' °C' : '—'}</b></div><input type="range" min="34" max="39" step=".1" value="${st || 37}" ${st ? '' : 'disabled'} aria-label="Temperature set point" oninput="S.sp[S.stage][0]=+this.value;this.previousElementSibling.lastElementChild.textContent=(+this.value).toFixed(1)+' °C'"></div>
<div class="item"><div class="row"><span>Humidity</span><b>${sh ? sh + '%' : '—'}</b></div><input type="range" min="40" max="80" step="1" value="${sh || 50}" ${sh ? '' : 'disabled'} aria-label="Humidity set point" oninput="S.sp[S.stage][1]=+this.value;this.previousElementSibling.lastElementChild.textContent=this.value+'%'"></div></div>
<div class="card"><h3>Devices</h3>${[['heater', 'Heater', 'Auto-regulated to the temperature set point'], ['fan', 'Ventilation fan', 'Air exchange and moisture control'], ['turner', 'Egg turner', 'Turns eggs automatically every 2 hours']].map(([k, n, d]) => `<div class="row item"><div><b>${n}</b><p>${d}</p></div><button class="sw ${S[k] ? 'on' : ''}" aria-label="${n}" onclick="tog('${k}')"></button></div>`).join('')}
<div class="row item"><div><b>UV disinfection</b><p>${u ? 'Chamber is idle and on mains. Safe to run.' : 'Locked: only when the chamber is idle and on mains power.'}</p></div><button class="sw ${S.uv ? 'on' : ''}" aria-label="UV disinfection" ${u ? '' : 'disabled'} onclick="tog('uv')"></button></div></div>
<button class="btn" onclick="turnNow()">Turn eggs now</button>`;
}
function db() {
  const k = S.db, rows = S.data[k], cols = COLS[k], total = Object.values(S.data).reduce((a, r) => a + r.length, 0);
  const cell = (c, r) => c === 'level' ? chip(r[c], r[c] === 'Critical' ? 'bad' : 'warn') : c === 'src' ? chip(r[c], r[c] === 'Mains' ? 'ok' : 'bad') : r[c];
  return `<div class="card"><div class="sync"><span class="dot ${S.wifi ? '' : 'r'}"></span><div><b>Cloud database · ${S.wifi ? 'Synced' : 'Offline'}</b><br><span class="mut" style="font-size:12px">Updated ${ago()} · ${total} records</span></div></div><p class="mut" style="font-size:12px;margin-top:10px">Path <span class="path">/incubators/INC-001/${NAMES[k]}</span></p></div>
<div class="seg" style="margin-bottom:12px">${Object.keys(COLS).map(a => `<button class="${k === a ? 'on' : ''}" onclick="S.db='${a}';render()">${{ readings: 'Sensors', power_events: 'Power', alerts: 'Alerts', batches: 'Batches' }[a]} (${S.data[a].length})</button>`).join('')}</div>
<div class="card" style="padding:6px"><div class="tw"><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.slice(0, 40).map(r => `<tr>${cols.map(c => `<td>${cell(c, r)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="mut">No records yet. They appear here as the incubator reports.</td></tr>`}</tbody></table></div></div>
<div class="card"><h3>Database structure</h3><div class="tree"><b>incubators / INC-001</b><br>├ <b>sensor_readings</b> temperature, humidity, source<br>├ <b>power_events</b> outage, restore, egg turns<br>├ <b>alerts</b> warning and critical<br>├ <b>batches</b> eggs, hatched, hatch rate<br>└ <b>settings</b> set points, stage, UV lock</div></div>
<button class="btn alt" onclick="csv()">Export ${NAMES[k]} as CSV</button>`;
}
function rep() {
  const R = S.data.readings.filter(r => r.tgt), inb = R.filter(r => Math.abs(r.temp - r.tgt) <= .5).length, stab = R.length ? Math.round(inb / R.length * 100) : null;
  const B = S.data.batches.filter(b => b.hatched !== '—'), hs = B.reduce((a, b) => a + b.hatched, 0), es = B.reduce((a, b) => a + b.eggs, 0), hr = es ? Math.round(hs / es * 100) : null;
  const out = S.data.power_events.filter(e => e.type === 'Power outage').length;
  const m = (l, v, p, n) => `<div class="item"><div class="row"><b>${l}</b><span>${v}</span></div><div class="meter"><i style="width:${p || 0}%"></i></div><p>${n}</p></div>`;
  return `<div class="card"><h3>Performance criteria</h3>
${m('Temperature stability', stab == null ? 'No data' : stab + '%', stab, 'Readings within ±0.5 °C of the set point')}
${m('Hatch rate', hr == null ? 'No result' : hr + '%', hr, B.length ? B.length + ' finished batch(es)' : 'Finish a batch to record the result')}
${m('Power failures handled', String(out), Math.min(100, out * 20), 'Outages covered by the backup battery')}
${m('Remote connection', S.wifi ? 'Online' : 'Offline', S.wifi ? 100 : 0, 'App-to-incubator link through the cloud database')}</div>
<div class="card"><h3>Hatch rate per batch</h3>${B.length ? [...B].reverse().map(b => { const p = b.hatched / b.eggs * 100; return `<div class="item"><div class="row"><b>${b.id}</b><span>${p.toFixed(1)}% · ${b.hatched} of ${b.eggs}</span></div><div class="meter"><i style="width:${p}%;background:var(--heat)"></i></div></div>`; }).join('') : '<p class="mut">No finished batches yet.</p>'}</div>
<div class="card"><h3>Farmer acceptance and ease of use</h3><p class="mut">No survey responses yet. Results from small-scale farmers will appear here.</p></div>`;
}
function settings() {
  const dark = document.documentElement.dataset.theme === 'dark';
  return `<div class="card"><div class="row"><div><b>${S.user}</b><p class="mut" style="font-size:12px">${S.email || 'farmer@smarthatch.app'}</p></div>${chip('Owner', 'ok')}</div></div>
<div class="card"><div class="row"><b>Dark mode</b><button class="sw ${dark ? 'on' : ''}" aria-label="Dark mode" onclick="theme()"></button></div></div>
<div class="card"><h3>Alert limits</h3>${[['tmax', 'High temperature', '°C', 37.8, 40, .1], ['tmin', 'Low temperature', '°C', 34, 37.5, .1], ['blow', 'Low battery', '%', 10, 50, 1]].map(([k, n, u, a, b, s]) => `<div class="item"><div class="row"><span>${n}</span><b id="v_${k}">${TH[k]}${u}</b></div><input type="range" min="${a}" max="${b}" step="${s}" value="${TH[k]}" aria-label="${n}" oninput="TH['${k}']=+this.value;$('v_${k}').textContent=this.value+'${u}'"></div>`).join('')}</div>
<div class="card"><h3>Notifications</h3>${[['push', 'Push notifications', 'Alerts on your phone, even when the app is closed'], ['sms', 'SMS backup', 'Text alert when Wi-Fi is lost (needs a GSM module)']].map(([k, n, d]) => `<div class="row item"><div><b>${n}</b><p>${d}</p></div><button class="sw ${TH[k] ? 'on' : ''}" aria-label="${n}" onclick="TH['${k}']=!TH['${k}'];render()"></button></div>`).join('')}</div>
${S.on ? `<div class="card"><h3>Demo tools</h3><div class="seg"><button onclick="outage()">${S.mains ? 'Simulate outage' : 'Restore mains'}</button><button onclick="wifi()">${S.wifi ? 'Drop Wi-Fi' : 'Reconnect Wi-Fi'}</button><button onclick="advanceDay()">Next day</button><button onclick="clearData()">Clear data</button></div></div>` : `<div class="card"><p class="mut">Demo tools appear when the incubator is on.</p></div>`}
<button class="btn red" onclick="logout()">Log out</button>`;
}
const VIEW = { home, ctrl, db, rep, set: settings };

/* ---------- Render ---------- */
function head() {
  $('sub').innerHTML = !S.on ? '<span class="d"></span>Incubator off' : S.wifi ? '<span class="d g"></span>Online · ' + ago() : '<span class="d r"></span>Offline · last seen ' + ago();
  document.querySelectorAll('#nav [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === S.tab));
  $('pbtn').classList.toggle('on', S.on); $('hint').classList.toggle('off', S.on);
}
function render(live) {
  head(); if (live && (S.tab === 'ctrl' || S.tab === 'set')) return;
  const m = $('main'), y = m.scrollTop;
  m.innerHTML = (!S.on && S.tab !== 'set') ? lockView() : VIEW[S.tab]();
  m.scrollTop = y;
}
function go(k) {
  S.tab = k; $('main').scrollTop = 0; render(); enter();
  const s = $('nav').querySelector('.on span'); if (s) s.animate([{ transform: 'scale(.6)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 380 });
}
$('nav').innerHTML = `<button data-t="home" onclick="go('home')"><span>🏠</span>Home</button><button data-t="ctrl" onclick="go('ctrl')"><span>🎛️</span>Control</button><div class="fabw"><div class="hint" id="hint">Tap to connect</div><button class="fab" id="pbtn" onclick="power()" aria-label="Power: connect or disconnect the incubator">${PWR(26)}</button></div><button data-t="db" onclick="go('db')"><span>🗄️</span>Database</button><button data-t="rep" onclick="go('rep')"><span>📊</span>Reports</button>`;
$('bell').onclick = () => { S.db = 'alerts'; go('db'); };
$('av').onclick = () => go('set');

/* ---------- Intro, login, ready ---------- */
let MODE = 'in';
const show = id => ['splash', 'login', 'ready'].forEach(i => $(i).classList.toggle('off', i !== id));
function lmode(m) {
  MODE = m; const up = m === 'up', fg = m === 'fg';
  [...$('tabsL').children].forEach((b, i) => b.classList.toggle('on', (i === 0 && !up) || (i === 1 && up)));
  $('nm2').classList.toggle('off', !up); $('pw').classList.toggle('off', fg); $('fp').classList.toggle('off', fg || up);
  $('mainB').textContent = fg ? 'Send reset link' : up ? 'Create account' : 'Login';
  $('lt').textContent = up ? 'Create account' : fg ? 'Reset password' : 'Welcome Back';
  $('ls').textContent = up ? 'Start monitoring your eggs' : fg ? 'We will email you a reset link' : 'Login to monitor your incubator'; $('er').textContent = '';
}
function doAuth() {
  const e = $('em').value.trim(), p = $('pw').value, er = $('er');
  if (!/^\S+@\S+\.\S+$/.test(e)) return er.textContent = 'Enter a valid email address';
  if (MODE === 'fg') { toast('Reset link sent to ' + e); return lmode('in'); }
  if (p.length < 6) return er.textContent = 'Password must be at least 6 characters';
  S.email = e; S.user = (MODE === 'up' && $('nm2').value.trim()) || e.split('@')[0]; ready();
}
function social(n) { toast('Connecting to ' + n + '…'); setTimeout(() => { S.user = 'Farmer'; ready(); }, 900); }
function ready() { $('gu').textContent = 'Hi, ' + S.user.split(' ')[0] + '. Your incubator is waiting.'; show('ready'); }
function logout() { if (S.on) { S.on = false; clearInterval(S.timer); } S.tab = 'home'; lmode('in'); $('pw').value = ''; head(); render(); show('login'); stagger(); }
function stagger() { [...$('login').children].forEach((c, i) => c.style.animationDelay = i * .06 + 's'); }
$('goBtn').onclick = () => { const g = $('ready'); g.classList.add('leave'); setTimeout(enter, 200); setTimeout(() => { g.classList.add('off'); g.classList.remove('leave'); }, 600); };

(function intro() {
  const n = 'SmartHatch', el = $('nm'); let i = 0;
  setTimeout(() => { const k = setInterval(() => { el.textContent = n.slice(0, ++i); if (i === n.length) { clearInterval(k); el.classList.remove('car'); $('tg').style.opacity = .85; } }, 110); }, 650);
  setTimeout(() => { show('login'); stagger(); }, 3200);
})();
head(); render();
