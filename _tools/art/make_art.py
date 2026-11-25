"""Writes the title graphic for each project as an SVG in this folder.
Edit a section and run:  py -3 make_art.py   then   .\\render-art.ps1   to turn them into images for the site.
"""
import math, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1600, 1000


def doc(fonts, body, defs=""):
    fam = "&amp;".join("family=" + f for f in fonts)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs>
<style>@import url('https://fonts.googleapis.com/css2?{fam}&amp;display=block');</style>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
{defs}
</defs>
{body}
</svg>'''


def T(y, txt, font, size, fill, weight=400, ls=0, style="normal", extra=""):
    return (f'<text x="800" y="{y}" text-anchor="middle" font-family="{font}" font-size="{size}" '
            f'font-weight="{weight}" font-style="{style}" letter-spacing="{ls}" fill="{fill}" {extra}>{txt}</text>')


def rules(y, fill, half=300, gap=330):
    return (f'<line x1="{800-gap-half}" y1="{y}" x2="{800-gap}" y2="{y}" stroke="{fill}" stroke-width="2"/>'
            f'<line x1="{800+gap}" y1="{y}" x2="{800+gap+half}" y2="{y}" stroke="{fill}" stroke-width="2"/>')


out = {}

# ---------------------------------------------------------------- Hearthlands
rows = "".join(f'<path d="M{-200+i*90},1000 L{500+i*90},560" stroke="#ffffff" stroke-opacity=".035" stroke-width="40"/>' for i in range(26))
out['hearthlands'] = doc(["Cinzel:wght@600;700", "Cormorant+Garamond:ital,wght@1,500"], f'''
<rect width="1600" height="1000" fill="url(#hbg)"/>{rows}
<g transform="translate(800,330)">
 <path d="M-140,-170 H140 V10 C140,110 60,165 0,190 C-60,165 -140,110 -140,10 Z" fill="#efe1bb" stroke="#c98a3a" stroke-width="12"/>
 <path d="M-90,30 L0,-80 L90,30 Z" fill="#2f4a2c"/>
 <rect x="-70" y="30" width="140" height="95" fill="#2f4a2c"/>
 <path d="M-22,125 V75 Q0,55 22,75 V125 Z" fill="#14200f"/>
 <path d="M0,118 C-16,104 -10,90 0,78 C4,92 16,96 8,110 C14,104 16,98 14,92 C22,104 18,116 0,118 Z" fill="#f08a3c"/>
 <rect x="40" y="-60" width="22" height="50" fill="#2f4a2c"/>
 <circle cx="51" cy="-82" r="9" fill="#c9c0a5" opacity=".7"/><circle cx="62" cy="-104" r="12" fill="#c9c0a5" opacity=".5"/>
</g>
{T(690, "HEARTHLANDS", "Cinzel", 124, "#f4e8c8", 700, 14)}
{rules(770, "#c98a3a", 230, 400)}
{T(782, "Grow a village into a civilisation", "Cormorant Garamond", 44, "#d6c494", 500, 0, "italic")}''',
'<linearGradient id="hbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34502f"/><stop offset="1" stop-color="#1a2a18"/></linearGradient>')

# ---------------------------------------------------------------- Gloamreach
castle = ("M0,1000 V820 H120 V760 H150 V800 H260 V700 H230 V660 H300 V700 H280 V800 H420 V840 H560 V730 H540 V690 H600 V600 "
          "H585 V560 L620,500 L655,560 H640 V690 H700 V730 H680 V820 H900 V780 H930 V740 H970 V780 H1040 V660 H1020 V620 H1090 "
          "V660 H1070 V800 H1200 V760 H1260 V830 H1400 V790 H1440 V840 H1600 V1000 Z")
win = "".join(f'<rect x="{x}" y="{y}" width="8" height="16" fill="#f3b54a" opacity="{o}"/>' for x, y, o in [(612, 610, .9), (1050, 680, .5), (255, 720, .35)])
out['gloamreach'] = doc(["Cinzel:wght@700", "Cormorant+Garamond:ital,wght@1,500"], f'''
<rect width="1600" height="1000" fill="url(#gbg)"/>
<circle cx="800" cy="310" r="230" fill="#ffc75e" opacity=".22" filter="url(#glow)"/>
<g transform="translate(0,1000) scale(1,0.5) translate(0,-1000)"><path d="{castle}" fill="#060504"/>{win}</g>
<rect y="700" width="1600" height="300" fill="url(#fog)"/>
<g transform="translate(800,300)" stroke="#d9a441" stroke-width="7" fill="none" stroke-linejoin="round">
 <path d="M-26,-120 Q0,-150 26,-120"/>
 <path d="M-60,-95 H60 L48,-70 H-48 Z" fill="#1b140b"/>
 <path d="M-48,-70 L-58,70 H58 L48,-70" fill="#2a1c0a"/>
 <path d="M-58,70 H58 L68,95 H-68 Z" fill="#1b140b"/>
 <line x1="0" y1="-70" x2="0" y2="70"/><line x1="-53" y1="0" x2="53" y2="0"/>
