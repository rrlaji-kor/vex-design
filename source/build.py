#!/usr/bin/env python3
"""src/* 를 하나의 HTML 페이지로 합친다."""
import base64, pathlib

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
JS = ["data.js", "model.js", "analysis.js", "view3d.js", "view2d.js", "store.js", "backend_claude.js", "ui.js", "guide.js", "main.js"]

def data_uri(p):
    return "data:image/jpeg;base64," + base64.b64encode((ROOT / "assets" / p).read_bytes()).decode()

head = """<title>VEX IQ 로봇 설계</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">
"""
css = (SRC / "styles.css").read_text()
body = (SRC / "body.html").read_text()
js = "\n".join((SRC / f).read_text() for f in JS)
consts = f'const FACE_PHOTOS = {{ A: "{data_uri("faceA.jpg")}", B: "{data_uri("faceB.jpg")}" }};\n'

html = (head + "<style>\n" + css + "</style>\n" + body +
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n'
        "<script>\n" + consts + js + "\n</script>\n")
out = ROOT / "dist" / "vex-design.html"
out.write_text(html)
skel = ('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}'
        'img{max-width:100%}[hidden]{display:none!important}</style></head><body>')
(ROOT / "dist" / "preview.html").write_text(skel + html + "</body></html>")
print(out, len(html.encode()), "bytes")
