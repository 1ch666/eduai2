// Lightweight background music player widget.
// Creates a fixed bar at the bottom of the page.
// Requires audio files in /public/music/ — see music-data.js for the track list.
// State (track index, volume, muted) persists across pages via localStorage.

import { TRACKS } from './music-data.js';

const STORAGE_KEY = 'eduai2-music';

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* quota */ }
}

function buildWidget() {
  const el = document.createElement('div');
  el.id = 'music-player';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', '背景音樂播放器');
  el.innerHTML = `
<button id="mp-toggle" aria-label="顯示音樂播放器" title="背景音樂">♪</button>
<div id="mp-panel" hidden>
  <div id="mp-track-info">
    <span id="mp-title">—</span>
    <span id="mp-artist" style="color:var(--muted,#555);font-size:.8em"></span>
  </div>
  <div id="mp-controls">
    <button id="mp-prev" title="上一首">&#9664;&#9664;</button>
    <button id="mp-play" title="播放 / 暫停">&#9654;</button>
    <button id="mp-next" title="下一首">&#9654;&#9654;</button>
    <input id="mp-volume" type="range" min="0" max="1" step="0.05" value="0.5" title="音量" style="width:6rem">
    <button id="mp-mute" title="靜音">&#128264;</button>
  </div>
  <details id="mp-credits-details" style="font-size:.72em;margin-top:.4rem">
    <summary style="cursor:pointer">授權資訊</summary>
    <ul id="mp-credits-list" style="margin:.3rem 0;padding-left:1.2rem;list-style:disc"></ul>
  </details>
</div>`;
  document.body.appendChild(el);
  return el;
}

function injectStyle() {
  const s = document.createElement('style');
  s.textContent = `
#music-player {
  position: fixed; bottom: 1rem; right: 1rem; z-index: 200;
  font-family: inherit; font-size: .85rem;
}
#mp-toggle {
  background: var(--ink-blue,#3d4e57); color: #fff; border: none;
  border-radius: 50%; width: 2.4rem; height: 2.4rem; cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,.25); font-size: 1rem;
}
#mp-panel {
  background: var(--paper,#f7f8f7); border: 1px solid var(--line,#bec4bb);
  border-radius: 10px; padding: .65rem .85rem; margin-bottom: .4rem;
  box-shadow: 0 4px 18px rgba(0,0,0,.15); min-width: 16rem; max-width: 22rem;
}
#mp-track-info { margin-bottom: .35rem; display: flex; flex-direction: column; gap: .1rem; }
#mp-controls { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; }
#mp-controls button {
  background: none; border: 1px solid var(--line,#ccc); border-radius: 4px;
  padding: .2rem .45rem; cursor: pointer;
}
#mp-controls button:hover { background: var(--paper-2,#edf0ed); }
#mp-controls button:disabled { opacity: .4; cursor: default; }`;
  document.head.appendChild(s);
}

export function initMusicPlayer() {
  if (TRACKS.length === 0) return; // no tracks configured

  injectStyle();
  buildWidget();

  // On GitHub Pages the site is served under /eduai2/; on the Worker it's at root.
  const musicBase = location.hostname.endsWith('github.io') ? '/eduai2' : '';

  const audio = new Audio();
  audio.loop = false;
  let state = loadState();
  let trackIdx = Math.min(Number(state.trackIdx) || 0, TRACKS.length - 1);
  let panelOpen = false;
  let errorStreak = 0; // consecutive load errors; stops infinite skip loop

  const $id = id => document.getElementById(id);
  const titleEl   = $id('mp-title');
  const artistEl  = $id('mp-artist');
  const playBtn   = $id('mp-play');
  const prevBtn   = $id('mp-prev');
  const nextBtn   = $id('mp-next');
  const volInput  = $id('mp-volume');
  const muteBtn   = $id('mp-mute');
  const panel     = $id('mp-panel');
  const toggleBtn = $id('mp-toggle');
  const creditsList = $id('mp-credits-list');

  // Populate credits
  TRACKS.forEach(t => {
    const li = document.createElement('li');
    li.textContent = t.attribution;
    creditsList.appendChild(li);
  });

  // Restore volume (Number(undefined) is NaN; ?? does not catch NaN, so use isFinite check)
  const savedVol = Number(state.volume);
  audio.volume = Number.isFinite(savedVol) ? Math.min(1, Math.max(0, savedVol)) : 0.5;
  volInput.value = audio.volume;
  audio.muted = Boolean(state.muted);
  muteBtn.textContent = audio.muted ? '🔇' : '🔊';

  function loadTrack(idx, autoplay = false) {
    trackIdx = ((idx % TRACKS.length) + TRACKS.length) % TRACKS.length;
    const t = TRACKS[trackIdx];
    audio.src = musicBase + t.file;
    titleEl.textContent = t.title;
    artistEl.textContent = t.artist;
    playBtn.textContent = '▶';
    if (autoplay) audio.play().catch(() => {});
    saveState({ trackIdx, volume: audio.volume, muted: audio.muted });
  }

  function togglePlay() {
    if (audio.paused) {
      if (!audio.src) loadTrack(trackIdx, true);
      else audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }

  audio.addEventListener('play',  () => { errorStreak = 0; playBtn.textContent = '⏸'; });
  audio.addEventListener('pause', () => { playBtn.textContent = '▶'; });
  audio.addEventListener('ended', () => { errorStreak = 0; loadTrack(trackIdx + 1, true); });
  audio.addEventListener('error', () => {
    errorStreak++;
    if (errorStreak >= TRACKS.length) {
      // Every track failed (audio files not available); stop silently.
      playBtn.textContent = '▶';
      titleEl.textContent = '音訊檔案尚未提供';
      return;
    }
    setTimeout(() => loadTrack(trackIdx + 1, !audio.paused), 1200);
  });

  playBtn.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', () => loadTrack(trackIdx - 1, !audio.paused));
  nextBtn.addEventListener('click', () => loadTrack(trackIdx + 1, !audio.paused));

  volInput.addEventListener('input', () => {
    audio.volume = Number(volInput.value);
    saveState({ trackIdx, volume: audio.volume, muted: audio.muted });
  });

  muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    muteBtn.textContent = audio.muted ? '🔇' : '🔊';
    saveState({ trackIdx, volume: audio.volume, muted: audio.muted });
  });

  toggleBtn.addEventListener('click', () => {
    panelOpen = !panelOpen;
    panel.hidden = !panelOpen;
    toggleBtn.setAttribute('aria-expanded', String(panelOpen));
  });

  // Load metadata for first track without autoplaying
  loadTrack(trackIdx, false);
}