</g>
<ellipse cx="800" cy="300" rx="34" ry="46" fill="#ffd27a" filter="url(#soft)"/>
<path d="M800,330 C780,312 786,290 800,268 C806,288 822,294 812,316 C818,308 822,300 820,292 C830,306 824,324 800,330 Z" fill="#fff1c4"/>
{T(640, "GLOAMREACH", "Cinzel", 132, "#f1b84d", 700, 12, extra='filter="url(#soft)" opacity=".55"')}
{T(640, "GLOAMREACH", "Cinzel", 132, "url(#gold)", 700, 12)}
{T(712, "The things in the dark were people once.", "Cormorant Garamond", 44, "#bba57c", 500, 0, "italic")}''',
'''<radialGradient id="gbg" cx=".5" cy=".32" r=".75"><stop offset="0" stop-color="#3b2a12"/><stop offset=".55" stop-color="#140f09"/><stop offset="1" stop-color="#070605"/></radialGradient>
<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa3a8" stop-opacity="0"/><stop offset="1" stop-color="#9aa3a8" stop-opacity=".16"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3a0"/><stop offset="1" stop-color="#c08a2e"/></linearGradient>''')

# ---------------------------------------------------------------- Office Hours
eqs = [("H|ψ⟩ = E|ψ⟩", 230, 170, -6), ("∇·E = ρ/ε₀", 1340, 160, 5), ("ΔxΔp ≥ ħ/2", 250, 880, 4), ("F = ma", 1360, 860, -5),
       ("e^iπ + 1 = 0", 1300, 520, -3), ("PV = nRT", 260, 520, 4), ("E = mc²", 560, 910, -2), ("∮B·dl = μ₀I", 1040, 920, 3)]
eqt = "".join(f'<text x="{x}" y="{y}" font-family="Caveat" font-size="58" fill="#f4efe4" opacity=".10" transform="rotate({r} {x} {y})" text-anchor="middle">{t}</text>' for t, x, y, r in eqs)
ticks = "".join(f'<line x1="0" y1="-112" x2="0" y2="{-96 if i % 3 else -88}" stroke="#2a3d36" stroke-width="{4 if i % 3 else 8}" transform="rotate({i*30})"/>' for i in range(12))
out['office-hours'] = doc(["Caveat:wght@700", "Inter:wght@500"], f'''
<rect width="1600" height="1000" fill="url(#obg)"/>{eqt}
<rect x="14" y="14" width="1572" height="972" fill="none" stroke="#7a4f2c" stroke-width="28"/>
<rect x="28" y="28" width="1544" height="944" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="4"/>
<g transform="translate(800,310)">
 <circle r="140" fill="#000" opacity=".25" transform="translate(6,10)"/>
 <circle r="140" fill="#f4efe4" stroke="#b89a64" stroke-width="12"/>{ticks}
 <ellipse rx="44" ry="16" fill="none" stroke="#3aa7d6" stroke-width="4" opacity=".55" transform="translate(0,52) rotate(20)"/>
 <ellipse rx="44" ry="16" fill="none" stroke="#3aa7d6" stroke-width="4" opacity=".55" transform="translate(0,52) rotate(-20)"/>
 <line x1="0" y1="0" x2="0" y2="-82" stroke="#1f3a33" stroke-width="10" stroke-linecap="round" transform="rotate(60)"/>
 <line x1="0" y1="0" x2="0" y2="-108" stroke="#1f3a33" stroke-width="6" stroke-linecap="round"/>
 <circle r="11" fill="#c0392b"/>
</g>
{T(660, "Office Hours", "Caveat", 190, "#f6f1e6", 700, 2)}
{T(740, "RUN A PHYSICS LAB FROM BEHIND YOUR DESK", "Inter", 30, "#b5ccc1", 500, 6)}''',
'<radialGradient id="obg" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#2b4c43"/><stop offset="1" stop-color="#162b25"/></radialGradient>')

