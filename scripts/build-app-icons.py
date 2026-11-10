"""生成拾谱的全套应用图标与启动屏（和弦图谱方案）。

外圈取自参考稿「同心环」，坐标从 1920px 的参考图上量出来再等比换算到
512x512 设计画布（参考图卡片宽 1241px → 系数 512/1241 ≈ 0.4126）：

- 暖白卡片底 #fbfaf8
- 4 道同心环，由外到内：黑 212 / 灰 180 / 黑 156 / 黑 131
- 配色：墨 #0a0a0c、灰环 #75737b、和弦深蓝 #14154f

中间的和弦框按「能读成吉他图」重画过，没用参考稿那套点阵
（15 个点、中列 5 行对两侧 4 行、还有两个点压在框线上，小尺寸看不清也平衡不住）：

- 外框 160x128 直角，6 弦 x 3 品（4 条内竖线 + 2 条内横线，格距 32 x 42.7）
- 框的宽高比 1.25 和格子比例 1 : 1.34 都取自用户给的参考和弦图（实测 81 x 65、
  格 16.2 x 21.75）。旧版 128x168 的格子是 1 : 2.2 的竖长条，点落在里面显空；
  改成接近方形的格子，点才「占得住」格子，这是参考图看起来扎实的原因
- 弦线与品线用浅灰 #cfcdd3，只当结构纹理，不跟黑色外框和深蓝和弦点抢注意力
- 和弦点阵逐点复刻参考图：参考点直径占格宽 77%，本框格宽 32 → 半径 12.3；
  点在品格正中、统一大小。布局 —— 1 品三弦各一点（弦 1、5、6），
  2 品一弦一点（弦 4），3 品两弦各一点（弦 2、3），对角呼应、留白均匀
- 横按不再整排铺点，也不再画横条（横条贴框顶像加粗顶边、下移像抽屉面板、
  放框外像标签、空心像输入框），整排六点会连成一条黑带，都不如这个点阵干净

产出（全部由本脚本生成，改完重跑即可）：
- public/icon.svg / icon-maskable.svg          网页 favicon 与 PWA 图标
- android mipmap-*/ic_launcher(_round).png     传统启动图标
- android mipmap-*/ic_launcher_foreground.png  自适应图标前景层（透明底，内容缩到 73%，落进 66dp 安全区）
- android drawable*/splash.png                 启动屏（暖纸底 + 图谱标记 + 「拾谱」）

用法：python scripts/build-app-icons.py
"""

import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
PUBLIC = os.path.join(ROOT, 'public')

CARD = (251, 250, 248, 255)     # #fbfaf8 卡片底
INK = (10, 10, 12, 255)         # #0a0a0c 墨黑
GRAY = (117, 115, 123, 255)     # #75737b 灰环
NAVY = (20, 21, 79, 255)        # #14154f 和弦深蓝
PAPER = (246, 245, 241, 255)    # #f6f5f1 启动屏底

SS = 4  # 超采样倍数，先画大再缩小，边缘才平滑
CENTER = 256.0

# 同心环：(中线半径, 线宽, 颜色)。半径取参考稿实测值 x0.4126
RINGS = [
    (212.0, 4.0, INK),
    (180.0, 2.8, GRAY),
    (156.0, 3.8, INK),
    (131.0, 4.0, INK),
]

# 和弦框：外框 160 x 128，直角；6 弦（5 条内竖线）+ 3 品（2 条内横线）
# 宽高比 1.25 取自用户参考图（实测 81 x 65），格宽 32 : 格高 42.7 = 1 : 1.34。
# 试过更大的 172x138，四角快蹭到最内那道圆环，太满；160 是留白和尺寸的平衡点。
FRAME_HALF_W = 80.0
FRAME_HALF_H = 64.0
FRAME_STROKE = 4.4
GRID_STROKE = 2.7
STRINGS = 6                     # 6 弦：左右边框是第 1、6 弦，中间 4 条内竖线
FRETS = 3                       # 3 品：2 条内横线，格距 32 x 42.7（F 和弦只用前三品）
STRING_GAP = FRAME_HALF_W * 2 / (STRINGS - 1)   # 弦与弦的距离（6 弦 → 中间 5 个间隔）
CELL_H = FRAME_HALF_H * 2 / FRETS
GRID = (207, 205, 211, 255)     # #cfcdd3 浅灰网格，只当纹理，不抢主色


def string_x(index):
    """第 index 根弦的位置（1 = 最低音的第 6 弦，落在左边框；6 = 最细的第 1 弦）。"""
    return CENTER - FRAME_HALF_W + STRING_GAP * (index - 1)


