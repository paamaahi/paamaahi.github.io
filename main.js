/* ===== Language ===== */
let currentLang = 'fa';

function toggleLang(event) {
    if (event) event.stopPropagation();
    const html = document.documentElement;
    const btn = document.getElementById('lang-toggle');

    if (currentLang === 'fa') {
        currentLang = 'en';
        html.setAttribute('lang', 'en');
        html.setAttribute('dir', 'ltr');
        btn.innerText = '[ FA ]';
        document.body.style.fontFamily = "var(--font-en)";
    } else {
        currentLang = 'fa';
        html.setAttribute('lang', 'fa');
        html.setAttribute('dir', 'rtl');
        btn.innerText = '[ EN ]';
        document.body.style.fontFamily = "var(--font-fa)";
    }
    document.querySelectorAll('[data-fa]').forEach(el => {
        el.innerHTML = el.getAttribute(`data-${currentLang}`);
    });
}

/* ===== Modals ===== */
function openModal(id) { closeModals(); document.getElementById(id).classList.add('active'); }
function openImageModal(src) { document.getElementById('modal-img').src = src; openModal('media-modal'); }
function closeModals() { document.querySelectorAll('.glass-panel').forEach(p => p.classList.remove('active')); }

/* ===== Setup ===== */
const $ = id => document.getElementById(id);
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const iCv = $('intro-canvas'), iCtx = iCv.getContext('2d');
const mCv = $('interactive-canvas'), mCtx = mCv.getContext('2d');
let W, H, scene = null, introRun = true, trailPinned = false;
const anchor = { x: 0, y: 0 }, tip = { x: 0, y: 0 }, rest = { x: 0, y: 0 };
const pointer = { x: 0, y: 0, active: false };

