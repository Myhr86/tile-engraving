"""Gjør et motiv i et rasterbilde om til vektor (potrace) i skiltets mm-koordinater.

Bruk: python3 tools/trace-motif.py <bilde.png/webp> <x0> <y0> <x1> <y1> <navn> > js/dorskilt-motiv-<navn>.js

Bildet antas å være hele skiltflaten (146 × 96 mm), som originaldesignet. Utsnittet
(x0..x1, y0..y1 i piksler) spores, og kurvene skrives i mm, med samme plassering som
i originalen. Krever: pip install potracer
"""
import sys, json
import numpy as np
from PIL import Image
import potrace

src, x0, y0, x1, y1, name = sys.argv[1], *map(int, sys.argv[2:6]), sys.argv[6]
im = Image.open(src)
a = np.asarray(im.convert('RGBA')).astype(int)
ink = (a[..., 3] > 128) & ((a[..., :3] @ [0.299, 0.587, 0.114]) < 128)

# Innholdets midtpunkt i hele bildet -> plassering midt på skiltet
ys, xs = np.where(ink)
cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
PLATE_W, PLATE_H = 146, 96
s = im.width / PLATE_W                     # piksler per mm
to_mm = lambda pt: (PLATE_W / 2 + (pt[0] - cx) / s, PLATE_H / 2 + (pt[1] - cy) / s) if isinstance(pt, (tuple, list)) else (PLATE_W / 2 + (pt.x - cx) / s, PLATE_H / 2 + (pt.y - cy) / s)

crop = np.zeros_like(ink); crop[y0:y1, x0:x1] = ink[y0:y1, x0:x1]
bm = potrace.Bitmap(~crop)   # potracer sporer «mørke» (False) piksler
plist = bm.trace(turdsize=3, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=True, opttolerance=0.2)

f = lambda v: format(round(v, 3), 'g')
d = []
for curve in plist:
    sx, sy = to_mm(curve.start_point)
    d.append(f'M{f(sx)} {f(sy)}')
    for seg in curve.segments:
        ex, ey = to_mm(seg.end_point)
        if seg.is_corner:
            cxp, cyp = to_mm(seg.c)
            d.append(f'L{f(cxp)} {f(cyp)} L{f(ex)} {f(ey)}')
        else:
            (ax, ay), (bx, by) = to_mm(seg.c1), to_mm(seg.c2)
            d.append(f'C{f(ax)} {f(ay)} {f(bx)} {f(by)} {f(ex)} {f(ey)}')
    d.append('Z')
path = ''.join(d)
print('// GENERERT av tools/trace-motif.py fra originaldesignet. Koordinater i mm på skiltet (146 × 96).')
print(f'window.DoorSignTraced = window.DoorSignTraced || {{}};')
print(f'window.DoorSignTraced[{json.dumps(name)}] = {json.dumps(path)};')
print(f'// {len(plist)} konturer, {len(path)} tegn, skala {s:.3f} px/mm, innholdssenter ({cx:.1f}, {cy:.1f}) px', file=sys.stderr)
