# Lager produktbilde av en flis i ramme på veggen fra et ferdig motiv.
# Bruk: python3 tools/make-mockup.py <rammefoto.jpg> <motiv.png> <ut.jpg>
# Rammefotoet er bildet av HYTTA-flisen i sort ramme. Hjørnene på den graverte
# kantlinjen (dst under) er målt i det fotoet (1506x2000). Bruker du et annet foto,
# må de måles på nytt.
import sys, numpy as np
from PIL import Image, ImageFilter
photo = Image.open(sys.argv[1]).convert('RGB')
P = np.asarray(photo).astype(np.float32)
H_, W_ = P.shape[:2]

# Kantlinjens hjørner i bildet (målt), og hvor de ligger på flisa (innfelt i)
i = 0.028
dst = np.array([[224,505],[1269.4,487.5],[1263.6,1514.3],[254.6,1524.7]], float)
src = np.array([[i,i],[1-i,i],[1-i,1-i],[i,1-i]], float)
def homography(a, b):
    A=[]
    for (x,y),(u,v) in zip(a,b):
        A.append([x,y,1,0,0,0,-u*x,-u*y,-u]); A.append([0,0,0,x,y,1,-v*x,-v*y,-v])
    _,_,Vt=np.linalg.svd(np.array(A)); return Vt[-1].reshape(3,3)/Vt[-1][-1]
Hinv = homography(dst, src)   # bilde (x,y) -> flis (u,v)
Hfwd = homography(src, dst)
corners = np.array([[0,0],[1,0],[1,1],[0,1]],float)
q = np.c_[corners, np.ones(4)] @ Hfwd.T; q = q[:,:2]/q[:,2:]
print('flisa hjørner i bildet', q.round(1))

ys, xs = np.mgrid[0:H_, 0:W_].astype(np.float32)
pts = np.stack([xs, ys, np.ones_like(xs)], -1) @ Hinv.T
U = pts[...,0]/pts[...,2]; V = pts[...,1]/pts[...,2]
# myk maske for flatene (ca. 1 px kant)
px = 1/1080
m = np.clip(np.minimum.reduce([U, V, 1-U, 1-V])/px + 0.5, 0, 1)

# Ren flate: fjern gravering (min-filter) og glatt ut belysningen
# Finn graverte (lyse) piksler og fyll dem inn med flaten rundt (normalisert uskarphet).
L = np.asarray(photo.convert('L')).astype(np.float32)
bg = np.asarray(photo.convert('L').filter(ImageFilter.MedianFilter(21))).astype(np.float32)
eng = (L > bg + 22).astype(np.uint8) * 255
eng = np.asarray(Image.fromarray(eng).filter(ImageFilter.MaxFilter(5))).astype(np.float32) / 255
keep = 1 - eng
def _box(a, r, axis):
    a = np.swapaxes(a, 0, axis)
    pad = np.concatenate([np.repeat(a[:1], r+1, 0), a, np.repeat(a[-1:], r, 0)])
    c = np.cumsum(pad, 0, dtype=np.float64)
    out = (c[2*r+1:] - c[:-2*r-1]) / (2*r+1)
    return np.swapaxes(out.astype(np.float32), 0, axis)
def gaussian_filter(a, sigma):
    r = max(1, int(round(sigma * 0.85)))
    for _ in range(3):
        a = _box(_box(a, r, 0), r, 1)
    return a
def nblur(r):
    den = gaussian_filter(keep, r)
    num = np.stack([gaussian_filter(P[...,c]*keep, r) for c in range(3)], -1)
    return num / np.maximum(den, 1e-4)[..., None]
fine = nblur(4)
coarse = np.asarray(photo.filter(ImageFilter.MinFilter(17)).filter(ImageFilter.GaussianBlur(30))).astype(np.float32)
edge = np.minimum.reduce([U, V, 1-U, 1-V])
w = np.clip((edge - 0.02) / 0.05, 0, 1)[..., None]
S = fine*(1-w) + coarse*w

def render(design_path, out_path, seed):
    d = Image.open(design_path).convert('L')
    N = 1100      # oppløsning flisa samples i
    NL = 2362     # laserens oppløsning: 20 cm ved 300 DPI (prikkene lages her)
    d = np.asarray(d.resize((NL, NL), Image.LANCZOS)).astype(np.float32)/255
    rng = np.random.default_rng(seed)
    dots = (d**1.15 > rng.random(d.shape)).astype(np.float32)        # stokastisk stipple som laseren
    dots = np.maximum(dots, (d > 0.93).astype(np.float32))           # helt hvite flater (tekst) blir hele
    # Prikker i laserens oppløsning, skalert ned til fotoets: fine detaljer i ansikter beholdes
    dimg = Image.fromarray((dots*255).astype(np.uint8)).resize((N, N), Image.BOX).filter(ImageFilter.GaussianBlur(0.4))
    D = np.asarray(dimg).astype(np.float32)/255
    # sample med bilineær interpolasjon
    uu = np.clip(U*(N-1), 0, N-1); vv = np.clip(V*(N-1), 0, N-1)
    x0 = np.floor(uu).astype(int); y0 = np.floor(vv).astype(int)
    x1 = np.minimum(x0+1, N-1); y1 = np.minimum(y0+1, N-1); fx = uu-x0; fy = vv-y0
    val = (D[y0,x0]*(1-fx)+D[y0,x1]*fx)*(1-fy) + (D[y1,x0]*(1-fx)+D[y1,x1]*fx)*fy
    dot_col = np.array([212, 210, 204], np.float32)
    tile = S + (dot_col - S) * val[...,None]
    out = P*(1-m[...,None]) + tile*m[...,None]
    img = Image.fromarray(np.clip(out,0,255).astype(np.uint8))
    img.save(out_path, quality=92)
    # kvadratisk produktbilde sentrert på flisa
    cy = int(q[:,1].mean()); top = max(0, min(H_-W_, cy - W_//2))
    img.crop((0, top, W_, top+W_)).save(out_path.replace('.jpg','-kvadrat.jpg'), quality=92)

render(sys.argv[2], sys.argv[3], 1)
print('Skrev', sys.argv[3], 'og', sys.argv[3].replace('.jpg', '-kvadrat.jpg'))
