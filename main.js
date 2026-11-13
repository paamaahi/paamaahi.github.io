// سیستم تغییر زبان (دو زبانه)
let currentLang = 'fa';

function toggleLang() {
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

    // تغییر متن‌ها بر اساس ویژگی data-fa و data-en
    const elements = document.querySelectorAll('[data-fa]');
    elements.forEach(el => {
        el.innerHTML = el.getAttribute(`data-${currentLang}`);
    });
}

// لودینگ اولیه سایت
function startExperience() {
    const intro = document.getElementById('intro');
    const mainContent = document.getElementById('main-content');
    const video = document.getElementById('bg-video');
    intro.style.opacity = '0'; intro.style.pointerEvents = 'none';
    setTimeout(() => {
        intro.style.display = 'none'; mainContent.classList.add('visible');
        if(video) video.play().catch(e => console.log("Auto-play prevented."));
    }, 2000);
}

// کنترل مودال‌ها
function openModal(id) { closeModals(); document.getElementById(id).classList.add('active'); }
function openImageModal(imgSrc) { document.getElementById('modal-img').src = imgSrc; openModal('media-modal'); }
function closeModals() { document.querySelectorAll('.glass-panel').forEach(p => p.classList.remove('active')); }

// افکت موس (نوار مغناطیسی VHS)
const canvas = document.getElementById('interactive-canvas');
const ctx = canvas.getContext('2d');
let width, height;

function resize() { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

let mouse = { x: width/2, y: height/2 }, points = [];
document.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });

function animateCanvas() {
    ctx.clearRect(0, 0, width, height);
    points.push({ x: mouse.x, y: mouse.y });
    if (points.length > 40) points.shift();

    if (points.length > 1) {
        ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            const xc = (points[i].x + points[i - 1].x) / 2, yc = (points[i].y + points[i - 1].y) / 2;
            ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.lineWidth = 18; ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.lineWidth = 12; ctx.strokeStyle = '#050505'; ctx.stroke();
    }

    const nodes = [document.getElementById('node-wip'), document.getElementById('node-char'), document.getElementById('node-doll')];
    ctx.beginPath();
    nodes.forEach((node, idx) => {
        if(!node) return;
        const rect = node.getBoundingClientRect(), nx = rect.left + rect.width / 2, ny = rect.top + rect.height / 2;
        if(idx === 0) ctx.moveTo(nx, ny); else ctx.lineTo(nx, ny);
        if(Math.hypot(nx - mouse.x, ny - mouse.y) < 250) { ctx.moveTo(nx, ny); ctx.lineTo(mouse.x, mouse.y); }
    });
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; ctx.stroke();
    requestAnimationFrame(animateCanvas);
}
animateCanvas();

// بستن مودال با کلیک در فضای خالی
document.getElementById('main-content').addEventListener('click', (e) => {
    if(e.target.id === 'main-content' || e.target.id === 'interactive-canvas') closeModals();
});