# ---------------------------------------------------------------- Iron Banners
hexes = ""
for r in range(14):
    for c in range(20):
        x = c * 90 + (45 if r % 2 else 0); y = r * 78
        pts = " ".join(f"{x+46*math.cos(math.radians(60*k+30)):.1f},{y+46*math.sin(math.radians(60*k+30)):.1f}" for k in range(6))
        hexes += f'<polygon points="{pts}"/>'
out['iron-banners'] = doc(["Cinzel:wght@800", "Cormorant+SC:wght@600"], f'''
<rect width="1600" height="1000" fill="url(#ibg)"/>
<g fill="none" stroke="#ffffff" stroke-opacity=".04" stroke-width="2">{hexes}</g>
<g transform="translate(800,330)">
 <g transform="rotate(-24)"><line x1="0" y1="120" x2="0" y2="-200" stroke="#8d8f94" stroke-width="12" stroke-linecap="round"/>
  <path d="M-6,-190 H-170 L-130,-140 L-170,-90 H-6 Z" fill="#b3261e"/><circle cx="0" cy="-206" r="12" fill="#c9cbd0"/></g>
 <g transform="rotate(24)"><line x1="0" y1="120" x2="0" y2="-200" stroke="#8d8f94" stroke-width="12" stroke-linecap="round"/>
  <path d="M6,-190 H170 L130,-140 L170,-90 H6 Z" fill="#2a4d8f"/><circle cx="0" cy="-206" r="12" fill="#c9cbd0"/></g>
 <circle r="78" fill="#3a3e46" stroke="#a7aab0" stroke-width="10"/>
 <circle r="54" fill="none" stroke="#6b6f78" stroke-width="4"/>
 <circle r="16" fill="#c9cbd0"/>
</g>
{T(680, "IRON BANNERS", "Cinzel", 122, "#ece7de", 800, 14)}
{rules(745, "#b3261e", 220, 360)}
{T(757, "Five ages of war on one table", "Cormorant SC", 44, "#b2aa9c", 600, 3)}''',
'<linearGradient id="ibg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#30343c"/><stop offset="1" stop-color="#131518"/></linearGradient>')

# ---------------------------------------------------------------- Ticker Tycoon
random.seed(7); price = 920; candles = ""; line = []
for i in range(22):
    x = 90 + i * 68; o = price; c = price - random.uniform(-12, 62)
    hi = min(o, c) - random.uniform(8, 30); lo = max(o, c) + random.uniform(8, 30)
    col = "#34c47c" if c < o else "#e5534b"
    candles += (f'<line x1="{x}" y1="{hi:.0f}" x2="{x}" y2="{lo:.0f}" stroke="{col}" stroke-width="4"/>'
                f'<rect x="{x-17}" y="{min(o, c):.0f}" width="34" height="{max(6, abs(o-c)):.0f}" fill="{col}"/>')
    line.append(f"{x},{c:.0f}"); price = c