/* ===== Verlet ribbon (rope with gravity) ===== */
class Ribbon {
    constructor(n) {
        this.n = n; this.w = 20; this.len = 10;
        this.p = Array.from({ length: n }, () => ({ x: 0, y: 0, ox: 0, oy: 0 }));
    }
    reset(a, b) {
        this.p.forEach((q, i) => {
            const k = i / (this.n - 1);
            q.x = q.ox = a.x + (b.x - a.x) * k;
            q.y = q.oy = a.y + (b.y - a.y) * k;
        });
    }
    // a = pinned start (or null = free fall), b = pinned end (or null)
    step(a, b, g, wind, t) {
        const p = this.p, n = this.n, L = this.len;
        for (let i = 0; i < n; i++) {
            const q = p[i];
            const vx = (q.x - q.ox) * 0.985 + wind * Math.sin(t * 0.0012 + i * 0.4);
            const vy = (q.y - q.oy) * 0.985;
            q.ox = q.x; q.oy = q.y; q.x += vx; q.y += vy + g;
        }
        for (let k = 0; k < 16; k++) {
            if (a) { p[0].x = a.x; p[0].y = a.y; }
            if (b) { p[n - 1].x = b.x; p[n - 1].y = b.y; }
            for (let i = 0; i < n - 1; i++) {
                const A = p[i], B = p[i + 1];
                const dx = B.x - A.x, dy = B.y - A.y;
                const d = Math.hypot(dx, dy) || 1e-4, diff = (d - L) / d;
                const wa = (i === 0 && a) ? 0 : 1, wb = (i === n - 2 && b) ? 0 : 1, s = wa + wb;
                if (!s) continue;
                A.x += dx * diff * wa / s; A.y += dy * diff * wa / s;
                B.x -= dx * diff * wb / s; B.y -= dy * diff * wb / s;
            }
        }
        if (a) { p[0].ox = a.x; p[0].oy = a.y; }
        if (b) { p[n - 1].ox = b.x; p[n - 1].oy = b.y; }
    }
    // glossy black tape that twists as it moves
    draw(c, t, taper) {
        const p = this.p, n = this.n, Ls = [], Rs = [], tw = [];
        for (let i = 0; i < n; i++) {
            const a = p[Math.max(i - 1, 0)], b = p[Math.min(i + 1, n - 1)];
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
            const s = Math.sin(i * 0.32 + t * 0.0009);
            tw.push(s);
            const w = this.w * taper(i / (n - 1)) * (0.6 + 0.4 * Math.abs(s)) / 2;
            const nx = -dy / d * w, ny = dx / d * w;
            Ls.push([p[i].x + nx, p[i].y + ny]); Rs.push([p[i].x - nx, p[i].y - ny]);
        }
        c.beginPath(); c.moveTo(Ls[0][0], Ls[0][1]);
        for (let i = 1; i < n; i++) c.lineTo(Ls[i][0], Ls[i][1]);
        for (let i = n - 1; i >= 0; i--) c.lineTo(Rs[i][0], Rs[i][1]);
        c.closePath(); c.fillStyle = '#020203'; c.fill();

        c.lineJoin = c.lineCap = 'round';
        const edge = (E, col, lw) => {
            c.beginPath(); c.moveTo(E[0][0], E[0][1]);
            for (let i = 1; i < n; i++) c.lineTo(E[i][0], E[i][1]);
            c.strokeStyle = col; c.lineWidth = lw; c.stroke();
        };
        edge(Ls, 'rgba(40,110,255,0.9)', Math.max(1, this.w * 0.07));   // blue rim like the artwork
        edge(Rs, 'rgba(130,190,255,0.25)', 1);
        for (let i = 0; i < n - 1; i++) {                               // moving specular glint
            const al = Math.max(0, tw[i]) * 0.55;
            if (al < 0.05) continue;
            const m = (P, Q, k) => [P[0] * (1 - k) + Q[0] * k, P[1] * (1 - k) + Q[1] * k];
            const s0 = m(Ls[i], Rs[i], 0.3), s1 = m(Ls[i + 1], Rs[i + 1], 0.3);
            c.beginPath(); c.moveTo(s0[0], s0[1]); c.lineTo(s1[0], s1[1]);
            c.strokeStyle = `rgba(255,255,255,${al})`; c.lineWidth = Math.max(1, this.w * 0.06); c.stroke();
        }
    }
}

const tether = new Ribbon(46);   // intro: branch -> pointer
const trail = new Ribbon(34);    // main page: hangs from pointer

/* ===== Procedural scene: stars, textured moon, branch ===== */
function rng(s) {
    return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function spline(P, s = 14) {
    const o = [];
    for (let i = 0; i < P.length - 1; i++) {
        const a = P[Math.max(i - 1, 0)], b = P[i], c = P[i + 1], d = P[Math.min(i + 2, P.length - 1)];
        for (let j = 0; j < s; j++) {
            const t = j / s, t2 = t * t, t3 = t2 * t;
            const f = k => 0.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3);
            o.push([f(0), f(1)]);
        }
    }
    o.push(P[P.length - 1]);
    return o;
}

