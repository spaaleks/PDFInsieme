import { installIdleUI, installFullscreen } from "./components/ui-common.js";
import { bootViewerBase } from "./components/viewer-base.js";
import { attachLaser } from "./components/laser.js";

installIdleUI(2000);
installFullscreen(document.getElementById("fsBtn"));

const socket = io();
let numPages = null;

const core = bootViewerBase({
  pdfUrl, room: ROOM, socket,
  selectors: { container:"viewerContainer", canvas:"pdfCanvas", pageLabel:"pageLabel" },
  onNumPages: (n)=>{ if (typeof n==="number") numPages=n; }
});

// Guests: no emits. Disable buttons if present.
document.getElementById("prevBtn")?.addEventListener("click", ()=>{});
document.getElementById("nextBtn")?.addEventListener("click", ()=>{});
document.addEventListener("keydown", ()=>{}, { passive:true });

// laser: receive-only
attachLaser({
  socket, room: ROOM,
  canvas: core.canvas,
  overlay: document.getElementById("pointerOverlay"),
  dot: document.getElementById("pointerDot"),
  pageRef: core.getPage,
  enableSend: false,
  containerEl: core.containerEl
});