grid = "".join(f'<line x1="0" y1="{y}" x2="1600" y2="{y}"/>' for y in range(100, 1000, 100)) + "".join(f'<line x1="{x}" y1="0" x2="{x}" y2="1000"/>' for x in range(100, 1600, 100))
tape = [("AAPL", "▲ 1.24%", "#34c47c"), ("NVDA", "▲ 3.10%", "#34c47c"), ("TSLA", "▼ 0.82%", "#e5534b"), ("MSFT", "▲ 0.57%", "#34c47c"),
        ("AMZN", "▼ 1.05%", "#e5534b"), ("META", "▲ 2.21%", "#34c47c"), ("GOOGL", "▲ 0.44%", "#34c47c")]
tt = "".join(f'<tspan fill="#cfd9ea">{s} </tspan><tspan fill="{c}">{v}</tspan><tspan>     </tspan>' for s, v, c in tape)
out['ticker-tycoon'] = doc(["Space+Grotesk:wght@700", "IBM+Plex+Mono:wght@500", "Inter:wght@500"], f'''
<rect width="1600" height="1000" fill="url(#tbg)"/>
<g stroke="#ffffff" stroke-opacity=".035" stroke-width="2">{grid}</g>
<g opacity=".55">{candles}</g>
<polyline points="{' '.join(line)}" fill="none" stroke="#34c47c" stroke-width="5" opacity=".5" filter="url(#soft)"/>
<rect x="0" y="380" width="1600" height="320" fill="url(#band)"/>
{T(560, "TICKER TYCOON", "Space Grotesk", 138, "#f1f6ff", 700, 6)}
{T(640, "Trade your way from a small stake to a fortune", "Inter", 38, "#93a8c6", 500)}
<rect x="0" y="840" width="1600" height="84" fill="#0b1626" stroke="#1d2b44" stroke-width="2"/>
<text x="40" y="894" font-family="IBM Plex Mono" font-size="32" font-weight="500" xml:space="preserve">{tt}</text>''',
'''<linearGradient id="tbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101d33"/><stop offset="1" stop-color="#08111f"/></linearGradient>
<linearGradient id="band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1729" stop-opacity="0"/><stop offset=".35" stop-color="#0c1729" stop-opacity=".7"/><stop offset=".65" stop-color="#0c1729" stop-opacity=".7"/><stop offset="1" stop-color="#0c1729" stop-opacity="0"/></linearGradient>''')


# ---------------------------------------------------------------- Quiz Maze
def sq(h, gap_side, gap=56):
    """A square of half-size h with a doorway on one side (0 top, 1 right, 2 bottom, 3 left)."""
    P = [(-h, -h), (h, -h), (h, h), (-h, h)]
    segs = []
    for s in range(4):
        a = P[s]; b = P[(s + 1) % 4]
        if s == gap_side:
            mx = (a[0] + b[0]) / 2; my = (a[1] + b[1]) / 2
            dx = (b[0] - a[0]) / abs(b[0] - a[0]) if b[0] != a[0] else 0
            dy = (b[1] - a[1]) / abs(b[1] - a[1]) if b[1] != a[1] else 0
            segs.append(f"M{a[0]},{a[1]} L{mx-dx*gap/2},{my-dy*gap/2}")
            segs.append(f"M{mx+dx*gap/2},{my+dy*gap/2} L{b[0]},{b[1]}")
        else:
            segs.append(f"M{a[0]},{a[1]} L{b[0]},{b[1]}")
    return " ".join(segs)