function buildScene() {
    const cv = document.createElement('canvas');
    cv.width = W * DPR; cv.height = H * DPR;
    const g = cv.getContext('2d'); g.scale(DPR, DPR);
    const r = rng(7);

    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#01030a'); sky.addColorStop(0.6, '#050b16'); sky.addColorStop(1, '#0a1626');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H / 6000; i++) {
        g.globalAlpha = 0.2 + r() * 0.7; g.fillStyle = '#fff';
        const s = r() < 0.1 ? 1.8 : 1; g.fillRect(r() * W, r() * H, s, s);
    }
    g.globalAlpha = 1;

    const R = Math.max(80, Math.min(W * 0.3, H * 0.27)), cx = W * 0.58, cy = H * 0.36;

    // halo
    const halo = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 3.2);
    halo.addColorStop(0, 'rgba(170,205,255,0.35)'); halo.addColorStop(1, 'rgba(170,205,255,0)');
    g.fillStyle = halo; g.fillRect(0, 0, W, H);

    // moon body
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    const base = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
    base.addColorStop(0, '#ffffff'); base.addColorStop(0.55, '#eef1f6');
    base.addColorStop(0.9, '#c3cbd6'); base.addColorStop(1, '#8f9aa9');
    g.fillStyle = base; g.fillRect(cx - R, cy - R, R * 2, R * 2);

    [[-.35, -.2, .4], [.15, -.38, .3], [.32, .1, .36], [-.1, .28, .3], [-.5, .32, .2], [.05, -.05, .25]].forEach(([x, y, s]) => {
        const m = g.createRadialGradient(cx + x * R, cy + y * R, 0, cx + x * R, cy + y * R, s * R);
        m.addColorStop(0, 'rgba(95,105,122,0.4)'); m.addColorStop(1, 'rgba(95,105,122,0)');
        g.fillStyle = m; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    });

    for (let i = 0; i < 80; i++) {                       // craters
        const a = r() * 6.283, d = Math.sqrt(r()) * 0.95 * R, cr = (0.015 + r() * r() * 0.09) * R;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        g.beginPath(); g.arc(x, y, cr, 0, 6.283); g.fillStyle = 'rgba(110,120,136,0.22)'; g.fill();
        g.lineWidth = Math.max(0.8, cr * 0.18);
        g.beginPath(); g.arc(x, y, cr, Math.PI * 0.75, Math.PI * 1.75); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
        g.beginPath(); g.arc(x, y, cr, Math.PI * 1.75, Math.PI * 2.75); g.strokeStyle = 'rgba(70,80,96,0.5)'; g.stroke();
    }
    for (let i = 0; i < 3500; i++) {                     // fine grain
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(60,70,90,0.07)';
        g.fillRect(cx - R + r() * R * 2, cy - R + r() * R * 2, 1.2, 1.2);
    }
    const limb = g.createRadialGradient(cx - R * 0.15, cy - R * 0.15, R * 0.6, cx, cy, R);
    limb.addColorStop(0, 'rgba(30,40,60,0)'); limb.addColorStop(1, 'rgba(30,40,60,0.5)');
    g.fillStyle = limb; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.restore();

    // branch in front of the moon
    const ex = (W - cx) / R + 0.3, X = x => cx + x * R, Y = y => cy + y * R;
    const limbs = [
        { pts: [[ex, -0.6], [(ex + 1.5) / 2, -0.3], [1.5, 0.0], [0.95, 0.45], [0.4, 0.8], [-0.05, 0.95]], w0: 0.15, w1: 0.018 },
        { pts: [[1.5, 0.0], [1.3, -0.4], [1.12, -0.95]], w0: 0.06, w1: 0.008 },
        { pts: [[1.5, 0.0], [1.0, -0.22], [0.55, -0.42]], w0: 0.05, w1: 0.008 },
        { pts: [[0.95, 0.45], [0.72, 0.12], [0.78, -0.3]], w0: 0.045, w1: 0.008 },
        { pts: [[0.4, 0.8], [0.15, 0.52], [-0.12, 0.42]], w0: 0.035, w1: 0.008 }
    ];
    g.fillStyle = '#000';
    limbs.forEach(b => {
        const pts = spline(b.pts);
        pts.forEach((q, i) => {
            g.beginPath(); g.arc(X(q[0]), Y(q[1]), (b.w0 + (b.w1 - b.w0) * i / (pts.length - 1)) * R, 0, 6.283); g.fill();
        });
    });

    scene = cv;
    anchor.x = X(-0.05); anchor.y = Y(0.95);
}

