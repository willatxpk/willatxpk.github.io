// Shared by every page: the top menu, the project cards, and loading games.json.
//   <nav id="topnav" data-page="games"></nav>      -> draws the menu, highlighting "games"
//   <main id="shelf" data-type="game"></main>      -> fills it with every project of that type

const NAV = [
  { page: "home", href: "./", label: "Home" },
  { page: "games", href: "games.html", emoji: "🎮", label: "Games", type: "game" },
  { page: "learning", href: "learning.html", emoji: "🧪", label: "Learning", type: "learning" },
  { page: "apps", href: "apps.html", emoji: "🧰", label: "Apps", type: "app" },
  { page: "about", href: "about.html", label: "About" },
];

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtSize = b => b == null ? "" : b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB";
const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
const pageForType = t => (NAV.find(n => n.type === t) || NAV[1]).href;

function drawNav() {
  const nav = document.getElementById("topnav");
  if (!nav) return;
  const here = nav.dataset.page;
  nav.innerHTML = `<a class="brand" href="./">🕹️</a>` + NAV.map(n =>
    `<a href="${n.href}"${n.page === here ? ' aria-current="page"' : ""}>${n.emoji ? `<span class="ni">${n.emoji}</span> ` : ""}${n.label}</a>`).join("");
}

function card(g) {
  const buttons = [];
  if (g.play) buttons.push(`<a class="btn" href="play/${esc(g.id)}/">▶ ${g.type === "app" ? "Open" : "Play"}</a>`);
  if (g.playMobile) buttons.push(`<a class="btn" href="play/${esc(g.id)}/?touch">📱 Play on phone</a>`);
  if (g.guide) buttons.push(`<a class="btn" href="${esc(g.guide)}">Setup guide</a>`);
  if (g.download) buttons.push(`<a class="btn ghost" href="downloads/${esc(g.id)}.zip" download>⬇ Download${g.size ? " · " + fmtSize(g.size) : ""}</a>`);
  buttons.push(`<a class="btn ghost" href="feedback.html?game=${encodeURIComponent(g.id)}">💬 Feedback</a>`);
  const meta = g.version ? `Version ${g.version} · updated ${fmtDate(g.updated)}` : "";
  return `<article class="card" id="${esc(g.id)}" style="--accent:${esc(g.accent || "#888")}">
    <div class="cover">${esc(g.icon || "🎮")}${g.image ? `<img src="${esc(g.image)}" alt="">` : ""}</div>
    <div class="body">
      <h3>${esc(g.title)}</h3>
      <div class="tags">${(g.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      <p class="tagline">${esc(g.tagline)}</p>
      <p class="desc">${esc(g.description)}</p>
      ${g.downloadNote ? `<p class="note">${esc(g.downloadNote)}</p>` : ""}
      <div class="meta">${meta}</div>
      <div class="actions">${buttons.join("")}</div>
    </div>
  </article>`;
}

let _data = null;
function loadData() {
  if (!_data) _data = fetch("games.json", { cache: "no-cache" }).then(r => r.json()).then(d => {
    d.live = (d.games || []).filter(g => g.version > 0);
    return d;
  });
  return _data;
}

function drawShelf() {
  const shelf = document.getElementById("shelf");
  if (!shelf || !shelf.dataset.type) return;
  const type = shelf.dataset.type;
  loadData().then(d => {
    const known = new Set((d.sections || []).map(s => s.type));
    // Anything with an unrecognised type shows up under Games rather than disappearing.
    const items = d.live.filter(g => (g.type || "game") === type || (type === "game" && !known.has(g.type || "game")));
    const sec = (d.sections || []).find(s => s.type === type);
    if (sec && sec.blurb) { const b = document.getElementById("blurb"); if (b) b.textContent = sec.blurb; }
    shelf.innerHTML = items.length ? `<div class="grid">${items.map(card).join("")}</div>` : `<p class="empty">Nothing here yet. Check back soon!</p>`;
    if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) { el.scrollIntoView(); el.classList.add("flash"); } }
  }).catch(() => { shelf.innerHTML = `<p class="empty">Couldn't load the list.</p>`; });
}

drawNav();
drawShelf();
