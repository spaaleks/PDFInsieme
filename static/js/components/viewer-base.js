import { PdfRenderer } from "./pdf-renderer.js";

// Shared by host and guest
export function bootViewerBase({ pdfUrl, room, socket, selectors, onNumPages }) {
    const containerEl = document.getElementById(selectors.container);
    const canvas = document.getElementById(selectors.canvas);
    const pageLabel = document.getElementById(selectors.pageLabel);

    const renderer = new PdfRenderer(pdfUrl);
    let currentPage = 1;

    async function renderPage(n) {
        await renderer.renderPage(n, canvas, containerEl, pageLabel, "");
    }

    // resize handling
    let rT = null;
    function schedule() { clearTimeout(rT); rT = setTimeout(() => renderPage(currentPage), 80); }
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(containerEl);
    window.addEventListener("resize", schedule, { passive: true });

    // load
    async function load(url) {
        if (!url || typeof pdfjsLib === "undefined") return;
        renderer.cancelActive(); renderer.renderSeq = 0; renderer.pdfDoc = null; renderer.numPages = null;
        await renderer.ensurePdf();
        onNumPages?.(renderer.numPages);
        await renderPage(currentPage);
        requestAnimationFrame(schedule);
    }

    // socket follow
    socket.emit("join", { room });
    socket.on("sync", (d) => { currentPage = d.current_page || 1; onNumPages?.(d.num_pages); renderPage(currentPage); });
    socket.on("reset", (_) => { currentPage = 1; renderPage(currentPage); });
    socket.on("pdf_changed", (d) => {
        if (d?.url) {
            currentPage = 1;
            load(d.url).then(() => {
                // Fire exactly once per room in this browser session
                if (typeof onFirstUpload === "function" && !sessionStorage.getItem(firstUploadKey)) {
                    sessionStorage.setItem(firstUploadKey, "1");
                    try { onFirstUpload(); } catch (_) { }
                }
            });
        }
    });

    // start
    load(pdfUrl);

    return { containerEl, canvas, getPage: () => currentPage, renderPage, load, renderer };
}
