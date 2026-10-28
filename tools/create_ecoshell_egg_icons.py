from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(
    r"G:\Shared drives\Ecoshell Core\Ecoshell Marketing and Branding\Branding Guidelines"
    r"\Brand Icons & Logos\Logos\Ecoshell Main Logo - black text.png"
)
OUT = ROOT / "brand-output"

DARK = (24, 63, 47, 255)
DEEP = (13, 31, 26, 255)
SAGE = (127, 196, 146, 255)
CREAM = (246, 242, 234, 255)
MUTED = (93, 111, 101, 255)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\Aptos-Bold.ttf" if bold else r"C:\Windows\Fonts\Aptos.ttf",
        r"C:\Windows\Fonts\Arialbd.ttf" if bold else r"C:\Windows\Fonts\Arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def extract_logo_egg() -> Image.Image:
    source = Image.open(SOURCE).convert("RGBA")
    pixels = source.load()
    mask = Image.new("L", source.size, 0)
    mask_px = mask.load()

    for y in range(source.height):
        for x in range(source.width):
            r, g, b, a = pixels[x, y]
            if a and g > 70 and g > r * 1.35 and g > b * 1.25:
                mask_px[x, y] = a

    bbox = mask.getbbox()
    if not bbox:
        raise RuntimeError("Could not find the green egg shape in the source logo.")

    cropped_mask = mask.crop(bbox)
    egg = Image.new("RGBA", cropped_mask.size, SAGE)
    egg.putalpha(cropped_mask)
    return egg


def resize_by_height(image: Image.Image, height: int) -> Image.Image:
    ratio = height / image.height
    width = round(image.width * ratio)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def tint(image: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
    alpha = image.getchannel("A")
    tinted = Image.new("RGBA", image.size, color)
    tinted.putalpha(alpha)
    return tinted


def make_outline_from_alpha(image: Image.Image, stroke: int) -> Image.Image:
    alpha = image.getchannel("A")
    grown = alpha.filter(ImageFilter.MaxFilter(stroke * 2 + 1))
    shrunk = alpha.filter(ImageFilter.MinFilter(stroke * 2 + 1))
    outline_alpha = Image.eval(
        ImageChops.subtract(grown, shrunk),
        lambda value: min(255, value * 2),
    )
    outline = Image.new("RGBA", image.size, SAGE)
    outline.putalpha(outline_alpha)
    return outline


def draw_label(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int], fill) -> None:
    draw.text(xy, text, font=load_font(17, bold=True), fill=fill)


def make_egg_panel(egg: Image.Image) -> Path:
    panel = Image.new("RGBA", (640, 360), DARK)
    draw = ImageDraw.Draw(panel)
    draw_label(draw, "EGG SILHOUETTE", (34, 28), SAGE)

    mark = resize_by_height(tint(egg, SAGE), 152)
    panel.alpha_composite(mark, ((panel.width - mark.width) // 2, 116))

    path = OUT / "Ecoshell Graphic Element - egg silhouette panel.png"
    panel.save(path)
    return path


def make_custom_tile(egg: Image.Image) -> Path:
    tile = Image.new("RGBA", (260, 210), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tile)
    draw.rounded_rectangle((16, 16, 244, 184), radius=22, fill=DARK)

    mark = resize_by_height(tint(egg, SAGE), 82)
    x = (tile.width - mark.width) // 2
    y = 16 + ((184 - 16) - mark.height) // 2
    tile.alpha_composite(mark, (x, y))

    path = OUT / "Ecoshell Graphic Element - custom egg icon tile.png"
    tile.save(path)
    return path


def make_standalone_assets(egg: Image.Image) -> list[Path]:
    filled = resize_by_height(tint(egg, SAGE), 512)
    filled_path = OUT / "Ecoshell Egg Silhouette - transparent.png"
    filled.save(filled_path)

    dark = resize_by_height(tint(egg, DEEP), 512)
    dark_path = OUT / "Ecoshell Egg Silhouette - one colour transparent.png"
    dark.save(dark_path)
    return [filled_path, dark_path]


def make_preview(paths: list[Path]) -> Path:
    preview = Image.new("RGBA", (1200, 720), (255, 255, 255, 255))
    draw = ImageDraw.Draw(preview)
    draw.text((48, 42), "Ecoshell egg icon remakes", font=load_font(36), fill=DEEP)
    draw.text(
        (48, 95),
        "Built from the egg shape extracted from the main wordmark.",
        font=load_font(19),
        fill=MUTED,
    )

    panel = Image.open(paths[0]).convert("RGBA")
    preview.alpha_composite(panel, (48, 150))

    tile = Image.open(paths[1]).convert("RGBA")
    preview.alpha_composite(tile, (760, 210))
    draw.text((775, 430), "Custom icon tile", font=load_font(22, bold=True), fill=MUTED)

    filled = Image.open(paths[2]).convert("RGBA").resize((92, 138), Image.Resampling.LANCZOS)
    dark = Image.open(paths[3]).convert("RGBA").resize((92, 138), Image.Resampling.LANCZOS)
    draw.rounded_rectangle((752, 506, 980, 652), radius=12, outline=(220, 226, 220, 255), width=2)
    preview.alpha_composite(filled, (790, 510))
    preview.alpha_composite(dark, (890, 510))

    path = OUT / "Ecoshell Egg Icon Remakes - preview.png"
    preview.save(path)
    return path


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    logo_egg = extract_logo_egg()
    created = [make_egg_panel(logo_egg), make_custom_tile(logo_egg)]
    created.extend(make_standalone_assets(logo_egg))
    preview_path = make_preview(created)

    print("Created:")
    for item in created + [preview_path]:
        print(item)
