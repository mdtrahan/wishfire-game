from pathlib import Path
from math import atan2, cos, sin, pi

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from diagram_specs import COLORS, DIAGRAMS

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT.parent / "wishfire-idle-stage-migration-atlas-redesigned.pdf"
ASSETS = ROOT / "assets"
W, H = landscape(A4)

PAPER = HexColor(COLORS["paper"])
PAPER2 = HexColor(COLORS["paper2"])
INK = HexColor(COLORS["ink"])
MUTED = HexColor(COLORS["muted"])
RULE = HexColor(COLORS["rule"])
ACCENT = {k: HexColor(v) for k, v in COLORS.items() if k not in {"paper", "paper2", "ink", "muted", "rule"}}

FONT_DIR = Path("/System/Library/Fonts/Supplemental")
pdfmetrics.registerFont(TTFont("AtlasSans", str(FONT_DIR / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("AtlasSansBold", str(FONT_DIR / "Arial Bold.ttf")))
pdfmetrics.registerFont(TTFont("AtlasSerif", str(FONT_DIR / "Georgia.ttf")))
pdfmetrics.registerFont(TTFont("AtlasSerifBold", str(FONT_DIR / "Georgia Bold.ttf")))


def rgb(c):
    return c


def top_y(top):
    return H - top


def set_font(c, name="AtlasSans", size=9, color=INK):
    c.setFont(name, size)
    c.setFillColor(color)


def label(c, text, x, top, color=ACCENT["cyan"], size=7.3):
    c.setFillColor(color)
    tx = c.beginText(x, top_y(top))
    tx.setFont("AtlasSansBold", size)
    tx.setCharSpace(1.2)
    tx.textLine(text.upper())
    c.drawText(tx)


def draw_title(c, title, subtitle, section, folio):
    label(c, section, 38, 30)
    title_size = min(26, 26 * 690 / max(690, pdfmetrics.stringWidth(title, "AtlasSerifBold", 26)))
    set_font(c, "AtlasSerifBold", title_size, INK)
    c.drawString(38, top_y(65), title)
    draw_wrapped(c, subtitle, 38, 82, 755, "AtlasSans", 8.8, 12, MUTED)
    c.setStrokeColor(RULE)
    c.setLineWidth(0.8)
    c.line(38, top_y(105), W - 38, top_y(105))
    footer(c, folio)


def footer(c, folio):
    c.setStrokeColor(RULE)
    c.setLineWidth(0.7)
    c.line(38, 22, W - 38, 22)
    set_font(c, "AtlasSansBold", 6.5, MUTED)
    c.drawString(38, 11, "WISHFIRE / LEGEND-STYLE IDLE STAGE STUDY")
    c.drawRightString(W - 38, 11, folio)


def wrap(text, font, size, width):
    words = []
    for token in text.split():
        if pdfmetrics.stringWidth(token, font, size) <= width:
            words.append(token)
            continue
        part = ""
        for ch in token:
            if part and pdfmetrics.stringWidth(part + ch, font, size) > width:
                words.append(part)
                part = ch
            else:
                part += ch
        if part:
            words.append(part)
    lines, line = [], ""
    for word in words:
        trial = word if not line else f"{line} {word}"
        if pdfmetrics.stringWidth(trial, font, size) <= width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def draw_wrapped(c, text, x, top, width, font="AtlasSans", size=9, leading=12, color=INK, max_lines=None):
    lines = wrap(text, font, size, width)
    if max_lines:
        lines = lines[:max_lines]
    set_font(c, font, size, color)
    for i, ln in enumerate(lines):
        c.drawString(x, top_y(top + i * leading), ln)
    return top + len(lines) * leading


def draw_bullets(c, items, x, top, width, color=INK, accent=ACCENT["cyan"], size=8.4, gap=7):
    cur = top
    for item in items:
        c.setFillColor(accent)
        c.circle(x + 3, top_y(cur + 3), 2.3, stroke=0, fill=1)
        cur = draw_wrapped(c, item, x + 13, cur, width - 13, "AtlasSans", size, size * 1.3, color) + gap
    return cur


def band(c, x, top, w, h, color, alpha=0.10):
    c.saveState()
    c.setFillColor(color)
    c.setFillAlpha(alpha)
    c.rect(x, top_y(top + h), w, h, stroke=0, fill=1)
    c.restoreState()


def rule(c, x, top, w, color=RULE, width=0.8):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x, top_y(top), x + w, top_y(top))


def draw_image(c, path, x, top, w, h, mode="cover"):
    im = Image.open(path)
    iw, ih = im.size
    scale = max(w / iw, h / ih) if mode == "cover" else min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, top_y(top + h) + (h - dh) / 2
    c.saveState()
    p = c.beginPath()
    p.rect(x, top_y(top + h), w, h)
    c.clipPath(p, stroke=0, fill=0)
    c.drawImage(str(path), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
    c.restoreState()
    c.setStrokeColor(INK)
    c.setLineWidth(0.8)
    c.rect(x, top_y(top + h), w, h, stroke=1, fill=0)


def arrow(c, x1, y1, x2, y2, color=INK, width=1.5):
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)
    a = atan2(y2 - y1, x2 - x1)
    l = 7
    c.line(x2, y2, x2 - l * cos(a - pi / 7), y2 - l * sin(a - pi / 7))
    c.line(x2, y2, x2 - l * cos(a + pi / 7), y2 - l * sin(a + pi / 7))


def dnode(c, x, y, w, h, title, body, color):
    col = ACCENT[color]
    c.setFillColor(PAPER2)
    c.setStrokeColor(col)
    c.setLineWidth(1.8)
    c.rect(x, y, w, h, stroke=1, fill=1)
    c.setFillColor(col)
    c.rect(x, y, 5, h, stroke=0, fill=1)
    set_font(c, "AtlasSansBold", 8.4, INK)
    c.drawString(x + 13, y + h - 19, title)
    draw_wrapped(c, body, x + 13, H - (y + h - 35), w - 22, "AtlasSans", 6.8, 8.4, MUTED, 2)


def draw_diagram(c, name, x, top, w, h):
    spec = DIAGRAMS[name]
    kind = spec["kind"]
    sx, sy = w / 800, h / 440
    c.saveState()
    c.translate(x, top_y(top + h))
    c.scale(sx, sy)
    set_font(c, "AtlasSansBold", 17, INK)
    c.drawString(28, 410, spec["title"])
    set_font(c, "AtlasSans", 9, MUTED)
    c.drawString(28, 388, spec["desc"])
    if kind == "loop":
        ns = spec["nodes"]
        for i, (nx, ny, *_rest) in enumerate(ns):
            tx, ty, *_ = ns[(i + 1) % len(ns)]
            y1, y2 = 440 - ny, 440 - ty
            dx, dy = tx - nx, y2 - y1
            length = max((dx * dx + dy * dy) ** 0.5, 1)
            arrow(c, nx + dx / length * 50, y1 + dy / length * 50, tx - dx / length * 50, y2 - dy / length * 50, INK, 1.5)
        for nx, ny, title, body, color in ns:
            cy = 440 - ny
            c.setFillColor(PAPER2); c.setStrokeColor(ACCENT[color]); c.setLineWidth(2.6)
            c.circle(nx, cy, 49, stroke=1, fill=1)
            set_font(c, "AtlasSansBold", 10.5, INK); c.drawCentredString(nx, cy + 5, title)
            body_lines = wrap(body, "AtlasSans", 6.8, 86)[:2]
            set_font(c, "AtlasSans", 6.8, MUTED)
            for j, ln in enumerate(body_lines):
                c.drawCentredString(nx, cy - 11 - j * 9, ln)
        cx, cyt = spec["center"]; cy = 440 - cyt
        c.setFillColor(INK); c.circle(cx, cy, 84, stroke=0, fill=1)
        for j, s in enumerate(spec["hub"]):
            is_edge = j in {0, len(spec["hub"]) - 1}
            set_font(c, "AtlasSansBold" if is_edge else "AtlasSans", 11 if j == 0 else 7.1, ACCENT["cyan"] if j == len(spec["hub"]) - 1 else PAPER2)
            c.drawCentredString(cx, cy + 48 - j * 22, s)
    elif kind == "pipeline":
        nodes = spec["nodes"]
        for i in range(len(nodes) - 1):
            nx, ny, nw, nh, *_ = nodes[i]; tx, ty, *_ = nodes[i + 1]
            arrow(c, nx + nw, 440 - ny - nh / 2, tx, 440 - ty - nh / 2)
        for nx, ny, nw, nh, title, body, color in nodes:
            dnode(c, nx, 440 - ny - nh, nw, nh, title, body, color)
        if spec.get("timeline"):
            set_font(c, "AtlasSansBold", 7.3, ACCENT["cyan"]); c.drawString(60, 166, "EXAMPLE: 1.2 SECOND HERO CADENCE")
            yy = 130; c.setStrokeColor(INK); c.setLineWidth(1.4); c.line(60, yy, 740, yy)
            for sec, text in spec["timeline"]:
                px = 60 + sec / 1.2 * 680
                c.setFillColor(PAPER2); c.setStrokeColor(INK); c.circle(px, yy, 5, stroke=1, fill=1)
                set_font(c, "AtlasSansBold", 7.3, INK); c.drawCentredString(px, yy + 18, text)
                set_font(c, "AtlasSans", 7, MUTED); c.drawCentredString(px, yy - 20, f"{sec:.2f}s")
    elif kind == "comparison":
        set_font(c, "AtlasSansBold", 10, ACCENT["rose"]); c.drawString(65, 342, spec["left_title"])
        set_font(c, "AtlasSansBold", 10, ACCENT["green"]); c.drawString(455, 342, spec["right_title"])
        arrow(c, 375, 347, 425, 347, ACCENT["violet"], 2.5)
        for items, px, col in [(spec["left"], 65, "rose"), (spec["right"], 455, "green")]:
            for i, item in enumerate(items, 1):
                py = 300 - (i - 1) * 55
                c.setFillColor(ACCENT[col]); c.circle(px + 13, py, 11, stroke=0, fill=1)
                set_font(c, "AtlasSansBold", 7.5, PAPER2); c.drawCentredString(px + 13, py - 2.5, str(i))
                set_font(c, "AtlasSans", 8.5, INK); c.drawString(px + 34, py - 3, item)
    elif kind == "stack":
        layers = spec["layers"]
        for i, (title, body, color) in enumerate(layers):
            px, py, bw, bh = 90 + i * 10, 330 - i * 47, 620 - i * 20, 39
            c.setFillColor(PAPER2); c.setStrokeColor(ACCENT[color]); c.setLineWidth(1.5)
            c.rect(px, py, bw, bh, stroke=1, fill=1)
            set_font(c, "AtlasSansBold", 8.6, INK); c.drawString(px + 14, py + 15, title)
            set_font(c, "AtlasSans", 7.7, MUTED); c.drawString(px + 165, py + 15, body)
    elif kind == "branch":
        ns = spec["nodes"]
        for i in range(3):
            nx, ny, nw, nh, *_ = ns[i]; tx, ty, *_ = ns[i + 1]
            arrow(c, nx + nw, 440 - ny - nh / 2, tx, 440 - ty - nh / 2)
        nx, ny, nw, nh, *_ = ns[3]
        startx, starty = nx + nw, 440 - ny - nh / 2
        for tx, ty, tw, th, *_ in ns[4:]:
            midx = 575; targety = 440 - ty - th / 2
            c.setStrokeColor(INK); c.setLineWidth(1.4)
            c.line(startx, starty, midx, starty); c.line(midx, starty, midx, targety)
            arrow(c, midx, targety, tx, targety)
        for nx, ny, nw, nh, title, body, color in ns:
            dnode(c, nx, 440 - ny - nh, nw, nh, title, body, color)
    elif kind == "timeline":
        yy = 220; c.setStrokeColor(INK); c.setLineWidth(2); c.line(70, yy, 740, yy)
        for i, (pid, title, body, color) in enumerate(spec["phases"]):
            px = 90 + i * 126
            c.setFillColor(ACCENT[color]); c.setStrokeColor(INK); c.setLineWidth(1.2); c.circle(px, yy, 21, stroke=1, fill=1)
            set_font(c, "AtlasSansBold", 8.5, PAPER2); c.drawCentredString(px, yy - 3, pid)
            set_font(c, "AtlasSansBold", 7.7, INK); c.drawCentredString(px, yy + 51, title)
            set_font(c, "AtlasSans", 5.6, MUTED)
            for j, ln in enumerate(body.split("|")):
                c.drawCentredString(px, yy - 55 - j * 8, ln)
        set_font(c, "AtlasSansBold", 8.2, ACCENT["gold"]); c.drawCentredString(90 + 2 * 126, 92, "FIRST GO / NO-GO")
    c.restoreState()


def page1(c):
    c.setFillColor(PAPER); c.rect(0, 0, W, H, fill=1, stroke=0)
    label(c, "PLANNING / SYSTEMS ATLAS", 38, 36)
    set_font(c, "AtlasSerifBold", 33, INK)
    c.drawString(38, top_y(95), "Wishfire Idle-Stage")
    c.drawString(38, top_y(134), "Migration Atlas")
    draw_wrapped(c, "A visual systems guide for moving from turn-based party combat to a G123-flavored, Legend-style real-time idle RPG.", 38, 164, 395, "AtlasSans", 10.2, 14, MUTED)
    for i, (txt, col) in enumerate([("PLANNING ONLY", "orange"), ("EVIDENCE CHECKED", "green"), ("360 X 640 TARGET", "violet")]):
        set_font(c, "AtlasSansBold", 7.3, ACCENT[col]); c.drawString(38 + i * 123, top_y(220), txt)
    band(c, 38, 250, 395, 180, ACCENT["cyan"], 0.08)
    label(c, "The product shift in one sentence", 54, 278, ACCENT["cyan"], 7.1)
    draw_wrapped(c, "Move player decisions out of turn-by-turn attacks and into party builds, gear choices, automatic skill priorities, stage attempts, and long-horizon progression while combat runs continuously.", 54, 310, 360, "AtlasSerif", 12, 17, INK)
    draw_bullets(c, [
        "Keep Wishfire identity: four-hero party, readable VFX, quest structure, gear, and browser delivery.",
        "Build the new authority: waves, bosses, cooldowns, lamps, idle rewards, and durable claims.",
    ], 54, 388, 355, size=7.8, gap=5)
    draw_image(c, ASSETS / "source-img-000.png", 475, 48, 150, 445, "cover")
    draw_image(c, ASSETS / "source-img-001.png", 645, 48, 150, 445, "cover")
    set_font(c, "AtlasSansBold", 6.5, MUTED); c.drawString(475, top_y(510), "REFERENCE LOOP"); c.drawString(645, top_y(510), "CURRENT FOUNDATION")
    footer(c, "BRIEF 01 / 19")


def page2(c):
    draw_title(c, "What “clone” means here", "Copy the proven system grammar. Preserve Wishfire’s setting, party identity, and readable combat presentation.", "Product scope", "DECISION FRAME 02 / 19")
    cols = [
        ("KEEP", "green", ["Four-hero party", "Browser-first 360 x 640 shell", "Quest and chapter identity", "Readable VFX and damage cadence", "Equipment slots, rarity, CP"]),
        ("REARRANGE", "violet", ["Player agency moves to builds", "Combat becomes continuous", "Session card choices become presets", "Bosses gate stage progress", "Loot decisions sit on main screen"]),
        ("ADD", "orange", ["Lamp reward loop", "Wave and boss authority", "Real-time actor cooldowns", "Offline reward ledger", "Dailies and one event layer"]),
    ]
    for i, (head, col, items) in enumerate(cols):
        x = 38 + i * 255
        c.setFillColor(ACCENT[col]); c.rect(x, top_y(147), 220, 6, fill=1, stroke=0)
        set_font(c, "AtlasSerifBold", 16, INK); c.drawString(x, top_y(176), head)
        draw_bullets(c, items, x, 204, 220, accent=ACCENT[col], size=9, gap=11)
    rule(c, 38, 430, 765, ACCENT["rose"], 1.5)
    label(c, "Defer until the core loop earns it", 38, 456, ACCENT["rose"])
    draw_wrapped(c, "Guilds, cross-server competition, ad rewards, paid gacha, battle passes, and multiple event currencies require identity, telemetry, server authority, and economic controls.", 255, 456, 548, "AtlasSans", 8.4, 11, INK)


def page3(c):
    draw_title(c, "Why the reference screen works", "The battle keeps moving while the player makes progression decisions around it. The screen is a loop controller, not a spectator window.", "Observed reference", "REFERENCE ANATOMY 03 / 19")
    draw_image(c, ASSETS / "source-img-002.png", 38, 126, 294, 390, "cover")
    for i, top in enumerate([173, 245, 315, 386, 456], 1):
        c.setFillColor(ACCENT["cyan"]); c.circle(314, top_y(top), 10, stroke=0, fill=1)
        set_font(c, "AtlasSansBold", 7, PAPER2); c.drawCentredString(314, top_y(top + 2.5), str(i))
    steps = ["Stage, resources, and boss gate", "Continuous combat stays visible", "Auto skills fire without prompts", "Gear compare: equip or sell", "Lamp remains the repeat action"]
    label(c, "Five jobs in one screen", 365, 134)
    for i, item in enumerate(steps, 1):
        set_font(c, "AtlasSansBold", 12, ACCENT["cyan"]); c.drawString(365, top_y(165 + (i - 1) * 48), f"0{i}")
        set_font(c, "AtlasSans", 9, INK); c.drawString(401, top_y(165 + (i - 1) * 48), item)
        rule(c, 365, 181 + (i - 1) * 48, 250)
    label(c, "Loop principle", 650, 134, ACCENT["violet"])
    principles = [("Motion", "Combat never waits for a menu decision."), ("Decision", "Loot asks one fast question: stronger or currency?"), ("Progress", "Stage and boss results unlock better rewards."), ("Return", "Offline gains create a reason to reopen."), ("Breadth", "Side systems deepen the same power goal.")]
    top = 160
    for head, body in principles:
        set_font(c, "AtlasSansBold", 8.3, INK); c.drawString(650, top_y(top), head)
        top = draw_wrapped(c, body, 650, top + 15, 150, "AtlasSans", 7.5, 9.5, MUTED) + 11
    set_font(c, "AtlasSans", 6.8, MUTED); c.drawString(365, top_y(520), "Source: Legend of Mushroom gameplay screenshot [S2/S4].")


def page4(c):
    draw_title(c, "Aim for the G123 delivery model", "Instant browser access, compact party combat, fast returning sessions, and many systems routed through one stage screen.", "Platform target", "DELIVERY FLAVOR 04 / 19")
    draw_image(c, ASSETS / "source-img-003.png", 38, 124, 225, 390, "cover")
    draw_image(c, ASSETS / "source-img-004.png", 292, 124, 511, 148, "cover")
    label(c, "Wishfire interpretation", 292, 305, ACCENT["violet"])
    points = [
        ("01", "Instant entry", "Playable before account commitment; recovery and linking can follow."),
        ("02", "Compact party", "Keep four heroes visible, with automated skills and small formation offsets."),
        ("03", "Short return loop", "Claim, lamp, compare, upgrade, boss attempt, leave."),
        ("04", "Cross-device shape", "The current 360 x 640 logical viewport already fits the delivery goal."),
    ]
    for i, (num, head, body) in enumerate(points):
        y = 338 + i * 44
        set_font(c, "AtlasSerifBold", 13, ACCENT["violet"]); c.drawString(292, top_y(y), num)
        set_font(c, "AtlasSansBold", 8.5, INK); c.drawString(330, top_y(y), head)
        draw_wrapped(c, body, 435, y, 355, "AtlasSans", 7.4, 9.5, MUTED)
    set_font(c, "AtlasSans", 6.7, MUTED); c.drawString(292, top_y(523), "Sources: G123 official promotion and platform materials [S5-S7]; user-provided combat reference.")


def page5(c):
    draw_title(c, "Wishfire already has the outer shell", "The new product should reuse the proven shell and data while replacing the turn authority at the center.", "Current merged main", "CURRENT STATE 05 / 19")
    draw_image(c, ASSETS / "source-img-005.png", 38, 126, 190, 385, "cover")
    draw_image(c, ASSETS / "source-img-006.png", 245, 126, 190, 385, "cover")
    set_font(c, "AtlasSansBold", 6.6, MUTED); c.drawString(38, top_y(523), "CURRENT MAP / HOME"); c.drawString(245, top_y(523), "CURRENT INTERRUPTIVE COMBAT")
    label(c, "Foundation audit", 470, 130, ACCENT["green"])
    rows = [
        ("REUSE", "360 x 640 shell and nav", "green"), ("REUSE", "4 heroes, kits, EXP", "green"),
        ("REUSE", "6 gear slots, 5 rarities", "green"), ("REUSE", "market, save, CP math", "green"),
        ("ADAPT", "quest ladder into stages", "gold"), ("ADAPT", "VFX into cooldown cadence", "gold"),
        ("REPLACE", "explicit actor turn loop", "rose"), ("REPLACE", "session card interruptions", "rose"),
        ("BUILD", "lamp and offline ledger", "violet"),
    ]
    for i, (tag, text, col) in enumerate(rows):
        y = 165 + i * 38
        rule(c, 470, y + 14, 333)
        set_font(c, "AtlasSansBold", 7.2, ACCENT[col]); c.drawString(470, top_y(y), tag)
        set_font(c, "AtlasSans", 8.6, INK); c.drawString(550, top_y(y), text)


def page6(c):
    draw_title(c, "The loop to build first", "Every added system must feed power, stage progress, or return motivation. The first proof needs only this closed circuit.", "Target product loop", "CORE LOOP 06 / 19")
    draw_diagram(c, "core-loop", 38, 115, 765, 410)


def page7(c):
    draw_title(c, "Real-time rules with readable presentation", "Use one deterministic scheduler for combat truth and one presentation queue that prevents effects from piling up.", "Architecture", "COMBAT AUTHORITY 07 / 19")
    draw_diagram(c, "combat-authority", 38, 112, 765, 345)
    rule(c, 38, 468, 765, ACCENT["cyan"], 1.3)
    draw_wrapped(c, "Rule: simulation may know the next event, but the visible package owns the stage until its minimum readability window completes. This preserves the combat clarity already proven in Wishfire.", 38, 488, 700, "AtlasSans", 7.6, 9.8, INK)
    draw_wrapped(c, "Upgrade path: animation event markers can replace fixed windows after the art pipeline matures.", 38, 526, 700, "AtlasSans", 7.0, 9.0, MUTED)


def page8(c):
    draw_title(c, "Move decisions before and between fights", "Automation removes attack-by-attack selection. It must create stronger build decisions in exchange.", "Interaction model", "PLAYER AGENCY 08 / 19")
    draw_diagram(c, "agency-shift", 38, 112, 765, 372)
    band(c, 220, 485, 402, 34, ACCENT["violet"], 0.12)
    label(c, "Agency moves to buildcraft", 322, 507, ACCENT["violet"], 8)


def page9(c):
    draw_title(c, "360 x 640 proportional layout", "Keep battle readable on a phone while the lamp decision remains reachable. These are starting ratios, not final art direction.", "Size, not character appearance", "SCREEN BLUEPRINT 09 / 19")
    x, top, pw, ph = 60, 125, 225, 395
    c.setFillColor(PAPER2); c.setStrokeColor(INK); c.setLineWidth(1.4); c.rect(x, top_y(top + ph), pw, ph, fill=1, stroke=1)
    zones = [("HUD / STAGE", 9, "cyan"), ("BATTLEFIELD", 39, "violet"), ("PARTY / POWER", 11, "green"), ("LAMP + LOOT", 27, "gold"), ("BOTTOM NAV", 14, "rose")]
    cur = top
    for name, pct, col in zones:
        zh = ph * pct / 100
        c.setFillColor(ACCENT[col]); c.setFillAlpha(0.12); c.rect(x, top_y(cur + zh), pw, zh, fill=1, stroke=0); c.setFillAlpha(1)
        set_font(c, "AtlasSansBold", 7.1, INK); c.drawString(x + 10, top_y(cur + 16), name)
        set_font(c, "AtlasSans", 7, ACCENT[col]); c.drawRightString(x + pw - 10, top_y(cur + 16), f"{pct}%")
        cur += zh
    label(c, "Proportion starting points", 340, 130, ACCENT["violet"])
    rows = [
        ("Hero height", "48-64 px", "20-26% of battlefield height"),
        ("Enemy height", "42-58 px", "Boss: 72-96 px"),
        ("Normal impact", "0.55-0.90 x actor height", "Large impact: up to 1.2 x"),
        ("Touch target", "44 px minimum", "Primary lamp control: 68-84 px"),
        ("Gear compare", "1 item at a time", "Two large actions: equip / sell"),
        ("Visible currencies", "3 in top HUD", "Overflow opens the resource drawer"),
    ]
    for i, row in enumerate(rows):
        y = 170 + i * 47
        rule(c, 340, y + 17, 463)
        set_font(c, "AtlasSansBold", 8, INK); c.drawString(340, top_y(y), row[0])
        set_font(c, "AtlasSansBold", 8, ACCENT["cyan"]); c.drawString(475, top_y(y), row[1])
        set_font(c, "AtlasSans", 7.4, MUTED); c.drawString(640, top_y(y), row[2])
    band(c, 340, 462, 463, 58, ACCENT["gold"], 0.09)
    label(c, "Readability rule", 354, 484, ACCENT["gold"])
    draw_wrapped(c, "At 360 px wide, simultaneous actors are silhouettes and state carriers. Detail belongs in hero, equipment, and result screens.", 354, 505, 430, "AtlasSans", 7.4, 9.5, INK)


def page10(c):
    draw_title(c, "Reuse, adapt, build, defer", "This is the migration boundary. It prevents a rewrite of working foundations and blocks premature live-service scope.", "Scope map", "MIGRATION MATRIX 10 / 19")
    headers = [("REUSE", "green"), ("ADAPT", "gold"), ("BUILD", "violet"), ("DEFER", "rose")]
    data = [
        ["Responsive shell", "Quest ladder", "Stage authority", "Guilds"],
        ["Hero definitions", "Hero commands", "Cooldown scheduler", "Cross-server"],
        ["EXP progression", "Action presentation", "Lamp inventory", "Ads / paid gacha"],
        ["Equipment model", "Market UI", "Offline ledger", "Battle pass"],
        ["Save storage", "VFX placement", "Daily reset", "Multi-event calendar"],
        ["Combat power", "Map / chapter UI", "Auto skill presets", "PvP seasons"],
        ["Browser tests", "Gallery shells", "Reward audit trail", "Backend social"],
    ]
    x0, top, cw, rh = 38, 132, 191.25, 44
    for j, (head, col) in enumerate(headers):
        x = x0 + j * cw; c.setFillColor(ACCENT[col]); c.rect(x, top_y(top + 31), cw - 4, 31, fill=1, stroke=0)
        set_font(c, "AtlasSansBold", 8, PAPER2); c.drawString(x + 10, top_y(top + 19), head)
    for i, row in enumerate(data):
        y = top + 38 + i * rh
        for j, txt in enumerate(row):
            x = x0 + j * cw
            c.setFillColor(PAPER2); c.setStrokeColor(RULE); c.rect(x, top_y(y + rh - 4), cw - 4, rh - 4, fill=1, stroke=1)
            draw_wrapped(c, txt, x + 10, y + 17, cw - 24, "AtlasSans", 8, 10, INK)
    set_font(c, "AtlasSans", 6.9, MUTED); c.drawString(38, top_y(505), "'Gallery shells' means navigation/presentation exists; gameplay depth still must be implemented when promoted.")


def page11(c):
    draw_title(c, "Build depth in layers, not all at once", "A strong idle RPG compounds a few clear growth systems. Each layer earns a visible outcome in combat.", "System stack", "PROGRESSION DEPTH 11 / 19")
    draw_diagram(c, "progression-stack", 38, 112, 765, 348)
    band(c, 38, 470, 765, 50, ACCENT["cyan"], 0.08)
    label(c, "Power funnel", 52, 492)
    draw_wrapped(c, "Every layer improves stage clear speed, boss survival, or reward access. A layer with no clear effect belongs outside the first migration.", 165, 492, 620, "AtlasSans", 7.8, 10, INK)


def page12(c):
    draw_title(c, "Start with five currencies", "The reference genre can drown players in tokens. The alpha wallet should remain legible and auditable.", "Minimum viable wallet", "ECONOMY 12 / 19")
    rows = [
        ("G", "GOLD", "Gear upgrades and broad sinks", "SOURCE: STAGE / SELL", "gold"),
        ("L", "LAMPS", "Roll one equipment item", "SOURCE: STAGE / BOSS", "cyan"),
        ("S", "SKILL TOKENS", "Upgrade automatic skills", "SOURCE: DUNGEON / DAILY", "violet"),
        ("C", "COMPANION TOKENS", "Acquire and grow companions", "SOURCE: DUNGEON / EVENT", "green"),
        ("D", "DUNGEON KEYS", "Limit special reward runs", "SOURCE: DAILY RESET", "rose"),
    ]
    for i, (letter, name, use, src, col) in enumerate(rows):
        y = 126 + i * 62
        c.setFillColor(ACCENT[col]); c.circle(58, top_y(y + 22), 15, stroke=0, fill=1)
        set_font(c, "AtlasSansBold", 10, PAPER2); c.drawCentredString(58, top_y(y + 25), letter)
        set_font(c, "AtlasSerifBold", 12, INK); c.drawString(90, top_y(y + 17), name)
        set_font(c, "AtlasSans", 8, INK); c.drawString(240, top_y(y + 17), use)
        set_font(c, "AtlasSansBold", 6.8, ACCENT[col]); c.drawRightString(545, top_y(y + 17), src)
        rule(c, 90, y + 36, 455)
    band(c, 585, 126, 218, 187, ACCENT["violet"], 0.08)
    label(c, "Later, with server authority", 602, 154, ACCENT["violet"])
    draw_wrapped(c, "Premium currency, paid lamps, ad claims, passes, compensation mail, and event exchanges.", 602, 183, 183, "AtlasSans", 8.2, 11, INK)
    draw_wrapped(c, "Add only after telemetry and fraud controls exist.", 602, 250, 183, "AtlasSansBold", 7.5, 10, ACCENT["rose"])
    band(c, 585, 330, 218, 172, ACCENT["gold"], 0.08)
    label(c, "Anti-inflation rule", 602, 360, ACCENT["gold"])
    draw_wrapped(c, "Every source needs a sink, a daily ceiling, and a single owner. Reward tables should identify source, amount, cap, and claim key.", 602, 390, 183, "AtlasSans", 8.2, 11, INK)


def page13(c):
    draw_title(c, "Turn the existing equipment model into the main reward loop", "Wishfire already owns six slots, five rarities, equipment stats, purchases, persistence, and combat-power math.", "Reward engine", "LAMP + GEAR 13 / 19")
    draw_diagram(c, "lamp-gear-flow", 38, 112, 765, 210)
    draw_image(c, ASSETS / "source-img-007.png", 38, 338, 160, 175, "contain")
    label(c, "Roll contract", 230, 340, ACCENT["violet"])
    rows = [
        ("INPUT", "lampId, stageId, lampLevel, rollSeed"),
        ("OUTPUT", "equipmentId, rarity, slot, stats, sellValue"),
        ("DECISION", "equip / sell / hold one pending item"),
        ("PERSISTENCE", "atomic consume + result + decision"),
        ("AUTOMATION", "rarity floor, CP floor, slot filters"),
        ("PROTECTION", "idempotent claim and deterministic replay"),
    ]
    for i, (head, body) in enumerate(rows):
        y = 369 + i * 24
        set_font(c, "AtlasSansBold", 6.9, ACCENT["violet"]); c.drawString(230, top_y(y), head)
        set_font(c, "AtlasSans", 7.5, INK); c.drawString(328, top_y(y), body)
        rule(c, 230, y + 8, 573)
    set_font(c, "AtlasSans", 6.7, MUTED); c.drawString(230, top_y(520), "Reference: lamp rarity odds and gear loop [S2-S4, S9].")


def page14(c):
    draw_title(c, "Keep the party; automate the kit", "The target differs from a one-avatar clone: four heroes remain the strategic object.", "Wishfire-specific advantage", "AUTO-COMBAT BUILD 14 / 19")
    heroes = [
        ("F", "FARA", "TANK", "taunt > guard > strike", "rose"),
        ("H", "HONDO", "FIGHTER", "lowest HP > front enemy", "gold"),
        ("R", "RUNA", "CONTROL", "cluster > debuff > burst", "violet"),
        ("K", "KAJA", "SUPPORT", "heal threshold > buff > attack", "green"),
    ]
    for i, (initial, name, role, priority, col) in enumerate(heroes):
        x = 38 + i * 191
        c.setFillColor(ACCENT[col]); c.circle(x + 20, top_y(164), 20, stroke=0, fill=1)
        set_font(c, "AtlasSerifBold", 14, PAPER2); c.drawCentredString(x + 20, top_y(169), initial)
        set_font(c, "AtlasSerifBold", 14, INK); c.drawString(x + 50, top_y(157), name)
        set_font(c, "AtlasSansBold", 7, ACCENT[col]); c.drawString(x + 50, top_y(176), role)
        draw_wrapped(c, priority, x, 212, 165, "AtlasSans", 8, 10, INK)
        rule(c, x, 244, 165, ACCENT[col], 1.4)
    label(c, "First auto-build surface", 38, 285)
    items = [
        ("3 ACTIVE SKILLS", "Current action slots become cooldown-equipped skills.", "cyan"),
        ("1 ULTIMATE", "FLOW becomes an automatic ultimate with a condition.", "violet"),
        ("2 COMPANIONS", "One passive aura and one triggered helper.", "green"),
        ("4 PRIORITIES", "Target, heal threshold, ultimate condition, boss mode.", "gold"),
    ]
    for i, (head, body, col) in enumerate(items):
        x = 38 + i * 191
        band(c, x, 310, 165, 135, ACCENT[col], 0.08)
        set_font(c, "AtlasSansBold", 8, ACCENT[col]); c.drawString(x + 12, top_y(338), head)
        draw_wrapped(c, body, x + 12, 368, 140, "AtlasSans", 8.2, 11, INK)
    band(c, 242, 472, 358, 35, ACCENT["cyan"], 0.12)
    label(c, "No mid-fight menu required", 329, 495, ACCENT["cyan"], 7.8)


def page15(c):
    draw_title(c, "Offline rewards must behave like a bank ledger", "The client may display elapsed time. Reward truth needs deterministic, idempotent settlement.", "Persistence + live ops", "RETURN LOOP 15 / 19")
    draw_diagram(c, "offline-ledger", 38, 112, 765, 205)
    label(c, "Daily rhythm", 38, 350, ACCENT["green"])
    draw_bullets(c, ["Claim capped idle chest", "Spend lamps and compare gear", "Run one skill or companion dungeon", "Attempt the current boss", "Collect one daily milestone"], 38, 378, 340, accent=ACCENT["green"], size=8.5, gap=6)
    label(c, "Server boundary", 445, 350, ACCENT["rose"])
    draw_bullets(c, ["Authoritative time and claim keys", "Inventory mutation and purchase receipts", "Daily reset and event windows", "Mailbox / compensation", "Guild, ranking, PvP, cross-server"], 445, 378, 358, accent=ACCENT["rose"], size=8.5, gap=6)
    rule(c, 38, 505, 765, ACCENT["gold"], 1.3)
    set_font(c, "AtlasSans", 7.1, MUTED); c.drawString(38, top_y(525), "Prototype may run locally; production settlement should move to server authority before monetized rewards.")


def page16(c):
    draw_title(c, "Put each rule in one home", "Keep the browser shell thin. Deterministic rules remain testable without the rendered game.", "Module map", "TECHNICAL OWNERSHIP 16 / 19")
    draw_diagram(c, "module-map", 38, 112, 765, 330)
    band(c, 38, 458, 765, 62, ACCENT["violet"], 0.08)
    label(c, "Ownership test", 52, 482, ACCENT["violet"])
    draw_wrapped(c, "Given the same seed and commands, RULES + SESSION must reproduce the same result without DOM, timers, or images. PRESENTATION may lag, but it cannot change combat truth.", 170, 482, 615, "AtlasSans", 7.6, 9.7, INK)


def page17(c):
    draw_title(c, "Six gated phases", "Each phase ends with a playable proof. Stop when evidence fails; breadth does not rescue a broken core loop.", "Implementation order", "MIGRATION ROADMAP 17 / 19")
    draw_diagram(c, "roadmap", 38, 112, 765, 250)
    label(c, "P2 is the first go / no-go milestone", 38, 386, ACCENT["gold"])
    milestones = [
        "A party clears a full stage without player attack input.",
        "At least one enemy drops a lamp.",
        "Opening it produces one auditable gear roll.",
        "Equip or sell changes persistent state and combat power.",
        "Reload restores the exact stage, party, and inventory.",
    ]
    for i, item in enumerate(milestones, 1):
        x = 38 + ((i - 1) % 3) * 260; y = 417 + ((i - 1) // 3) * 58
        c.setFillColor(ACCENT["gold"]); c.circle(x + 10, top_y(y), 9, stroke=0, fill=1)
        set_font(c, "AtlasSansBold", 6.8, PAPER2); c.drawCentredString(x + 10, top_y(y + 2.5), str(i))
        draw_wrapped(c, item, x + 28, y - 4, 175, "AtlasSans", 7.1, 9.1, INK)


def page18(c):
    draw_title(c, "How we know the migration works", "Runtime proof should show human-readable combat, deterministic rules, durable claims, and stable phone-scale layout.", "QA plan", "EVIDENCE GATES 18 / 19")
    rows = [
        ("LOOP", "Watch 1-1 > boss > 1-2 without intervention.", "VIDEO + STATE LOG", "cyan"),
        ("CADENCE", "No VFX, damage number, death, or spawn overlaps incorrectly.", "TIMELINE ASSERTIONS", "violet"),
        ("LOOT", "Same seed yields same lamp item; equip/sell commits once.", "REPLAY TEST", "gold"),
        ("OFFLINE", "Clock changes cannot duplicate a claim; cap is visible.", "LEDGER TEST", "green"),
        ("SAVE", "Reload and second tab preserve one inventory truth.", "PERSISTENCE TEST", "rose"),
        ("SCALE", "360 x 640 and compact 216 x 384 remain readable.", "SCREENSHOTS", "orange"),
    ]
    for i, (area, proof, evidence, col) in enumerate(rows):
        y = 128 + i * 58
        c.setFillColor(ACCENT[col]); c.rect(38, top_y(y + 42), 88, 42, fill=1, stroke=0)
        set_font(c, "AtlasSansBold", 7.6, PAPER2); c.drawString(50, top_y(y + 24), area)
        set_font(c, "AtlasSans", 8.4, INK); c.drawString(150, top_y(y + 24), proof)
        set_font(c, "AtlasSansBold", 7.1, ACCENT[col]); c.drawRightString(803, top_y(y + 24), evidence)
        rule(c, 150, y + 42, 653)
    band(c, 38, 491, 765, 33, ACCENT["rose"], 0.10)
    label(c, "Release blocker", 52, 512, ACCENT["rose"])
    set_font(c, "AtlasSans", 6.9, INK); c.drawString(160, top_y(512), "Any duplicate reward, resurrected target, interrupted visual package, or invisible stage transition blocks the milestone.")


def page19(c):
    draw_title(c, "Evidence and open decisions", "Primary sources establish the product grammar; secondary guides fill version-sensitive loop details. Recommendations remain Wishfire-specific.", "Handoff", "SOURCES + DECISIONS 19 / 19")
    label(c, "Sources", 38, 130)
    sources = [
        ("S1", "Official LoM site", "https://mushroom.joynetgame.com/website/en.html"),
        ("S2", "Google Play listing", "https://play.google.com/store/apps/details?id=com.mxdzzus.google"),
        ("S3", "Apple App Store", "https://apps.apple.com/us/app/legend-of-mushroom/id6475333787"),
        ("S4", "Apple editorial", "https://apps.apple.com/gb/iphone/story/id1740755920"),
        ("S5", "G123 FAQ", "https://g123.jp/faq?lang=en"),
        ("S6", "G123 investor deck", "https://platform-sc.g123.jp/ctw_assets/2026/1/1768281738768_CTW_Investor_Presentation_January_2026_FINAL.pdf"),
        ("S7", "G123 idle RPG release", "https://g123.jp/news/article/473161?lang=en"),
        ("S8", "Theria daily guide", "https://theriagames.com/guide/legend-of-mushroom-daily-to-do-list/"),
        ("S9", "Lamp / equipment guide", "https://legendofmushroom.ru/books/4-snariazenie/page/snariazenie-i-lampa-polnyi-gaid"),
        ("S10", "Deconstructor analysis", "https://www.deconstructoroffun.com/blog/2024/4/15/the-magic-of-legend-of-mushroom"),
        ("S11", "Screenshot reference", "https://imag.malavida.com/mvimgbig/download-fs/legend-of-mushroom-38695-8.jpg"),
    ]
    top = 154
    for code, name, url in sources:
        set_font(c, "AtlasSansBold", 6.8, ACCENT["cyan"]); c.drawString(38, top_y(top), code)
        set_font(c, "AtlasSansBold", 7.4, INK); c.drawString(73, top_y(top), name)
        draw_wrapped(c, url, 73, top + 12, 405, "AtlasSans", 5.9, 7.4, MUTED, 2)
        top += 34 if len(url) < 86 else 43
    c.setStrokeColor(RULE); c.line(510, top_y(125), 510, top_y(525))
    label(c, "Decisions before P0", 540, 130, ACCENT["violet"])
    decisions = [
        ("Battle speed target", "Choose 1x cadence and maximum simultaneous packages."),
        ("Stage structure", "Define waves per stage and boss-failure behavior."),
        ("Lamp cadence", "Set drop rate, storage cap, and rarity curve."),
        ("Gear comparison", "Choose CP weighting and stat exception rules."),
        ("Offline cap", "Choose eligible hours and stage-based reward rate."),
        ("First meta layer", "Pick companions, mount, or relic; ship one."),
        ("Backend point", "Decide when local proof hands off to server authority."),
    ]
    top = 160
    for i, (head, body) in enumerate(decisions, 1):
        set_font(c, "AtlasSerifBold", 10, ACCENT["violet"]); c.drawString(540, top_y(top), str(i))
        set_font(c, "AtlasSansBold", 7.6, INK); c.drawString(565, top_y(top), head)
        top = draw_wrapped(c, body, 565, top + 13, 225, "AtlasSans", 6.8, 8.4, MUTED) + 11
    band(c, 540, 460, 263, 63, ACCENT["green"], 0.09)
    label(c, "Recommended start", 554, 482, ACCENT["green"])
    draw_wrapped(c, "Approve P0 only: write the state contract, timing budget, reward tables, and save migration before changing runtime code.", 554, 504, 210, "AtlasSans", 6.6, 8.2, INK, 3)


PAGES = [page1, page2, page3, page4, page5, page6, page7, page8, page9, page10, page11, page12, page13, page14, page15, page16, page17, page18, page19]


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=(W, H), pageCompression=1)
    c.setTitle("Wishfire Idle-Stage Migration Atlas - Redesigned")
    c.setAuthor("Codex for Wishfire")
    c.setSubject("Planning-only visual systems guide for a real-time idle-stage migration")
    c.setKeywords("Wishfire, idle RPG, migration, systems design, G123, Legend of Mushroom")
    for render in PAGES:
        c.setFillColor(PAPER); c.rect(0, 0, W, H, fill=1, stroke=0)
        render(c)
        c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    main()
