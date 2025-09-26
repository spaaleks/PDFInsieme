// Shared laser overlay. Host can send, everyone can receive.
export function attachLaser({ socket, room, canvas, overlay, dot, pageRef, enableSend = false, containerEl }) {
    const place = ({ x, y }) => {
        const r = canvas.getBoundingClientRect();
        const ov = overlay.getBoundingClientRect();
        const left = r.left + x * r.width, top = r.top + y * r.height;
        dot.style.transform = `translate(${left - ov.left}px, ${top - ov.top}px)`;
    };
    const hide = () => { dot.style.transform = "translate(-9999px,-9999px)"; };

    // receive
    socket.on("pointer_update", (d) => {
        if (!d || typeof d.x !== "number" || typeof d.y !== "number") return;
        if (d.page !== pageRef()) return;
        place({ x: d.x, y: d.y });
    });
    socket.on("pointer_hide", hide);

    if (!enableSend) return { place, hide };

    // send
    let active = false, raf = null, last = null;
    const send = () => {
        raf = null;
        if (last) socket.emit("pointer_move", { room, ...last });
    };
    const normFrom = (e) => {
        const r = canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) / Math.max(1, r.width);
        const y = (e.clientY - r.top) / Math.max(1, r.height);
        return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    };

    const onMove = (e) => {
        if (!e.ctrlKey) { if (active) { active = false; socket.emit("pointer_hide", { room }); hide(); } return; }
        const p = normFrom(e);
        last = { x: p.x, y: p.y, page: pageRef() };
        place(p);
        active = true;
        if (!raf) raf = requestAnimationFrame(send);
    };

    containerEl.addEventListener("mousemove", onMove);
    ["mouseleave", "blur"].forEach(ev => window.addEventListener(ev, () => {
        if (!active) return;
        active = false; socket.emit("pointer_hide", { room }); hide();
    }));
    window.addEventListener("keyup", (e) => {
        if (e.key === "Control" && active) { active = false; socket.emit("pointer_hide", { room }); hide(); }
    });

    return { place, hide };
}
