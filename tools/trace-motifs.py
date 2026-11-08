"""Sporer strektegnede dørskilt-motiver fra et motivark til vektor (potrace).

Bruk: python3 -I tools/trace-motifs.py <motivark.png/webp> > js/dorskilt-motiver.js

Arket har lys bakgrunn med tynne mørke streker og myke preg-skygger. Strekene hentes
ut med «blackhat» (lukking minus bilde), som tar vare på tynne linjer og fjerner
skyggene. Hvert motiv skaleres til å passe i skiltets motivfelt (104 × 25,7 mm,
midt på (73, 58,85)) og skrives i skiltets mm-koordinater. Krever: opencv, potracer.
"""
import sys, json
import numpy as np, cv2
from PIL import Image
import potrace

# Utsnitt (piksler) i motivarket 21.webp (1535 × 1024)
BOX = {
    'hus': (170, 0, 725, 312), 'blomster': (795, 72, 1512, 278), 'hjerter': (98, 328, 798, 528),
    'hjort': (795, 284, 1512, 532), 'pote': (860, 549, 1474, 779), 'fisk': (95, 769, 784, 1004),
    'eng': (838, 770, 1470, 1009),
}
FIELD = {'cx': 73, 'cy': 58.85, 'w': 104, 'h': 25.7}
UP = 2

im = Image.open(sys.argv[1]).convert('RGBA')
bg = Image.new('RGBA', im.size, 'white'); bg.alpha_composite(im)
gray = np.asarray(bg.convert('L'))

def strokes(crop):
    c = cv2.resize(crop, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
    bh = cv2.morphologyEx(c, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9 * UP, 9 * UP)))
    bh = cv2.GaussianBlur(bh, (3, 3), 0)
    m = (bh > 38).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.isin(lab, [i for i in range(1, n) if st[i, 4] >= 25 * UP * UP])
    return keep

f = lambda v: format(round(v, 2), 'g')
print('// GENERERT av tools/trace-motifs.py fra motivarket. Koordinater i mm på skiltet (146 × 96), fyllregel evenodd.')
print('window.DoorSignTraced = window.DoorSignTraced || {};')
for name, (x0, y0, x1, y1) in BOX.items():
    ink = strokes(gray[y0:y1, x0:x1])
    ys, xs = np.where(ink)
    bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    s = min(FIELD['w'] / (bx1 - bx0), FIELD['h'] / (by1 - by0))      # mm per piksel
    ox, oy = FIELD['cx'] - (bx0 + bx1) / 2 * s, FIELD['cy'] - (by0 + by1) / 2 * s
    mm = lambda p: (ox + p.x * s, oy + p.y * s)
    plist = potrace.Bitmap(~ink).trace(turdsize=6, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
                                       alphamax=1.0, opticurve=True, opttolerance=0.2)
    d = []
    for curve in plist:
        sx, sy = mm(curve.start_point); d.append(f'M{f(sx)} {f(sy)}')
        for seg in curve.segments:
            ex, ey = mm(seg.end_point)
            if seg.is_corner:
                cx_, cy_ = mm(seg.c); d.append(f'L{f(cx_)} {f(cy_)} {f(ex)} {f(ey)}')
            else:
                (ax, ay), (bx, by) = mm(seg.c1), mm(seg.c2)
                d.append(f'C{f(ax)} {f(ay)} {f(bx)} {f(by)} {f(ex)} {f(ey)}')
        d.append('Z')
    path = ''.join(d)
    print(f'window.DoorSignTraced[{json.dumps(name)}] = {json.dumps(path)};')
    print(f'{name}: {len(plist)} konturer, {len(path)} tegn, {(bx1-bx0)*s:.1f} × {(by1-by0)*s:.1f} mm', file=sys.stderr)
