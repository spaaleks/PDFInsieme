import { installIdleUI, installFullscreen } from "./components/ui-common.js";
import { bootViewerBase } from "./components/viewer-base.js";
import { attachLaser } from "./components/laser.js";

installIdleUI(2000);
installFullscreen(document.getElementById("fsBtn"));

const socket = io();
let numPages = null;

const FIRST_KEY = `room:${ROOM}:first-upload-modal-shown`;
const JUST_KEY = `room:${ROOM}:just-uploaded`;

function markJustUploaded() { sessionStorage.setItem(JUST_KEY, "1"); }
function maybeOpenFirstModal() {
  if (sessionStorage.getItem(JUST_KEY) === "1") {
    sessionStorage.removeItem(JUST_KEY);
    if (!sessionStorage.getItem(FIRST_KEY)) {
      sessionStorage.setItem(FIRST_KEY, "1");
      openModal();
    }
  }
}

const core = bootViewerBase({
  pdfUrl, room: ROOM, socket,
  selectors: { container: "viewerContainer", canvas: "pdfCanvas", pageLabel: "pageLabel" },
  onNumPages: (n) => { if (typeof n === "number") numPages = n; },
  onFirstUpload: openModal
});

// host controls
document.getElementById("prevBtn")?.addEventListener("click", () => socket.emit("step", { room: ROOM, delta: -1 }));
document.getElementById("nextBtn")?.addEventListener("click", () => socket.emit("step", { room: ROOM, delta: 1 }));
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "PageDown") socket.emit("step", { room: ROOM, delta: 1 });
  if (e.key === "ArrowLeft" || e.key === "PageUp") socket.emit("step", { room: ROOM, delta: -1 });
}, { passive: true });

// lock button if present
const lockBtn = document.getElementById("lockBtn");
let lockedBy = null, statusEl = document.getElementById("status");
function updateLockUI() {
  if (!lockBtn) return;
  lockBtn.textContent = lockedBy ? "Unlock" : "Lock";
  if (statusEl) statusEl.textContent = lockedBy ? "Controls locked." : "Controls unlocked.";
}
if (lockBtn) {
  lockBtn.addEventListener("click", (e) => {
    if (e.altKey) socket.emit("force_unlock", { room: ROOM });
    else if (lockedBy) socket.emit("unlock", { room: ROOM });
    else socket.emit("lock", { room: ROOM });
  });
  socket.on("sync", (d) => { lockedBy = d.locked_by || null; updateLockUI(); });
}

// presenter popup
document.getElementById("presenterBtn")?.addEventListener("click", () => {
  window.open(`/r/${ROOM}/presenter`, "presenter_next", "width=1000,height=550");
});

// laser: host can send
attachLaser({
  socket, room: ROOM,
  canvas: core.canvas,
  overlay: document.getElementById("pointerOverlay"),
  dot: document.getElementById("pointerDot"),
  pageRef: core.getPage,
  enableSend: true,
  containerEl: core.containerEl
});

// dropzone + upload (host only, if present)
const dropzone = document.getElementById("dropzone");
const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
if (dropzone && uploadForm && fileInput) {
  const box = dropzone.querySelector(".dz-box");
  const setDrag = (on) => dropzone.classList.toggle("dragover", !!on);
  const choose = () => fileInput.click();

  box.addEventListener("click", choose);
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") choose(); });

  ["dragenter", "dragover"].forEach(ev => window.addEventListener(ev, (e) => { e.preventDefault(); setDrag(true); }, { passive: false }));
  ["dragleave", "dragend", "drop"].forEach(ev => window.addEventListener(ev, (e) => { e.preventDefault(); if (ev !== "drop") setDrag(false); }, { passive: false }));
  window.addEventListener("drop", (e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer?.files?.[0]; if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return;
    const dt = new DataTransfer(); dt.items.add(f); fileInput.files = dt.files;
    uploadForm.submit(); dropzone.classList.add("hidden");
  });
  socket.on("pdf_changed", () => dropzone.classList.add("hidden"));
}

document.getElementById('uploadBtn')?.addEventListener('click', () => {
  markJustUploaded();
  document.getElementById('fileInput')?.click();
});

document.getElementById('fileInput')?.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    markJustUploaded();
    document.getElementById('uploadForm')?.submit();
  }
});


// ---------------- Settings Modal ----------------
const settingsBtn = document.getElementById('settingsBtn');
const modal = document.getElementById('settingsModal');
const modalClose = document.getElementById('modalClose');
const guestToggle = document.getElementById('guestToggle');
const roomId = document.getElementById('roomId');
const regularLink = document.getElementById('regularLink');
const guestLink = document.getElementById('guestLink');
const copyRoomId = document.getElementById('copyRoomId');
const copyRegular = document.getElementById('copyRegular');
const copyGuest = document.getElementById('copyGuest');
let firstPdfModalShown = false;

function openModal() {
  if (modal) modal.classList.add('show');
}
function closeModal() {
  if (modal) modal.classList.remove('show');
}

if (settingsBtn) settingsBtn.addEventListener('click', openModal);
if (modalClose) modalClose.addEventListener('click', closeModal);
if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal?.classList.contains('show')) closeModal();
}, { passive: true });

async function postJSON(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

if (guestToggle) {
  guestToggle.addEventListener('change', async () => {
    try {
      const res = await postJSON(`/r/${ROOM}/settings/guest`, { enabled: guestToggle.checked });
      if (regularLink) regularLink.value = res.regular_url;
      if (guestLink) guestLink.value = res.guest_url;
    } catch (e) {
      guestToggle.checked = !guestToggle.checked; // revert
      alert('Failed to update guest access.');
    }
  });
}

function copyToClipboard(inputEl) {
  inputEl.select();
  inputEl.setSelectionRange(0, 99999);
  document.execCommand('copy'); // fallback
  if (navigator.clipboard) {
    navigator.clipboard.writeText(inputEl.value).catch(() => { });
  }
}
if (copyRegular && regularLink) copyRegular.addEventListener('click', () => copyToClipboard(regularLink));
if (copyGuest && guestLink) copyGuest.addEventListener('click', () => copyToClipboard(guestLink));
if (copyRoomId && roomId) copyRoomId.addEventListener('click', () => copyToClipboard(roomId));

maybeOpenFirstModal();
