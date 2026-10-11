"""앱 아이콘 만들기: 어두운 둥근 사각형 + VEX 핀 파란 점 4개."""
import pathlib, sys
from PIL import Image, ImageDraw
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
INK, BLUE, LINE = (22, 32, 43), (59, 140, 240), (220, 228, 236)
def mark(size, pad_ratio, bg_full):
    S = size * 4
    im = Image.new('RGBA', (S, S), INK + (255,) if bg_full else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pad = int(S * pad_ratio)
    box = (pad, pad, S - pad, S - pad)
    if not bg_full:
        d.rounded_rectangle(box, radius=int((S - 2 * pad) * 0.22), fill=INK)
    w = S - 2 * pad
    c1, c2 = pad + w * 0.31, pad + w * 0.69
    r = w * 0.105
    d.rectangle((c1, c1, c2, c2), outline=LINE + (140,), width=max(2, int(w * 0.045)))
    for cx in (c1, c2):
        for cy in (c1, c2):
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=BLUE)
    return im.resize((size, size), Image.LANCZOS)
mark(192, 0.04, False).save(out / 'icon-192.png')
mark(512, 0.04, False).save(out / 'icon-512.png')
mark(512, 0.17, True).save(out / 'maskable-512.png')
a = mark(180, 0.0, True); a.save(out / 'apple-touch-icon.png')
mark(32, 0.02, False).save(out / 'favicon-32.png')
print('icons ok')
