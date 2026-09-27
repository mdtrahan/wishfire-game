from html import escape
from pathlib import Path

from diagram_specs import COLORS, DIAGRAMS

W, H = 800, 440


def t(x, y, text, size=14, weight=400, anchor="start", fill=None):
    return f'<text x="{x}" y="{y}" font-family="Arial, sans-serif" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="{fill or COLORS["ink"]}">{escape(text)}</text>'


def line(x1, y1, x2, y2, stroke=None, width=2, arrow=True, dash=None):
    attrs = f'stroke="{stroke or COLORS["ink"]}" stroke-width="{width}" fill="none"'
    if arrow:
        attrs += ' marker-end="url(#arrow)"'
    if dash:
        attrs += f' stroke-dasharray="{dash}"'
    return f'<path d="M{x1},{y1} L{x2},{y2}" {attrs}/>'


def node(x, y, w, h, title, body, color):
    c = COLORS[color]
    return "".join([
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{COLORS["paper2"]}" stroke="{c}" stroke-width="3"/>',
        f'<rect x="{x}" y="{y}" width="8" height="{h}" fill="{c}"/>',
        t(x + 18, y + 27, title, 13, 700),
        t(x + 18, y + 49, body, 10, 400, fill=COLORS["muted"]),
    ])


def base(name, spec, content):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="{name}-title {name}-desc">
<title id="{name}-title">{escape(spec['title'])}</title>
<desc id="{name}-desc">{escape(spec['desc'])}</desc>
<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="{COLORS['ink']}"/></marker></defs>
<rect width="800" height="440" fill="{COLORS['paper']}"/>
{content}
</svg>'''


def render(name, spec):
    kind = spec["kind"]
    out = [t(28, 30, spec["title"], 18, 700), t(28, 52, spec["desc"], 10, 400, fill=COLORS["muted"])]
    if kind == "loop":
        nodes = spec["nodes"]
        for i, (x, y, *_rest) in enumerate(nodes):
            nx, ny, *_ = nodes[(i + 1) % len(nodes)]
            dx, dy = nx - x, ny - y
            length = max((dx * dx + dy * dy) ** 0.5, 1)
            out.append(line(x + dx / length * 55, y + dy / length * 55, nx - dx / length * 55, ny - dy / length * 55, width=2))
        for x, y, title, body, color in nodes:
            out.append(f'<circle cx="{x}" cy="{y}" r="54" fill="{COLORS["paper2"]}" stroke="{COLORS[color]}" stroke-width="4"/>')
            out.append(t(x, y - 5, title, 12, 700, "middle"))
            words = body.split()
            cut = max(1, (len(words) + 1) // 2)
            for j, row in enumerate([" ".join(words[:cut]), " ".join(words[cut:])]):
                if row:
                    out.append(t(x, y + 14 + j * 12, row, 7.5, 400, "middle", COLORS["muted"]))
        cx, cy = spec["center"]
        out.append(f'<circle cx="{cx}" cy="{cy}" r="90" fill="{COLORS["ink"]}"/>')
        for j, s in enumerate(spec["hub"]):
            edge = j in {0, len(spec["hub"]) - 1}
            out.append(t(cx, cy - 44 + j * 22, s, 11 if j == 0 else 7.5, 700 if edge else 400, "middle", COLORS["cyan"] if j == len(spec["hub"]) - 1 else COLORS["paper2"]))
    elif kind == "pipeline":
        nodes = spec["nodes"]
        for i in range(len(nodes) - 1):
            x, y, w, h, *_ = nodes[i]; nx, ny, *_ = nodes[i + 1]
            out.append(line(x + w, y + h / 2, nx, ny + h / 2))
        for n in nodes: out.append(node(*n))
        if spec.get("timeline"):
            out.append(t(60, 263, "EXAMPLE: 1.2 SECOND HERO CADENCE", 9, 700, fill=COLORS["cyan"]))
            y = 300; out.append(line(60, y, 740, y, width=2, arrow=False))
            for sec, label in spec["timeline"]:
                x = 60 + (sec / 1.2) * 680
                out.append(f'<circle cx="{x}" cy="{y}" r="6" fill="{COLORS["paper2"]}" stroke="{COLORS["ink"]}" stroke-width="2"/>')
                out.append(t(x, y - 20, label, 9, 700, "middle")); out.append(t(x, y + 25, f'{sec:.2f}s', 9, 400, "middle", COLORS["muted"]))
    elif kind == "comparison":
        out.append(t(65, 92, spec["left_title"], 12, 700, fill=COLORS["rose"]))
        out.append(t(455, 92, spec["right_title"], 12, 700, fill=COLORS["green"]))
        out.append(line(390, 105, 410, 105, stroke=COLORS["violet"], width=3))
        for side, x, color in [(spec["left"], 65, "rose"), (spec["right"], 455, "green")]:
            for i, item in enumerate(side, 1):
                y = 130 + (i - 1) * 55
                out.append(f'<circle cx="{x + 14}" cy="{y - 5}" r="13" fill="{COLORS[color]}"/>')
                out.append(t(x + 14, y - 1, str(i), 9, 700, "middle", COLORS["paper2"]))
                out.append(t(x + 38, y, item, 11, 400))
    elif kind == "stack":
        layers = spec["layers"]
        bw = 620; bh = 42
        for i, (title, body, color) in enumerate(layers):
            x = 90 + i * 10; y = 78 + i * 47; w = bw - i * 20
            out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{bh}" fill="{COLORS["paper2"]}" stroke="{COLORS[color]}" stroke-width="2"/>')
            out.append(t(x + 16, y + 26, title, 11, 700)); out.append(t(x + 165, y + 26, body, 10, 400, fill=COLORS["muted"]))
    elif kind == "branch":
        ns = spec["nodes"]
        for i in range(3):
            x, y, w, h, *_ = ns[i]; nx, ny, *_ = ns[i + 1]
            out.append(line(x + w, y + h / 2, nx, ny + h / 2))
        x, y, w, h, *_ = ns[3]
        for target in ns[4:]:
            nx, ny, *_ = target
            out.append(f'<path d="M{x+w},{y+h/2} H575 V{ny+32} H{nx}" stroke="{COLORS["ink"]}" stroke-width="2" fill="none" marker-end="url(#arrow)"/>')
        for n in ns: out.append(node(*n))
    elif kind == "timeline":
        y = 220; out.append(line(70, y, 740, y, width=3, arrow=False))
        phases = spec["phases"]
        for i, (pid, title, body, color) in enumerate(phases):
            x = 90 + i * 126
            out.append(f'<circle cx="{x}" cy="{y}" r="23" fill="{COLORS[color]}" stroke="{COLORS["ink"]}" stroke-width="2"/>')
            out.append(t(x, y + 4, pid, 11, 700, "middle", COLORS["paper2"]))
            out.append(t(x, y - 52, title, 10, 700, "middle"))
            for j, row in enumerate(body.split("|")):
                out.append(t(x, y + 55 + j * 11, row, 6.5, 400, "middle", COLORS["muted"]))
        out.append(t(90 + 2 * 126, 345, "FIRST GO / NO-GO", 10, 700, "middle", COLORS["gold"]))
    return base(name, spec, "\n".join(out))


def main():
    out = Path(__file__).parent / "diagrams"
    out.mkdir(exist_ok=True)
    for name, spec in DIAGRAMS.items():
        (out / f"{name}.svg").write_text(render(name, spec))
        print(out / f"{name}.svg")


if __name__ == "__main__":
    main()
