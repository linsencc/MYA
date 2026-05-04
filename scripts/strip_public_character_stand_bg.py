"""
public/characters/char_<id>/cg_stand.png 立绘管线：

1. （可选）rembg 去底
2. 按 alpha 外接矩形裁掉透明边（可忽略极淡半透明边缘，更贴近「红框」）
3. 默认：只输出紧裁图（无左右大块透明底）
4. 可选：--fit-canvas 将人物等比装入固定画布（与旧版一致）

依赖：pip install pillow
可选去底：pip install rembg

仓库根目录执行：
  python scripts/strip_public_character_stand_bg.py
  python scripts/strip_public_character_stand_bg.py --fit-canvas
  python scripts/strip_public_character_stand_bg.py --rembg
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

from PIL import Image

try:
    from rembg import remove as rembg_remove
except ImportError:
    rembg_remove = None  # type: ignore[misc, assignment]

# 装入固定画布时使用（与历史资源一致）
CANVAS_W = 1536
CANVAS_H = 1024
# 相对人物 bbox 最大边的额外边距比例（避免切到发丝）
MARGIN_RATIO = 0.02
# 计算外接框时忽略 alpha <= 该值的像素（去掉淡边，裁得更紧）
ALPHA_BBOX_MIN = 12
# 装入画布时再留一点余量
FIT_PAD_RATIO = 0.01


def repo_root() -> Path:
    here = Path(__file__).resolve()
    for p in [here.parent.parent, *here.parents]:
        pkg = p / "package.json"
        if pkg.is_file():
            try:
                name = json.loads(pkg.read_text(encoding="utf-8")).get("name")
                if name == "mya":
                    return p
            except OSError:
                pass
    return here.parent.parent


def _bbox_with_margin(
    img: Image.Image,
    margin_ratio: float,
    *,
    alpha_min: int,
) -> tuple[int, int, int, int]:
    """RGBA：非透明（alpha > alpha_min）像素外接矩形 + 边距。"""
    rgba = img.convert("RGBA")
    a = rgba.getchannel("A")
    if alpha_min > 0:
        a = a.point(lambda p, m=alpha_min: 255 if p > m else 0)
    bbox = a.getbbox()
    if bbox is None:
        return (0, 0, rgba.width, rgba.height)
    l, t, r, b = bbox
    w, h = r - l, b - t
    m = int(max(w, h) * margin_ratio) + 1
    L = max(0, l - m)
    T = max(0, t - m)
    R = min(rgba.width, r + m)
    B = min(rgba.height, b + m)
    return (L, T, R, B)


def crop_tight(
    img: Image.Image,
    *,
    margin_ratio: float,
    alpha_min: int,
) -> Image.Image:
    rgba = img.convert("RGBA")
    box = _bbox_with_margin(rgba, margin_ratio, alpha_min=alpha_min)
    return rgba.crop(box)


def crop_align_to_canvas(
    img: Image.Image,
    canvas_w: int,
    canvas_h: int,
    *,
    margin_ratio: float,
    fit_pad_ratio: float,
    alpha_min: int,
) -> Image.Image:
    cropped = crop_tight(img, margin_ratio=margin_ratio, alpha_min=alpha_min)
    cw, ch = cropped.size
    if cw < 1 or ch < 1:
        return Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    inner_w = canvas_w * (1.0 - fit_pad_ratio * 2)
    inner_h = canvas_h * (1.0 - fit_pad_ratio * 2)
    scale = min(inner_w / cw, inner_h / ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)

    out = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    x = (canvas_w - nw) // 2
    y = canvas_h - nh
    out.paste(resized, (x, y), resized)
    return out


def process_one(
    png: Path,
    *,
    do_rembg: bool,
    fit_canvas: bool,
    repo: Path,
    alpha_min: int,
) -> tuple[str, int, tuple[int, int]]:
    rel = png.relative_to(repo)
    raw = png.read_bytes()
    if do_rembg:
        if rembg_remove is None:
            raise RuntimeError("rembg 未安装：pip install rembg")
        raw = rembg_remove(raw)
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    if fit_canvas:
        final = crop_align_to_canvas(
            img,
            CANVAS_W,
            CANVAS_H,
            margin_ratio=MARGIN_RATIO,
            fit_pad_ratio=FIT_PAD_RATIO,
            alpha_min=alpha_min,
        )
        size = (CANVAS_W, CANVAS_H)
    else:
        final = crop_tight(img, margin_ratio=MARGIN_RATIO, alpha_min=alpha_min)
        size = final.size
    buf = io.BytesIO()
    final.save(buf, format="PNG", optimize=True)
    data = buf.getvalue()
    png.write_bytes(data)
    return str(rel).replace("\\", "/"), len(data), size


def main() -> int:
    ap = argparse.ArgumentParser(description="cg_stand.png 去底 / 裁透明边 / 可选固定画布")
    ap.add_argument(
        "--rembg",
        action="store_true",
        help="先运行 rembg 去底（较慢）",
    )
    ap.add_argument(
        "--fit-canvas",
        action="store_true",
        help=f"裁边后再等比装入 {CANVAS_W}x{CANVAS_H} 画布（会重新出现左右透明）",
    )
    ap.add_argument(
        "--alpha-min",
        type=int,
        default=ALPHA_BBOX_MIN,
        metavar="N",
        help=f"计算外接框时忽略 alpha<=N 的像素（默认 {ALPHA_BBOX_MIN}，0=不忽略）",
    )
    args = ap.parse_args()

    repo = repo_root()
    root = repo / "public" / "characters"
    if not root.is_dir():
        print("missing", root, file=sys.stderr)
        return 1
    paths = sorted(root.glob("char_*/cg_stand.png"))
    if not paths:
        print("no cg_stand.png found")
        return 0

    for png in paths:
        try:
            rel, n, wh = process_one(
                png,
                do_rembg=args.rembg,
                fit_canvas=args.fit_canvas,
                repo=repo,
                alpha_min=max(0, args.alpha_min),
            )
            mode = f"canvas {CANVAS_W}x{CANVAS_H}" if args.fit_canvas else f"tight {wh[0]}x{wh[1]}"
            print(f"{rel}: ok ({n} bytes, {mode})")
        except Exception as e:  # noqa: BLE001
            print(f"{png}: FAILED: {e}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