maze = " ".join([sq(180, 0), sq(130, 2), sq(80, 1), sq(34, 3, 30)])
spokes = "M-40,-180 V-130 M130,40 H180 M-80,-30 H-130 M30,80 V130"
gridq = "".join(f'<line x1="{x}" y1="0" x2="{x}" y2="1000"/>' for x in range(0, 1600, 50)) + "".join(f'<line x1="0" y1="{y}" x2="1600" y2="{y}"/>' for y in range(0, 1000, 50))
out['quiz-maze'] = doc(["Space+Grotesk:wght@700", "Inter:wght@500"], f'''
<rect width="1600" height="1000" fill="url(#qbg)"/>
<g opacity=".06" stroke="#ffffff" stroke-width="2">{gridq}</g>
<g transform="translate(800,320)">
 <path d="{maze} {spokes}" fill="none" stroke="#b9afff" stroke-width="16" stroke-linecap="square"/>
 <path d="M0,-225 V-155 H-155 V155 H0 V105 H105 V-105 H-55 V55 H55 V0 H0" fill="none" stroke="#f2c94c" stroke-width="6" stroke-dasharray="2 16" stroke-linecap="round"/>
 <circle cx="0" cy="0" r="34" fill="#f2c94c" opacity=".3" filter="url(#soft)"/><circle cx="0" cy="0" r="16" fill="#f2c94c"/>
</g>
{T(680, "QUIZ MAZE", "Space Grotesk", 138, "#f3f1ff", 700, 10)}
{T(755, "Physics GRE practice, one step at a time", "Inter", 38, "#aca6da", 500)}''',
'<radialGradient id="qbg" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#352c70"/><stop offset="1" stop-color="#161230"/></radialGradient>')

# ---------------------------------------------------------------- Rydberg Lattice
atoms = ""; excited = {(2, 1), (5, 3), (8, 0), (1, 4), (9, 2)}
for i in range(11):
    for j in range(5):
        x = 450 + i * 70; y = 150 + j * 70
        if (i, j) in excited:
            atoms += f'<circle cx="{x}" cy="{y}" r="30" fill="#7fdcff" opacity=".45" filter="url(#soft)"/><circle cx="{x}" cy="{y}" r="13" fill="#d8f6ff"/>'
        else:
            atoms += f'<circle cx="{x}" cy="{y}" r="8" fill="#3aa7d6" opacity=".55"/>'
out['rydberg-lattice'] = doc(["Sora:wght@700", "Inter:wght@500"], f'''
<rect width="1600" height="1000" fill="url(#rbg)"/>
<circle cx="590" cy="220" r="110" fill="none" stroke="#9fe7ff" stroke-width="3" stroke-dasharray="10 10" opacity=".45"/>
<circle cx="800" cy="360" r="110" fill="none" stroke="#9fe7ff" stroke-width="3" stroke-dasharray="10 10" opacity=".3"/>
{atoms}
{T(670, "RYDBERG LATTICE", "Sora", 104, "#e8f7ff", 700, 6)}
{T(745, "Neutral-atom quantum computing, hands on", "Inter", 38, "#8fbcd8", 500)}''',
'<radialGradient id="rbg" cx=".5" cy=".3" r=".85"><stop offset="0" stop-color="#11324f"/><stop offset="1" stop-color="#06111e"/></radialGradient>')

# ---------------------------------------------------------------- Kerdos
key = 'M0,50 H60 V10 H20 V34 H44 V24'
band = lambda y: "".join(f'<path d="{key}" transform="translate({x},{y})" fill="none" stroke="#d4b040" stroke-width="5" opacity=".45"/>' for x in range(-10, 1610, 70))
out['kerdos'] = doc(["Marcellus", "Cormorant+Garamond:ital,wght@1,500"], f'''
<rect width="1600" height="1000" fill="url(#kbg)"/>
{band(40)}{band(890)}
<g transform="translate(800,330)">
 <circle r="138" fill="url(#coin)" stroke="#8a6d1c" stroke-width="6"/>
 <circle r="116" fill="none" stroke="#7a5f14" stroke-width="3" opacity=".7"/>
 <text y="56" text-anchor="middle" font-family="Marcellus" font-size="160" fill="#5d470c">Κ</text>
</g>
{T(660, "KERDOS", "Marcellus", 142, "#f3e8c4", 400, 30)}
{T(735, "κέρδος · personal finance that stays on your computer", "Cormorant Garamond", 42, "#c7b57d", 500, 0, "italic")}''',
'''<linearGradient id="kbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#13402f"/><stop offset="1" stop-color="#0a231b"/></linearGradient>
<radialGradient id="coin" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#ffe9a3"/><stop offset=".55" stop-color="#d4b040"/><stop offset="1" stop-color="#9c7a1e"/></radialGradient>''')

