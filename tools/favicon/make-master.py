#!/usr/bin/env python3
"""重繪 Geno-Link 的 favicon 主圖（2048x2048）。

輸出 tools/favicon/favicon-master.png：燕麥白底、#B08968 圓角方形、白色幾何 G。
這張主圖是 generate-favicons.py 的來源；想換圖時直接覆蓋同名檔案再跑產生器即可。

用法：
    python3 tools/favicon/make-master.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 2048           # 主圖邊長
SS = 3                # 超取樣倍率，畫大再縮小換取平滑邊緣

BG = (245, 244, 240)      # #F5F4F0 燕麥白背景
TILE = (176, 137, 104)    # #B08968 圓角方形
FG = (255, 255, 255)      # 白色 G

# 圓角方形：四邊各留 194px 邊距，圓角半徑約邊長的 25%
TILE_INSET = 194
TILE_RADIUS = 420

# G 的圓環
G_CX, G_CY = 1053, 1026
G_OUTER_R = 598
G_STROKE = 217
# 圓環開口（度，0 度為 3 點鐘方向、順時針為正）：右上方缺口
ARC_START, ARC_END = 45, 313

# 橫槓與豎腳（G 右側那一撇）
BAR_LEFT, BAR_RIGHT = 962, 1462
BAR_TOP, BAR_BOTTOM = 908, 1103
STEM_LEFT = 1272
STEM_BOTTOM = 1288


def draw_master() -> Image.Image:
    canvas = SIZE * SS
    img = Image.new("RGB", (canvas, canvas), BG)
    draw = ImageDraw.Draw(img)

    def s(v):
        return v * SS

    draw.rounded_rectangle(
        [s(TILE_INSET), s(TILE_INSET), s(SIZE - TILE_INSET) - 1, s(SIZE - TILE_INSET) - 1],
        radius=s(TILE_RADIUS),
        fill=TILE,
    )

    # 圓環：arc 的 bbox 走中線半徑，寬度往兩側各長一半
    mid_r = G_OUTER_R - G_STROKE / 2
    draw.arc(
        [
            s(G_CX - mid_r),
            s(G_CY - mid_r),
            s(G_CX + mid_r),
            s(G_CY + mid_r),
        ],
        start=ARC_START,
        end=ARC_END,
        fill=FG,
        width=s(G_STROKE),
    )

    # 橫槓（左端伸進圓環內側，確保接合處沒有縫）
    draw.rectangle([s(BAR_LEFT), s(BAR_TOP), s(BAR_RIGHT), s(BAR_BOTTOM)], fill=FG)
    # 豎腳
    draw.rectangle([s(STEM_LEFT), s(BAR_TOP), s(BAR_RIGHT), s(STEM_BOTTOM)], fill=FG)

    return img.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    out = Path(__file__).resolve().parent / "favicon-master.png"
    draw_master().save(out, "PNG", optimize=True)
    print(f"wrote {out} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