def fret_y(fret):
    """第 fret 品的格子中心 y（框顶当弦枕，品 1 紧贴顶边）。"""
    return CENTER - FRAME_HALF_H + CELL_H * (fret - 0.5)


# 和弦点：按用户给的参考和弦图复刻，六个点统一大小、都落在品格正中。
# 参考图实测 格宽 16.2 / 格高 21.75 / 点直径 12.5，即点直径占格宽 77%；
# 本框格宽 34.4，对应直径 26.5 → 半径 13.3（相邻两点间隙约 7.9，不会粘连）。
DOT_R = 12.3
DOTS = [
    (string_x(1), fret_y(1)),      # 6 弦 1 品
    (string_x(5), fret_y(1)),      # 2 弦 1 品
    (string_x(6), fret_y(1)),      # 1 弦 1 品
    (string_x(4), fret_y(2)),      # 3 弦 2 品
    (string_x(2), fret_y(3)),      # 5 弦 3 品
    (string_x(3), fret_y(3)),      # 4 弦 3 品
]


def draw_mark(draw, scale, dx, dy):
    """按 512 画布的设计画标记；scale/dx/dy 决定落点。"""
    def point(x, y):
        return (dx + (x - CENTER) * scale, dy + (y - CENTER) * scale)

    for radius, width, color in RINGS:
        w = max(1, round(width * scale))
        # PIL 的 outline 向内收，这里把外框外扩半个线宽，让中线落在设计半径上
        half = w / 2
        x, y = point(CENTER, CENTER)
        r = radius * scale
        draw.ellipse([x - r - half, y - r - half, x + r + half, y + r + half],
                     outline=color, width=w)

    stroke = max(1, round(FRAME_STROKE * scale))
    half = stroke / 2
    left, top = point(CENTER - FRAME_HALF_W, CENTER - FRAME_HALF_H)
    right, bottom = point(CENTER + FRAME_HALF_W, CENTER + FRAME_HALF_H)
    draw.rectangle([left - half, top - half, right + half, bottom + half], outline=INK, width=stroke)

    # 内部的弦线与品线画浅灰：给「吉他和弦图」提供结构，又不和大环抢注意力
    grid = max(1, round(GRID_STROKE * scale))
    for index in range(1, STRINGS - 1):
        x = CENTER - FRAME_HALF_W + STRING_GAP * index
        x1, y1 = point(x, CENTER - FRAME_HALF_H)
        x2, y2 = point(x, CENTER + FRAME_HALF_H)
        draw.line([x1, y1, x2, y2], fill=GRID, width=grid)
    for index in range(1, FRETS):
        y = CENTER - FRAME_HALF_H + CELL_H * index
        x1, y1 = point(CENTER - FRAME_HALF_W, y)
        x2, y2 = point(CENTER + FRAME_HALF_W, y)
        draw.line([x1, y1, x2, y2], fill=GRID, width=grid)

    for x, y in DOTS:
        px, py = point(x, y)
        r = DOT_R * scale
        draw.ellipse([px - r, py - r, px + r, py + r], fill=NAVY)


def render(size, content_scale, background, radius_units=80):
    """画一张完整图标；background 为 None 时输出透明前景层。"""
    canvas = Image.new('RGBA', (size * SS, size * SS), background or (0, 0, 0, 0))
    if background:
        draw = ImageDraw.Draw(canvas)
        draw.rounded_rectangle(
            [0, 0, size * SS, size * SS], radius=radius_units * (size * SS / 512), fill=background,
        )
    draw_mark(ImageDraw.Draw(canvas), size * SS / 512 * content_scale, size * SS / 2, size * SS / 2)
    return canvas.resize((size, size), Image.LANCZOS)


def build_launcher_icons():
    densities = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    foregrounds = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    for density, size in densities.items():
        folder = os.path.join(RES, f'mipmap-{density}')
        legacy = render(size, 1.0, CARD)
        legacy.save(os.path.join(folder, 'ic_launcher.png'))
        legacy.save(os.path.join(folder, 'ic_launcher_round.png'))
        # 自适应图标前景：外环半径 214.5，缩到 73% 后约 156，正好落进 66/108 的安全区
        foreground = render(foregrounds[density], 0.73, None)
        foreground.save(os.path.join(folder, 'ic_launcher_foreground.png'))
        print(f'mipmap-{density}: 图标 {size}px / 前景 {foregrounds[density]}px')


def hexc(color):
    return '#%02x%02x%02x' % color[:3]


