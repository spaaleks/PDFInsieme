export class PdfRenderer {
  constructor(url) {
    this.url = url;
    this.pdfDoc = null;
    this.numPages = null;
    this.activeRenderTask = null;
    this.renderSeq = 0;
  }

  async ensurePdf() {
    if (this.pdfDoc) return;
    if (!this.url) throw new Error("No PDF URL provided.");
    const task = pdfjsLib.getDocument(this.url);
    this.pdfDoc = await task.promise;
    this.numPages = this.pdfDoc.numPages;
  }

  cancelActive() {
    if (this.activeRenderTask) {
      try { this.activeRenderTask.cancel(); } catch (_) { }
      this.activeRenderTask = null;
    }
  }
  async renderPage(pageNum, canvas, wrapEl, labelEl = null, labelPrefix = "") {
    if (!this.pdfDoc) await this.ensurePdf();
    pageNum = Math.min(this.numPages, Math.max(1, pageNum));

    this.cancelActive();
    const page = await this.pdfDoc.getPage(pageNum);

    const rotation = ((page.rotate || 0) % 360 + 360) % 360; // normalize
    const baseViewport = page.getViewport({ scale: 1, rotation });

    // respect wrapper padding + canvas margins
    const wrapRect = wrapEl.getBoundingClientRect();
    const wrapCS = getComputedStyle(wrapEl);
    const padL = parseFloat(wrapCS.paddingLeft) || 0;
    const padR = parseFloat(wrapCS.paddingRight) || 0;
    const padT = parseFloat(wrapCS.paddingTop) || 0;
    const padB = parseFloat(wrapCS.paddingBottom) || 0;

    const canvasCS = getComputedStyle(canvas);
    const marL = parseFloat(canvasCS.marginLeft) || 0;
    const marR = parseFloat(canvasCS.marginRight) || 0;
    const marT = parseFloat(canvasCS.marginTop) || 0;
    const marB = parseFloat(canvasCS.marginBottom) || 0;

    const maxW = Math.max(1, wrapRect.width - padL - padR - marL - marR);
    const maxH = Math.max(1, wrapRect.height - padT - padB - marT - marB);

    const scale = Math.max(0.1, Math.min(maxW / baseViewport.width, maxH / baseViewport.height));
    const viewport = page.getViewport({ scale, rotation });

    // device pixel ratio scaling via renderContext.transform
    const dpr = window.devicePixelRatio || 1;

    // size canvas; DO NOT set canvas transform
    canvas.width = Math.ceil(viewport.width * dpr);
    canvas.height = Math.ceil(viewport.height * dpr);
    canvas.style.width = Math.ceil(viewport.width) + 'px';
    canvas.style.height = Math.ceil(viewport.height) + 'px';

    const ctx = canvas.getContext("2d");
    // reset any prior transform to identity
    if (ctx.resetTransform) ctx.resetTransform(); else ctx.setTransform(1, 0, 0, 1, 0, 0);

    const seq = ++this.renderSeq;
    const task = page.render({
      canvasContext: ctx,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
    });
    this.activeRenderTask = task;

    try {
      await task.promise;
      if (seq !== this.renderSeq) return;
      if (labelEl) labelEl.textContent = `${labelPrefix}${pageNum}/${this.numPages}`;
    } catch (e) {
      if (e && e.name === "RenderingCancelledException") return;
      throw e;
    } finally {
      if (this.activeRenderTask === task) this.activeRenderTask = null;
    }

    // re-measure after layout settles once; re-render if available area changed
    await new Promise(requestAnimationFrame);
    const afterRect = wrapEl.getBoundingClientRect();
    const afterW = Math.max(1, afterRect.width - padL - padR - marL - marR);
    const afterH = Math.max(1, afterRect.height - padT - padB - marT - marB);
    if (Math.abs(afterW - maxW) > 1 || Math.abs(afterH - maxH) > 1) {
      // layout changed; render again with new size
      this.renderPage(pageNum, canvas, wrapEl, labelEl, labelPrefix);
    }
  }
}
