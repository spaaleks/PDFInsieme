import { PdfRenderer } from "./components/pdf-renderer.js";
const renderer = new PdfRenderer(pdfUrl);

const socket = io();
socket.emit('join', { room: ROOM });

let pdfDoc = null, numPages = null, currentPage = 1;
let renderTasks = { curr: null, next: null };
let renderTokens = { curr: 0, next: 0 };

const currCanvas = document.getElementById('currCanvas');
const nextCanvas = document.getElementById('nextCanvas');
const currLabel  = document.getElementById('currLabel');
const nextLabel  = document.getElementById('nextLabel');

async function ensurePdf(url){
  if (!url) return;
  if (pdfDoc) return;
  const task = pdfjsLib.getDocument(url);
  pdfDoc = await task.promise;
  numPages = pdfDoc.numPages;
}

function fitScale(page, wrapEl){
  // Rotation zuerst bestimmen und berücksichtigen
  const rotation = (page.rotate || 0) % 360;
  const base = page.getViewport({ scale: 1, rotation });
  // verfügbare Größe aus dem Wrapper (fixiert, unabhängig vom Canvas)
  const rect = wrapEl.getBoundingClientRect();
  const maxW = Math.max(1, rect.width  - 0);
  const maxH = Math.max(1, rect.height - 0);
  const scale = Math.max(0.1, Math.min(maxW / base.width, maxH / base.height));
  return { scale, rotation };
}

async function renderTo(key, canvas, wrapEl, pageNum, labelEl){
  if (!pdfDoc) return;
  pageNum = Math.min(numPages, Math.max(1, pageNum));

  // cancel any running render on this canvas
  if (renderTasks[key]) { try { renderTasks[key].cancel(); } catch(_){} }

  const page = await pdfDoc.getPage(pageNum);

  // rotation first, then fit
  const rotation = (page.rotate || 0) % 360;
  const base = page.getViewport({ scale: 1, rotation });
  const rect = wrapEl.getBoundingClientRect();
  const maxW = Math.max(1, rect.width);
  const maxH = Math.max(1, rect.height);
  const scale = Math.max(0.1, Math.min(maxW / base.width, maxH / base.height));
  const viewport = page.getViewport({ scale, rotation });

  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.floor(viewport.width  * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width  = Math.floor(viewport.width)  + 'px';
  canvas.style.height = Math.floor(viewport.height) + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const token = ++renderTokens[key];
  const task = page.render({ canvasContext: ctx, viewport });
  renderTasks[key] = task;

  try {
    await task.promise;
  } catch (e) {
    if (e && e.name === 'RenderingCancelledException') return; // expected on cancel
    throw e;
  } finally {
    if (token === renderTokens[key]) renderTasks[key] = null;
  }

  if (labelEl) {
    const isCurr = labelEl.id === 'currLabel';
    labelEl.textContent = `${isCurr ? 'Current' : 'Next'}: ${pageNum}/${numPages}`;
  }
}


async function renderBoth() {
  await renderer.ensurePdf();
  await renderer.renderPage(currentPage, currCanvas, currCanvas.parentElement, currLabel, "Current: ");
  await renderer.renderPage(Math.min(renderer.numPages, currentPage + 1), nextCanvas, nextCanvas.parentElement, nextLabel, "Next: ");
}


// Nur Fenster-Resize beobachten, kein ResizeObserver auf Wrap (vermeidet Feedback)
let resizeTimer = null;
function scheduleRerender(){
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderBoth, 80);
}
window.addEventListener('resize', scheduleRerender, { passive: true });

socket.on('sync', async (data) => {
  currentPage = data.current_page || 1;
  await ensurePdf(pdfUrl);
  renderBoth();
});
socket.on('reset', async (data) => {
  currentPage = data.current_page || 1;
  pdfDoc = null; numPages = null;
  await ensurePdf(pdfUrl);
  renderBoth();
});

(async () => {
  await ensurePdf(pdfUrl);
  renderBoth();
})();


const tDisp  = document.getElementById('timerDisplay');
const tStart = document.getElementById('tStart');
const tStop  = document.getElementById('tStop');
const tReset = document.getElementById('tReset');

let T_running = false;
let T_elapsed_ms = 0;    // akkumuliert
let T_server_now = 0;
let T_start_ts = null;   // server epoch sec
let tickHandle = null;

function fmt(ms){
  const t = Math.max(0, Math.floor(ms));
  const mm = Math.floor(t/60000);
  const ss = Math.floor((t%60000)/1000);
  const ds = Math.floor((t%1000)/100); // Zehntel
  return String(mm).padStart(2,'0') + ":" + String(ss).padStart(2,'0') + "." + ds;
}

function stopLocalTick(){
  if (tickHandle){ cancelAnimationFrame(tickHandle); tickHandle = null; }
}

function startLocalTick(){
  stopLocalTick();
  const clientStart = performance.now();
  const serverStart = T_start_ts ? (T_start_ts*1000) : performance.timing?.navigationStart || Date.now();
  const serverClientDelta = Date.now() - T_server_now*1000; // client minus server now
  function frame(){
    // Laufzeit = akkumuliert + (Serverjetzt – Start) mit Delta-Korrektur
    const nowClient = Date.now();
    const runMs = (nowClient - serverClientDelta) - (serverStart) + 0; // server synced
    const ms = T_elapsed_ms + Math.max(0, runMs);
    tDisp.textContent = fmt(ms);
    tickHandle = requestAnimationFrame(frame);
  }
  frame();
}

function applyTimerUpdate(msg){
  T_running     = !!msg.running;
  T_elapsed_ms  = msg.elapsed_ms || 0;
  T_start_ts    = msg.start_ts ?? null;
  T_server_now  = msg.server_now || (Date.now()/1000);

  if (T_running) startLocalTick(); else { stopLocalTick(); tDisp.textContent = fmt(T_elapsed_ms); }

  // Buttons Zustand
  tStart.disabled = T_running;
  tStop.disabled  = !T_running;
  tReset.disabled = T_running;
}

// Buttons → Events
tStart.addEventListener('click', () => socket.emit('timer_start', { room: ROOM }));
tStop .addEventListener('click', () => socket.emit('timer_stop',  { room: ROOM }));
tReset.addEventListener('click', () => socket.emit('timer_reset', { room: ROOM }));

// Socket-Empfang
socket.on('timer_update', applyTimerUpdate);

socket.on('pdf_changed', async (data) => {
  if (!data || !data.url) return;
  pdfDoc = null; numPages = null; currentPage = 1;
  await ensurePdf(data.url);
  renderBoth();
});
