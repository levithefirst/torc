"""Generate the Torc mark SVGs from one geometry (viewBox 0 0 64 64).
A thick ring split into 5 iris-slanted segments, open at the bottom where two round
finials sit side by side. Flat fills only. Run: python3 tools/make_mark.py"""
import math, os

CX, CY = 32.0, 28.5
R, r = 23.5, 14.5          # outer / inner radius
START, END = 124.0, 416.0   # ring span in SVG degrees (0 = right, 90 = down); opening at the bottom
GAP = 12.0                  # angular gap between segments (at the outer edge)
SKEW = 20.0                 # iris twist: inner edge lags the outer edge by this many degrees
DOT_R = 4.6
DOTS = [(CX - 6.2, 53.6), (CX + 6.2, 53.6)]

def pt(rad, deg):
    a = math.radians(deg)
    return CX + rad * math.cos(a), CY + rad * math.sin(a)

def seg(a0, a1, first, last):
    # Outer edge a0->a1; inner edge shifted by SKEW except at the open ends (kept radial).
    i0 = a0 if first else a0 + SKEW
    i1 = a1 if last else a1 + SKEW
    o0, o1 = pt(R, a0), pt(R, a1)
    n1, n0 = pt(r, i1), pt(r, i0)
    large_o = 1 if (a1 - a0) > 180 else 0
    large_i = 1 if (i1 - i0) > 180 else 0
    f = lambda p: f"{p[0]:.2f} {p[1]:.2f}"
    return (f"M{f(o0)} A{R} {R} 0 {large_o} 1 {f(o1)} L{f(n1)} "
            f"A{r} {r} 0 {large_i} 0 {f(n0)} Z")

def paths():
    n = 5
    span = (END - START - GAP * (n - 1)) / n
    out = []
    for k in range(n):
        a0 = START + k * (span + GAP)
        out.append(seg(a0, a0 + span, k == 0, k == n - 1))
    return out

def mark_group(fill, stroke_round=True):
    # A thin same-colour round-join stroke softens every corner (rounded terminals).
    sw = 1.2 if stroke_round else 0
    segs = "".join(f'<path d="{d}"/>' for d in paths())
    dots = "".join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{DOT_R}"/>' for x, y in DOTS)
    return (f'<g fill="{fill}" stroke="{fill}" stroke-width="{sw}" stroke-linejoin="round">'
            f'{segs}{dots}</g>')

def svg(body, w=64, h=64, bg=None, rx=0):
    rect = f'<rect width="{w}" height="{h}" rx="{rx}" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-label="Torc">{rect}{body}</svg>\n')

GOLD, INK, INK_LIGHT, WHITE = '#CFA354', '#100E0B', '#1A1711', '#FFFFFF'
os.makedirs('public/brand', exist_ok=True)
W = {
  'torc-mark.svg': svg(mark_group('currentColor')).replace('<svg ', '<svg style="color:#CFA354" ', 1),
  'torc-mark-gold.svg': svg(mark_group(GOLD), bg=INK, rx=12),
  'torc-mark-ink.svg': svg(mark_group(INK_LIGHT)),
  'torc-mark-mono-white.svg': svg(mark_group(WHITE)),
}
lock = (mark_group(GOLD) +
        f'<text x="74" y="44" font-family="Geist, Inter, system-ui, sans-serif" font-weight="700" '
        f'font-size="38" letter-spacing="-1.5" fill="{GOLD}">torc</text>')
W['torc-lockup.svg'] = svg(lock, w=170, h=64)
for name, s in W.items():
    open(os.path.join('public/brand', name), 'w').write(s)
open('src/app/icon.svg', 'w').write(W['torc-mark-gold.svg'])
print('wrote', ', '.join(W))