# ---------------------------------------------------------------- Fetcher
out['fetcher'] = doc(["Space+Grotesk:wght@700", "IBM+Plex+Mono:wght@400;500"], f'''
<rect width="1600" height="1000" fill="url(#fbg)"/>
<text x="400" y="430" font-family="IBM Plex Mono" font-size="380" font-weight="400" fill="#3b82f6" text-anchor="middle">{{</text>
<text x="1200" y="430" font-family="IBM Plex Mono" font-size="380" font-weight="400" fill="#3b82f6" text-anchor="middle">}}</text>
<g font-family="IBM Plex Mono" font-size="34" text-anchor="middle">
 <text x="800" y="200" fill="#7d8db0">10.1038/s41586-026-0421-x</text>
 <text x="800" y="265" fill="#3b82f6" font-size="40">↓</text>
 <text x="800" y="330" fill="#e2e8f0"><tspan fill="#60a5fa">@article</tspan>{{pajak2026,</text>
 <text x="800" y="378" fill="#9aa8c4">title = {{Single rare-earth ions…}},</text>
</g>
{T(640, "Fetcher", "Space Grotesk", 160, "#f8fafc", 700, 2)}
{T(720, "DOI, link or arXiv ID in. Clean BibTeX out.", "IBM Plex Mono", 36, "#93a4c3", 500)}''',
'<radialGradient id="fbg" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#16244a"/><stop offset="1" stop-color="#0b1222"/></radialGradient>')

# ---------------------------------------------------------------- Dewey
out['dewey'] = doc(["Libre+Baskerville:wght@700", "Inter:wght@500", "IBM+Plex+Mono:wght@500"], f'''
<rect width="1600" height="1000" fill="#f3efe4"/>
<rect x="30" y="30" width="1540" height="940" fill="none" stroke="#3d8b6e" stroke-width="3"/>
<rect x="44" y="44" width="1512" height="912" fill="none" stroke="#3d8b6e" stroke-width="1" opacity=".5"/>
<g transform="translate(800,330)">
 <rect x="-150" y="-175" width="300" height="70" rx="4" fill="#fffdf6" stroke="#d8d1bd" stroke-width="3" transform="rotate(-4)"/>
 <line x1="-115" y1="-140" x2="60" y2="-152" stroke="#3d8b6e" stroke-width="5" opacity=".55"/>
 <line x1="-115" y1="-120" x2="20" y2="-130" stroke="#3d8b6e" stroke-width="5" opacity=".35"/>
 <rect x="-190" y="-130" width="380" height="250" rx="12" fill="#2f6e57" stroke="#24543f" stroke-width="6"/>
 <rect x="-120" y="-92" width="240" height="84" rx="4" fill="#f3efe4" stroke="#b08d3c" stroke-width="6"/>
 <text y="-36" text-anchor="middle" font-family="IBM Plex Mono" font-size="40" font-weight="500" fill="#1f2a24">530.12</text>
 <circle cx="0" cy="56" r="26" fill="#c9a24d" stroke="#8e6f27" stroke-width="6"/>
</g>
{T(650, "Dewey", "Libre Baskerville", 150, "#1f2a24", 700, 2)}
{T(725, "Your daily research-paper digest", "Inter", 40, "#56665d", 500)}
{T(790, "ARXIV · JOURNALS · RANKED FOR YOU", "IBM Plex Mono", 28, "#3d8b6e", 500, 5)}''')

for k, v in out.items():
    with open(os.path.join(HERE, f"{k}.svg"), "w", encoding="utf-8") as f:
        f.write(v)
print("wrote", ", ".join(sorted(out)))
