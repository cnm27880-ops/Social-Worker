#!/usr/bin/env python3
"""從一張方形主圖產生 Geno-Link 全套 favicon。

產出（預設寫入 public/，也就是 icon.svg、apple-touch-icon.png 所在、
build 後會被複製到網站根目錄的那一層）：

    favicon-16x16.png / 32x32 / 48x48 / 96x96 / 192x192 / 512x512
    favicon.ico       （內含 16、32、48 三種尺寸）

原圖若帶透明通道（RGBA/LA/P），會先鋪底色壓平成 RGB 再縮圖，
避免瀏覽器分頁或桌面捷徑把透明區塊算成黑色。

用法：
    python3 tools/favicon/generate-favicons.py
    python3 tools/favicon/generate-favicons.py --source my-icon.png
    python3 tools/favicon/generate-favicons.py --background "#F5F4F0"

換圖流程：把新的方形 PNG 覆蓋成 tools/favicon/favicon-master.png，
再跑一次這支程式即可，不必改任何 HTML。
"""

from __future__ import annotations

import argparse
import struct
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = REPO_ROOT / "tools" / "favicon" / "favicon-master.png"
DEFAULT_OUTPUT = REPO_ROOT / "public"

PNG_SIZES = [16, 32, 48, 96, 192, 512]
ICO_SIZES = [16, 32, 48]

# 主圖的燕麥白底；原圖若有透明區塊而且四角也是透明時，用這個顏色壓平
FALLBACK_BACKGROUND = (245, 244, 240)


def parse_color(value: str) -> tuple[int, int, int]:
    """把 '#RGB' / '#RRGGBB' / 'R,G,B' 轉成 (r, g, b)。"""
    text = value.strip()
    if text.startswith("#"):
        digits = text[1:]
        if len(digits) == 3:
            digits = "".join(c * 2 for c in digits)
        if len(digits) != 6:
            raise argparse.ArgumentTypeError(f"無法解析色碼：{value}")
        return tuple(int(digits[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    parts = [p for p in text.replace(",", " ").split() if p]
    if len(parts) != 3:
        raise argparse.ArgumentTypeError(f"無法解析色碼：{value}")
    return tuple(max(0, min(255, int(p))) for p in parts)  # type: ignore[return-value]


def pick_background(img: Image.Image) -> tuple[int, int, int]:
    """沒指定底色時，取原圖左上角當底色；角落本身透明就退回燕麥白。"""
    corner = img.convert("RGBA").getpixel((0, 0))
    if corner[3] == 255:
        return corner[:3]
    return FALLBACK_BACKGROUND


def flatten(img: Image.Image, background: tuple[int, int, int]) -> Image.Image:
    """壓平透明通道，回傳純 RGB 影像。"""
    if img.mode == "RGB":
        return img
    rgba = img.convert("RGBA")
    canvas = Image.new("RGB", rgba.size, background)
    canvas.paste(rgba, mask=rgba.getchannel("A"))
    return canvas


def square(img: Image.Image, background: tuple[int, int, int]) -> Image.Image:
    """非正方形的原圖置中補滿底色，避免縮圖被拉變形。"""
    w, h = img.size
    if w == h:
        return img
    side = max(w, h)
    canvas = Image.new("RGB", (side, side), background)
    canvas.paste(img, ((side - w) // 2, (side - h) // 2))
    return canvas


def build_ico(images: dict[int, Image.Image]) -> bytes:
    """手工打包多尺寸 ICO。

    Pillow 的 ICO writer 會自己用 BICUBIC 重新縮圖，這裡改成先各自用
    LANCZOS 縮好再塞進容器，小尺寸才不會糊掉。影像以 32-bit BGRA 的
    BMP(DIB) 形式存放，相容性最廣。
    """
    sizes = sorted(images)
    entries: list[bytes] = []
    blobs: list[bytes] = []
    offset = 6 + 16 * len(sizes)

    for size in sizes:
        rgba = images[size].convert("RGBA")
        px = rgba.load()

        # XOR 點陣：BMP 由下而上、每點 BGRA；寬度為 4 的倍數時不需補齊
        xor = bytearray()
        for y in range(size - 1, -1, -1):
            for x in range(size):
                r, g, b, a = px[x, y]
                xor += bytes((b, g, r, a))

        # AND 遮罩：1bpp、每列補齊到 4 bytes。全不透明，故整片為 0
        mask_row_bytes = ((size + 31) // 32) * 4
        and_mask = bytes(mask_row_bytes * size)

        header = struct.pack(
            "<IiiHHIIiiII",
            40,                     # biSize
            size,                   # biWidth
            size * 2,               # biHeight：XOR + AND 兩張疊在一起
            1,                      # biPlanes
            32,                     # biBitCount
            0,                      # biCompression = BI_RGB
            len(xor) + len(and_mask),  # biSizeImage
            0, 0,                   # 解析度
            0, 0,                   # 調色盤
        )
        blob = header + bytes(xor) + and_mask
        blobs.append(blob)
        entries.append(
            struct.pack(
                "<BBBBHHII",
                size if size < 256 else 0,
                size if size < 256 else 0,
                0,          # 調色盤色數，32-bit 填 0
                0,          # 保留
                1,          # 色彩平面
                32,         # 每點位元數
                len(blob),
                offset,
            )
        )
        offset += len(blob)

    return struct.pack("<HHH", 0, 1, len(sizes)) + b"".join(entries) + b"".join(blobs)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="來源方形圖片（預設 tools/favicon/favicon-master.png）")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="輸出資料夾（預設 public/）")
    parser.add_argument("--background", type=parse_color, default=None, help="壓平透明通道用的底色，如 #F5F4F0；預設取原圖左上角")
    args = parser.parse_args()

    if not args.source.is_file():
        raise SystemExit(f"找不到來源圖片：{args.source}")
    args.output.mkdir(parents=True, exist_ok=True)

    with Image.open(args.source) as raw:
        raw.load()
        background = args.background or pick_background(raw)
        master = square(flatten(raw, background), background)

    print(f"來源 {args.source.relative_to(REPO_ROOT)}　{master.size[0]}x{master.size[1]}　底色 #{'%02X%02X%02X' % background}")

    # 每個尺寸都直接從主圖 LANCZOS 縮一次，不要接力縮小
    scaled = {size: master.resize((size, size), Image.LANCZOS) for size in sorted(set(PNG_SIZES + ICO_SIZES))}

    for size in PNG_SIZES:
        path = args.output / f"favicon-{size}x{size}.png"
        scaled[size].save(path, "PNG", optimize=True)
        print(f"  ✓ {path.relative_to(REPO_ROOT)}")

    ico_path = args.output / "favicon.ico"
    ico_path.write_bytes(build_ico({size: scaled[size] for size in ICO_SIZES}))
    print(f"  ✓ {ico_path.relative_to(REPO_ROOT)}　（{', '.join(f'{s}x{s}' for s in ICO_SIZES)}）")


if __name__ == "__main__":
    main()