def write_web_icon():
    """网页图标按同一套坐标输出 SVG，和 PNG 保持一致。

    输出两份：icon.svg 是带圆角的整块图标；icon-maskable.svg 是满幅方底、
    内容缩到 73%，给 PWA 的 maskable 用，套任何遮罩都不会切到同心环。
    标记本体放在 <defs> 里，两份共用同一份几何。
    """
    rings = ''.join(
        f'<circle cx="256" cy="256" r="{r}" stroke="{hexc(color)}" stroke-width="{w}"/>'
        for r, w, color in RINGS
    )
    frame = (
        f'<rect x="{CENTER - FRAME_HALF_W}" y="{CENTER - FRAME_HALF_H}" '
        f'width="{FRAME_HALF_W * 2}" height="{FRAME_HALF_H * 2}" '
        f'stroke="{hexc(INK)}" stroke-width="{FRAME_STROKE}"/>'
    )
    grid = ''.join(
        f'<line x1="{CENTER - FRAME_HALF_W + STRING_GAP * i:g}" y1="{CENTER - FRAME_HALF_H}" '
        f'x2="{CENTER - FRAME_HALF_W + STRING_GAP * i:g}" y2="{CENTER + FRAME_HALF_H}"/>'
        for i in range(1, STRINGS - 1)
    ) + ''.join(
        f'<line x1="{CENTER - FRAME_HALF_W}" y1="{CENTER - FRAME_HALF_H + CELL_H * i:g}" '
        f'x2="{CENTER + FRAME_HALF_W}" y2="{CENTER - FRAME_HALF_H + CELL_H * i:g}"/>'
        for i in range(1, FRETS)
    )
    dots = ''.join(
        f'<circle cx="{x:g}" cy="{y:g}" r="{DOT_R:g}" fill="{hexc(NAVY)}"/>' for x, y in DOTS
    )
    mark = (
        f'<g fill="none">{rings}{frame}</g>'
        f'<g stroke="{hexc(GRID)}" stroke-width="{GRID_STROKE}">{grid}</g>'
        f'{dots}'
    )
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        f'<defs><g id="mark">{mark}</g></defs>'
        f'<rect width="512" height="512" rx="80" fill="{hexc(CARD)}"/>'
        '<use href="#mark"/>'
        '</svg>\n'
    )
    maskable = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        f'<defs><g id="mark">{mark}</g></defs>'
        f'<rect width="512" height="512" fill="{hexc(CARD)}"/>'
        '<use href="#mark" transform="translate(256 256) scale(0.73) translate(-256 -256)"/>'
        '</svg>\n'
    )
    for name, content in (('icon.svg', svg), ('icon-maskable.svg', maskable)):
        with open(os.path.join(PUBLIC, name), 'w', encoding='utf-8') as handle:
            handle.write(content)
        print(f'public/{name}: {len(content)} 字节')


def load_title_font(px):
    for path in (
        r'C:\Windows\Fonts\msyh.ttc',
        r'C:\Windows\Fonts\simhei.ttf',
        r'C:\Windows\Fonts\simsun.ttc',
    ):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, px)
            except OSError:
                continue
    return None


def build_splash(width, height, path):
    canvas = Image.new('RGBA', (width * SS, height * SS), PAPER)
    draw = ImageDraw.Draw(canvas)
    base = min(width, height)
    # 外环直径 429 设计单位，占短边 46%
    scale = base * SS * 0.46 / 429
    draw_mark(draw, scale, width * SS / 2, height * SS * 0.45)
    font = load_title_font(round(base * SS * 0.055))
    if font:
        draw.text((width * SS / 2, height * SS * 0.66), '拾谱', font=font, fill=INK, anchor='mm')
    canvas.resize((width, height), Image.LANCZOS).save(path)


def build_splashes():
    splashes = {
        'drawable': (480, 320),
        'drawable-land-mdpi': (480, 320), 'drawable-land-hdpi': (800, 480),
        'drawable-land-xhdpi': (1280, 720), 'drawable-land-xxhdpi': (1600, 960),
        'drawable-land-xxxhdpi': (1920, 1280),
        'drawable-port-mdpi': (320, 480), 'drawable-port-hdpi': (480, 800),
        'drawable-port-xhdpi': (720, 1280), 'drawable-port-xxhdpi': (960, 1600),
        'drawable-port-xxxhdpi': (1280, 1920),
    }
    for folder, (width, height) in splashes.items():
        build_splash(width, height, os.path.join(RES, folder, 'splash.png'))
        print(f'{folder}/splash.png: {width}x{height}')


if __name__ == '__main__':
    build_launcher_icons()
    write_web_icon()
    build_splashes()
    print('完成')
