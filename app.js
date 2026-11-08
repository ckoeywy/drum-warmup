/* Drum Warm-Up — player + metronome
 * Vanilla JS, Web Audio API. No build step.
 *
 * Playback model (parts 01/02/03 = "sticking" parts):
 *   The part is a list of UNITS (part.lines). Two practice modes:
 *     - 'loop' : repeat the current unit forever; tap 下一個 to move on.
 *     - 'reps' : play each unit REPS times, then auto-advance to the next,
 *                finishing the part after the last unit.
 *   Part 04 ("image") keeps its own timed segment map (65 then 85 BPM).
 */
(() => {
  'use strict';

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const exEl = $('exercise');
  const partTabs = $('partTabs');
  const beatDots = $('beatDots');
  const tempoPresets = $('tempoPresets');

  // ---------- Constants ----------
  const STEPS_PER_BAR = 16;
  const REPS = 3;                // "每個 ×3"
  const LOOKAHEAD = 25;          // ms
  const SCHEDULE_AHEAD = 0.12;   // s

  // ---------- State ----------
  let audio = null;
  let partIdx = 0;
  let currentPage = 0;
  let bpm = PARTS[0].defaultBpm;
  let playing = false;
  let playMode = 'reps';         // 'loop' | 'reps' (persists across parts)

  // playback pointers
  let unitIdx = 0;               // sticking: which line/bar
  let repInUnit = 0;             // how many times current unit has played
  let segIdx = 0, barInSeg = 0;  // image part
  let stepInBar = 0;             // 0..15
  let countInLeft = 0;

  let nextNoteTime = 0;
  let timer = null;
  let lastLine = -1;

  const done = new Set();

  let subPerBeat = 1;            // clicks per beat: 1=4分(四拍), 2=8分, 4=16分

  const opts = {
    autoNext: () => $('autoNext').checked,
    countIn: () => $('countIn').checked,
  };

  // Click the metronome for a given position in the bar (0..15), applying
  // the chosen subdivision: accent on the downbeat, a beat click on the other
  // main beats, and a soft tick on the in-between subdivisions.
  function playClick(time, pos) {
    const inBeat = pos % 4;
    if (inBeat === 0) { click(time, pos === 0 ? 'accent' : 'beat'); return; }
    if (subPerBeat === 4) { click(time, 'sub'); return; }
    if (subPerBeat === 2 && inBeat === 2) { click(time, 'sub'); return; }
  }

  const isImage = () => PARTS[partIdx].mode === 'image';

  function resetPlayState() {
    unitIdx = 0; repInUnit = 0; segIdx = 0; barInSeg = 0; stepInBar = 0; lastLine = -1;
  }

  // ---------- Rendering ----------
  function renderTabs() {
    partTabs.innerHTML = '';
    PARTS.forEach((p, i) => {
      const t = document.createElement('button');
      t.className = 'part-tab' + (i === partIdx ? ' active' : '') + (done.has(p.id) ? ' done' : '');
      t.innerHTML = `<span class="t-num">${p.index}</span><span>${p.en}</span>`;
      t.onclick = () => selectPart(i);
      partTabs.appendChild(t);
    });
  }

  function renderPresets() {
    tempoPresets.innerHTML = '';
    TEMPO_PRESETS.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'preset' + (t === bpm ? ' active' : '');
      b.textContent = t;
      b.onclick = () => setBpm(t);
      tempoPresets.appendChild(b);
    });
  }

  // Draw one 4/4 bar of 16 beamed sixteenth notes as SVG drum notation.
  function renderStave(line) {
    const margin = 22, sp = 34, gap = 26;
    const headY = 70, beamY = 24, beam2 = 33, accentY = 13, letterY = 102, H = 114;
    const xOf = (i) => {
      const b = Math.floor(i / 4), p = i % 4;
      return margin + b * (3 * sp + gap) + p * sp;
    };
    const W = xOf(15) + margin;
    const p = [];
    p.push(`<line class="staff" x1="${margin - 12}" y1="${headY}" x2="${W - margin + 12}" y2="${headY}"/>`);
    p.push(`<line class="bar" x1="${margin - 12}" y1="${headY - 42}" x2="${margin - 12}" y2="${headY + 8}"/>`);
    p.push(`<line class="bar" x1="${W - margin + 12}" y1="${headY - 42}" x2="${W - margin + 12}" y2="${headY + 8}"/>`);
    for (let g = 0; g < 4; g++) {
      const x1 = xOf(g * 4) + 6.6, x2 = xOf(g * 4 + 3) + 6.6;
      p.push(`<rect class="beam" x="${x1}" y="${beamY}" width="${x2 - x1}" height="4.2"/>`);
      p.push(`<rect class="beam" x="${x1}" y="${beam2}" width="${x2 - x1}" height="4.2"/>`);
    }
    for (let i = 0; i < 16; i++) {
      const x = xOf(i), acc = line.hl[i] === 'A';
      let g = `<g class="n${acc ? ' acc' : ''}" data-i="${i}">`;
      g += `<circle class="halo" cx="${x}" cy="${headY}" r="15"/>`;
      if (acc) g += `<text class="accent" x="${x}" y="${accentY}">&gt;</text>`;
      g += `<ellipse class="nh" cx="${x}" cy="${headY}" rx="7.3" ry="5.3" transform="rotate(-18 ${x} ${headY})"/>`;
      g += `<line class="stem" x1="${x + 6.6}" y1="${headY - 2}" x2="${x + 6.6}" y2="${beamY}"/>`;
      g += `<text class="lt" x="${x}" y="${letterY}">${line.sticking[i]}</text>`;
      g += `</g>`;
      p.push(g);
    }
    return `<svg class="stave" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${p.join('')}</svg>`;
  }

  function getPages(part) {
    if (part.pages && part.pages.length) return part.pages;
    return [part.lines.map((_, i) => i)];
  }

  function renderPart() {
    const part = PARTS[partIdx];
    $('partNum').textContent = part.index;
    $('partEn').textContent = part.en;
    $('partZh').textContent = part.zh;
    $('partHint').textContent = part.hint || '';
    currentPage = 0;
    renderExercise();
    buildBeatDots();
    updateModeUI();
    idleDisplay();
  }

  function renderExercise() {
    const part = PARTS[partIdx];
    exEl.className = 'exercise ' + (part.mode === 'image' ? 'image' : (part.layout || 'rows'));
    exEl.innerHTML = '';
    lastLine = -1;

    if (part.mode === 'image') {
      $('pager').style.display = 'none';
      const wrap = document.createElement('div');
      wrap.style.width = '100%';
      wrap.style.textAlign = 'center';
      wrap.innerHTML =
        `<div class="coord-img"><img src="${part.image}" alt="coordination score" /></div>` +
        `<div class="coord-seg" id="coordSeg"></div>`;
      exEl.appendChild(wrap);
      return;
    }

    const pages = getPages(part);
    const idxs = pages[currentPage];
    idxs.forEach((li) => {
      const ln = part.lines[li];
      const d = document.createElement('div');
      d.className = 'line';
      d.dataset.line = li;
      d.innerHTML = `<div class="line-label">${ln.label}</div>` + renderStave(ln);
      exEl.appendChild(d);
    });
    renderPager(pages);
  }

  function renderPager(pages) {
    const pager = $('pager');
    if (!pages || pages.length <= 1) { pager.innerHTML = ''; pager.style.display = 'none'; return; }
    pager.style.display = 'flex';
    let h = `<button class="pg-arrow" data-d="-1">‹</button>`;
    pages.forEach((a, i) => {
      const label = `${a[0] + 1}–${a[a.length - 1] + 1}`;
      h += `<button class="pg-dot${i === currentPage ? ' active' : ''}" data-p="${i}">${label}</button>`;
    });
    h += `<button class="pg-arrow" data-d="1">›</button>`;
    pager.innerHTML = h;
    pager.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => gotoPage(+b.dataset.p));
    pager.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => gotoPage(currentPage + (+b.dataset.d)));
  }

  function gotoPage(p) {
    const pages = getPages(PARTS[partIdx]);
    const np = Math.min(pages.length - 1, Math.max(0, p));
    if (np === currentPage) return;
    currentPage = np;
    renderExercise();
    if (!playing) highlightUnit(PARTS[partIdx], unitIdx, -1);
  }

  function buildBeatDots() {
    beatDots.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('div');
      d.className = 'dot' + (i === 0 ? ' accent' : '');
      beatDots.appendChild(d);
    }
  }

  // ---------- Highlight ----------
  function highlightUnit(part, unit, within) {
    if (part.mode === 'image') return;
    if (unit !== lastLine) {
      const pages = getPages(part);
      const pg = pages.findIndex((a) => a.includes(unit));
      if (pg !== -1 && pg !== currentPage) { currentPage = pg; renderExercise(); }
      exEl.querySelectorAll('.line').forEach((el) => {
        const on = +el.dataset.line === unit;
        el.classList.toggle('active', on);
        if (!on) el.querySelectorAll('g.n.now').forEach((n) => n.classList.remove('now'));
      });
      lastLine = unit;
      const act = exEl.querySelector(`.line[data-line="${unit}"]`);
      if (act) act.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const active = exEl.querySelector(`.line[data-line="${unit}"]`);
    if (active) {
      active.querySelectorAll('g.n.now').forEach((n) => n.classList.remove('now'));
      const note = active.querySelector(`g.n[data-i="${within}"]`);
      if (note) note.classList.add('now');
    }
  }

  function paintStep(snap) {
    const part = PARTS[partIdx];
    const beat = Math.floor(snap.within / 4);
    [...beatDots.children].forEach((d, i) => d.classList.toggle('on', i === beat));

    if (snap.image) {
      const seg = part.segments[snap.segIdx];
      const el = $('coordSeg');
      if (el) el.innerHTML = `<b>${seg ? seg.label : ''}</b>`;
      readoutImage(snap.segIdx, snap.barInSeg);
      return;
    }
    highlightUnit(part, snap.unitIdx, snap.within);
    readoutSticking(snap.unitIdx, snap.repInUnit);
  }

  function unitWord() { return PARTS[partIdx].id === 'singles' ? '行' : '小節'; }

  function readoutSticking(u, rep) {
    const total = PARTS[partIdx].lines.length;
    const w = unitWord();
    if (playMode === 'loop') {
      $('repReadout').innerHTML = `循環 · ${w} <b>${u + 1}</b>/${total} · 第 <b>${rep + 1}</b> 次`;
    } else {
      $('repReadout').innerHTML = `${w} <b>${u + 1}</b>/${total} · <b>${rep + 1}</b>/${REPS} 次`;
    }
  }

  function readoutImage(sg, bis) {
    const segs = PARTS[partIdx].segments;
    const totalBars = segs.reduce((s, x) => s + x.bars, 0);
    let before = 0; for (let i = 0; i < sg; i++) before += segs[i].bars;
    $('repReadout').innerHTML = `小節 <b>${before + bis + 1}</b> / ${totalBars}`;
  }

  function idleDisplay() {
    const part = PARTS[partIdx];
    if (part.mode === 'image') { readoutImage(0, 0); return; }
    highlightUnit(part, unitIdx, -1);
    readoutSticking(unitIdx, repInUnit);
  }

  // ---------- Audio ----------
  function ensureAudio() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  }

  function click(time, kind) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.connect(g); g.connect(audio.destination);
    let freq = 1000, peak = 0.5, dur = 0.04;
    if (kind === 'accent') { freq = 1600; peak = 0.8; dur = 0.05; }
    else if (kind === 'sub') { freq = 760; peak = 0.16; dur = 0.025; }
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  function curBpm() {
    const part = PARTS[partIdx];
    if (part.mode === 'image') { const s = part.segments[segIdx]; return s ? s.bpm : bpm; }
    return bpm;
  }
  function sixteenthDur(theBpm) { return 15.0 / theBpm; }

  // Advance pointers one bar. Returns false if the part finished.
  function advanceBar() {
    const part = PARTS[partIdx];
    if (part.mode === 'image') {
      barInSeg++;
      if (barInSeg >= part.segments[segIdx].bars) {
        barInSeg = 0; segIdx++;
        if (segIdx >= part.segments.length) { finishPart(); return false; }
      }
      return true;
    }
    repInUnit++;
    if (playMode === 'loop') return true;        // stay on this unit
    if (repInUnit >= REPS) {                       // reps mode: move on
      repInUnit = 0; unitIdx++;
      if (unitIdx >= part.lines.length) { finishPart(); return false; }
    }
    return true;
  }

  function scheduler() {
    while (nextNoteTime < audio.currentTime + SCHEDULE_AHEAD) {
      if (countInLeft > 0) {
        const idx = STEPS_PER_BAR - countInLeft;
        playClick(nextNoteTime, idx);
        const dur = sixteenthDur(curBpm());
        schedulePaintCountIn(nextNoteTime, idx);
        nextNoteTime += dur;
        countInLeft--;
        continue;
      }

      playClick(nextNoteTime, stepInBar);

      const snap = isImage()
        ? { image: true, segIdx, barInSeg, within: stepInBar }
        : { image: false, unitIdx, repInUnit, within: stepInBar };
      schedulePaint(nextNoteTime, snap);

      nextNoteTime += sixteenthDur(curBpm());
      stepInBar++;
      if (stepInBar >= STEPS_PER_BAR) {
        stepInBar = 0;
        if (!advanceBar()) return;
      }
    }
  }

  function schedulePaint(when, snap) {
    const delay = Math.max(0, (when - audio.currentTime) * 1000);
    setTimeout(() => { if (playing) paintStep(snap); }, delay);
  }
  function schedulePaintCountIn(when, idx) {
    const delay = Math.max(0, (when - audio.currentTime) * 1000);
    setTimeout(() => {
      if (!playing) return;
      const beat = Math.floor(idx / 4);
      [...beatDots.children].forEach((d, i) => d.classList.toggle('on', i === beat));
      $('repReadout').innerHTML = `預備… <b>${4 - beat}</b>`;
    }, delay);
  }

  // ---------- Transport ----------
  function start() {
    ensureAudio();
    if (playing) return;
    playing = true;
    $('playBtn').textContent = '❚❚';
    $('playBtn').classList.add('on');
    lastLine = -1;
    nextNoteTime = audio.currentTime + 0.1;
    // count-in only when starting at a bar boundary (not when resuming mid-bar)
    countInLeft = (opts.countIn() && stepInBar === 0) ? STEPS_PER_BAR : 0;
    timer = setInterval(scheduler, LOOKAHEAD);
    requestWakeLock();
  }

  function pause() {
    playing = false;
    $('playBtn').textContent = '▶';
    $('playBtn').classList.remove('on');
    clearInterval(timer);
    releaseWakeLock();
  }

  function stop() {
    pause();
    resetPlayState();
    renderPart();
  }

  function finishPart() {
    pause();
    const part = PARTS[partIdx];
    done.add(part.id);
    resetPlayState();
    renderTabs();
    if (opts.autoNext() && partIdx < PARTS.length - 1) {
      selectPart(partIdx + 1);
      setTimeout(start, 500);
    } else {
      renderPart();
      $('repReadout').innerHTML = partIdx === PARTS.length - 1
        ? '<b>全部完成 ✓</b>' : '<b>完成 ✓</b>';
    }
  }

  function togglePlay() { playing ? pause() : start(); }

  // advance the looped/active unit by hand (下一個)
  function nextUnit(dir = 1) {
    const part = PARTS[partIdx];
    if (part.mode === 'image') { selectPart(Math.min(PARTS.length - 1, partIdx + (dir > 0 ? 1 : -1))); return; }
    const n = part.lines.length;
    unitIdx = (unitIdx + dir + n) % n;
    repInUnit = 0;
    stepInBar = 0;
    if (!playing) idleDisplay();
  }

  function selectPart(i) {
    pause();
    partIdx = i;
    bpm = PARTS[i].defaultBpm;
    resetPlayState();
    renderTabs();
    renderPresets();
    renderPart();
    $('bpmVal').textContent = bpm;
  }

  function setBpm(v) {
    bpm = Math.max(30, Math.min(240, v));
    $('bpmVal').textContent = bpm;
    const part = PARTS[partIdx];
    if (part.mode !== 'image') part.bpm = bpm;
    renderPresets();
  }

  function setMode(m) {
    playMode = m;
    repInUnit = 0;
    updateModeUI();
    if (!playing) idleDisplay();
  }

  function updateModeUI() {
    const img = isImage();
    $('modeSwitch').style.display = img ? 'none' : 'flex';
    $('nextUnitBtn').style.display = img ? 'none' : 'flex';
    $('modeSwitch').querySelectorAll('.mode').forEach((b) =>
      b.classList.toggle('active', b.dataset.m === playMode));
  }

  // ---------- Wake Lock ----------
  let wakeLock = null;
  async function requestWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); }
    catch (e) {}
  }
  function releaseWakeLock() { try { wakeLock && wakeLock.release(); wakeLock = null; } catch (e) {} }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && playing) requestWakeLock();
  });

  // ---------- Fullscreen ----------
  function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    else (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  }

  // ---------- Wire up ----------
  $('playBtn').onclick = togglePlay;
  $('stopBtn').onclick = stop;
  $('prevBtn').onclick = () => selectPart(Math.max(0, partIdx - 1));
  $('nextBtn').onclick = () => selectPart(Math.min(PARTS.length - 1, partIdx + 1));
  $('nextUnitBtn').onclick = () => nextUnit(1);
  $('bpmUp').onclick = () => setBpm(bpm + 1);
  $('bpmDown').onclick = () => setBpm(bpm - 1);
  $('fsBtn').onclick = toggleFullscreen;
  $('modeSwitch').querySelectorAll('.mode').forEach((b) => b.onclick = () => setMode(b.dataset.m));
  $('subSel').querySelectorAll('button').forEach((b) => b.onclick = () => {
    subPerBeat = +b.dataset.s;
    $('subSel').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  });

  $('startBtn').onclick = () => { ensureAudio(); $('startOverlay').classList.add('hidden'); };

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'KeyN') nextUnit(1);
    else if (e.code === 'ArrowRight') $('nextBtn').click();
    else if (e.code === 'ArrowLeft') $('prevBtn').click();
    else if (e.code === 'ArrowUp') setBpm(bpm + 1);
    else if (e.code === 'ArrowDown') setBpm(bpm - 1);
  });

  // ---------- Init ----------
  renderTabs();
  renderPresets();
  renderPart();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
