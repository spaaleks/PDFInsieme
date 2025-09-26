export function installIdleUI(ms = 2000) {
    let t;
    const mark = () => {
        document.body.classList.remove("idle");
        clearTimeout(t);
        t = setTimeout(() => document.body.classList.add("idle"), ms);
    };
    ["mousemove", "mousedown", "touchstart", "wheel", "keydown"].forEach(ev =>
        window.addEventListener(ev, mark, { passive: true })
    );
    mark();
}

export function installFullscreen(button) {
    function enter() {
        const el = document.documentElement;
        (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen).call(el);
    }
    function exit() {
        (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
    }
    function toggle() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) enter();
        else exit();
    }
    if (button) button.addEventListener("click", toggle);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.fullscreenElement) exit();
    }, { passive: true });
}