function resize() {
    W = innerWidth; H = innerHeight;
    [iCv, mCv].forEach(c => { c.width = W * DPR; c.height = H * DPR; });
    iCtx.setTransform(DPR, 0, 0, DPR, 0, 0); mCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildScene();
    const bw = Math.max(12, Math.min(W, H) * 0.04);
    tether.w = bw; trail.w = bw * 0.45;
    trail.len = Math.max(6, Math.min(W, H) * 0.012);
    rest.x = W * 0.14; rest.y = H * 0.9;
    const t0 = pointer.active ? pointer : rest;
    tip.x = t0.x; tip.y = t0.y;
    tether.reset(anchor, tip);
    trail.reset({ x: W / 2, y: -200 }, { x: W / 2, y: -200 });
}
window.addEventListener('resize', resize);

/* ===== Pointer (mouse + touch) ===== */
let downAt = null, moved = 0;
window.addEventListener('pointermove', e => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
    if (downAt) moved = Math.max(moved, Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y));
    if (e.pointerType !== 'touch' || downAt) trailPinned = true;
});
window.addEventListener('pointerdown', e => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
    downAt = { x: e.clientX, y: e.clientY }; moved = 0;
    if (!trailPinned) trail.reset(pointer, pointer);
    trailPinned = true;
});
window.addEventListener('pointerup', e => {
    downAt = null;
    if (e.pointerType === 'touch') trailPinned = false;   // on touch the ribbon falls when you let go
});

/* ===== Intro loop ===== */
function introFrame(t) {
    if (!introRun) return;
    const target = pointer.active ? pointer : rest;
    tip.x += (target.x - tip.x) * 0.2; tip.y += (target.y - tip.y) * 0.2;
    const d = Math.hypot(tip.x - anchor.x, tip.y - anchor.y);
    const want = Math.max(Math.hypot(W, H) * 0.55, d * 1.03) / (tether.n - 1);
    tether.len += (want - tether.len) * 0.1;
    tether.step(anchor, tip, 0.55, 0.03, t);
    iCtx.drawImage(scene, 0, 0, W, H);
    tether.draw(iCtx, t, k => 0.3 + 0.7 * k);
    requestAnimationFrame(introFrame);
}

function startExperience() {
    if (moved > 12) return;              // a drag on touch screens is play, not "enter"
    const intro = $('intro'), main = $('main-content'), video = $('bg-video');
    intro.style.opacity = '0'; intro.style.pointerEvents = 'none';
    setTimeout(() => {
        intro.style.display = 'none'; introRun = false; main.classList.add('visible');
        if (video) video.play().catch(() => {});
    }, 2000);
}
$('intro').addEventListener('click', startExperience);

/* ===== Main page: ribbon trail + node links ===== */
function mainFrame(t) {
    mCtx.clearRect(0, 0, W, H);
    if (!introRun) {
        trail.step(trailPinned ? pointer : null, null, 0.4, 0.02, t);
        if (trail.p.some(q => q.y < H + 60)) trail.draw(mCtx, t, k => 1 - k * 0.9);

        const ids = ['node-char', 'node-doll', 'node-wip', 'node-sticker'];
        mCtx.beginPath();
        ids.forEach((id, i) => {
            const n = $(id); if (!n) return;
            const rc = n.getBoundingClientRect(), nx = rc.left + rc.width / 2, ny = rc.top + 10;
            if (i === 0) mCtx.moveTo(nx, ny); else mCtx.lineTo(nx, ny);
            if (pointer.active && Math.hypot(nx - pointer.x, ny - pointer.y) < 250) { mCtx.moveTo(nx, ny); mCtx.lineTo(pointer.x, pointer.y); }
        });
        mCtx.lineWidth = 1; mCtx.strokeStyle = 'rgba(255,255,255,0.15)'; mCtx.stroke();
    }
    requestAnimationFrame(mainFrame);
}

$('main-content').addEventListener('click', e => {
    if (e.target.id === 'main-content' || e.target.id === 'interactive-canvas') closeModals();
});

resize();
requestAnimationFrame(introFrame);
requestAnimationFrame(mainFrame);
