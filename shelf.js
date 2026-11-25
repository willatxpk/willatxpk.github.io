// Shared by every page: the header, the footer, the project list, and loading games.json.
//   <nav id="topnav" data-page="games"></nav>      -> draws the header, underlining "games"
//   <main id="shelf" data-type="game"></main>      -> fills it with every project of that type
//   <footer id="sitefoot"></footer>                -> draws the footer
// The site name comes from "siteTitle" in games.json.

const NAV = [
  { page: "games", href: "games.html", label: "Games", type: "game" },
  { page: "learning", href: "learning.html", label: "Learning", type: "learning" },
  { page: "apps", href: "apps.html", label: "Apps", type: "app" },
  { page: "about", href: "about.html", label: "About" },
];
const LINKS = [
  { href: "https://github.com/willatxpk", label: "GitHub" },
  { href: "https://www.linkedin.com/in/william-pajak-a2455a1a8/", label: "LinkedIn" },
];
let SITE_NAME = "Will Pajak";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtSize = b => b == null ? "" : b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB";
const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
const pageForType = t => (NAV.find(n => n.type === t) || NAV[0]).href;
const sectionName = t => (NAV.find(n => n.type === t) || NAV[0]).label;

function drawNav() {
  const nav = document.getElementById("topnav");
  if (!nav) return;
  const here = nav.dataset.page;
  nav.innerHTML = `<a class="wordmark" href="./">${esc(SITE_NAME)}</a><div class="links">` + NAV.map(n =>
    `<a href="${n.href}"${n.page === here ? ' aria-current="page"' : ""}>${n.label}</a>`).join("") + `</div>`;
}

function drawFooter() {
  const f = document.getElementById("sitefoot");
  if (!f) return;
  f.className = "site";
  f.innerHTML = `<div class="wrap"><span>© ${new Date().getFullYear()} William Pajak</span>` +
    LINKS.map(l => `<a href="${l.href}">${l.label}</a>`).join("") + `<a href="about.html">About</a></div>`;
}

// One project as a row: name and tags | description and actions | version and date
function project(g) {
  const acts = [];
  const verb = g.type === "app" ? "Open" : "Play";
  if (g.play) acts.push(`<a class="btn" href="play/${encodeURIComponent(g.id)}/">${verb} in browser</a>`);
  if (g.guide) acts.push(`<a class="btn${g.play ? " ghost" : ""}" href="${esc(g.guide)}">Setup guide</a>`);
  if (g.playMobile) acts.push(`<a class="btn ghost" href="play/${encodeURIComponent(g.id)}/?touch">Phone version</a>`);
  if (g.download) acts.push(`<a class="btn ghost" href="downloads/${encodeURIComponent(g.id)}.zip" download>Download${g.size ? ` <span class="mono" style="opacity:.7">${fmtSize(g.size)}</span>` : ""}</a>`);
  acts.push(`<a class="textlink" href="feedback.html?game=${encodeURIComponent(g.id)}">Leave feedback</a>`);
  return `<article class="project" id="${esc(g.id)}">
    <div>
      <h3>${esc(g.title)}</h3>
      <p class="p-tagline">${esc(g.tagline)}</p>
      <p class="p-tags"><span class="p-swatch" style="--swatch:${esc(g.accent || "")}"></span>${(g.tags || []).map(esc).join(" · ")}</p>
      ${g.image ? `<img class="p-thumb" src="${esc(g.image)}" alt="${esc(g.title)}" loading="lazy">` : ""}
    </div>
    <div>
      <p class="p-desc">${esc(g.description)}</p>
      ${g.downloadNote ? `<p class="note">${esc(g.downloadNote)}</p>` : ""}
      <div class="actions">${acts.join("")}</div>
    </div>
    <div class="p-side"><span><b>v${g.version}</b></span><br><span>${esc(fmtDate(g.updated))}</span></div>
  </article>`;
}

let _data = null;
function loadData() {
  if (!_data) _data = fetch("games.json", { cache: "no-cache" }).then(r => r.json()).then(d => {
    d.live = (d.games || []).filter(g => g.version > 0);
    if (d.siteTitle && d.siteTitle !== SITE_NAME) { SITE_NAME = d.siteTitle; drawNav(); }
    return d;
  });
  return _data;
}
const ofType = (d, type) => {
  const known = new Set((d.sections || []).map(s => s.type));
  // Anything with an unrecognised type is listed under Games rather than disappearing.
  return d.live.filter(g => (g.type || "game") === type || (type === "game" && !known.has(g.type || "game")));
};

function drawShelf() {
  const shelf = document.getElementById("shelf");
  if (!shelf || !shelf.dataset.type) return;
  const type = shelf.dataset.type;
  loadData().then(d => {
    const items = ofType(d, type);
    const sec = (d.sections || []).find(s => s.type === type);
    if (sec && sec.blurb) { const b = document.getElementById("blurb"); if (b) b.textContent = sec.blurb; }
    const c = document.getElementById("count"); if (c) c.textContent = `${sectionName(type)} · ${items.length}`;
    shelf.innerHTML = items.length ? `<div class="projects">${items.map(project).join("")}</div>` : `<p class="empty">Nothing here yet.</p>`;
    if (location.hash) { const el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) { el.scrollIntoView(); el.classList.add("flash"); } }
  }).catch(() => { shelf.innerHTML = `<p class="empty">Couldn't load the list.</p>`; });
}

drawNav();
drawFooter();
drawShelf();
