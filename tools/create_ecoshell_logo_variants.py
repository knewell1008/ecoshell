from pathlib import Path
from PIL import Image

BLACK_SRC = Path(r"G:\Shared drives\Ecoshell Core\Ecoshell Marketing and Branding\Branding Guidelines\Brand Icons & Logos\Ecoshell Main Logo - black text.png")
WHITE_SRC = Path(r"G:\Shared drives\Ecoshell Core\Ecoshell Marketing and Branding\Branding Guidelines\Brand Icons & Logos\Ecoshell Main Logo - white text.png")
OUT_DIR = Path(r"C:\Users\Sisters\Documents\Ecoshell\Site\brand-output")

CREAM = (248, 245, 239, 255)
DARK = (14, 31, 26, 255)
DARK_BG = (25, 65, 47, 255)
GREEN = (95, 169, 116, 255)
LIGHT_GREEN = (127, 196, 146, 255)
WHITE = (255, 255, 255, 255)


def is_green(r, g, b):
    return g > 90 and g > r * 1.25 and g > b * 1.25


def recolor_logo(src, text_color, egg_color):
    im = Image.open(src).convert("RGBA")
    pixels = im.load()
    width, height = im.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            target = egg_color if is_green(r, g, b) else text_color
            pixels[x, y] = (*target[:3], a)
    return im


def on_background(logo, bg_color):
    bg = Image.new("RGBA", logo.size, bg_color)
    bg.alpha_composite(logo)
    return bg


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    primary_logo = recolor_logo(BLACK_SRC, DARK, GREEN)
    primary = on_background(primary_logo, CREAM)
    primary.save(OUT_DIR / "Ecoshell Logo - primary on light.png")

    reversed_logo = recolor_logo(WHITE_SRC, WHITE, LIGHT_GREEN)
    reversed_img = on_background(reversed_logo, DARK_BG)
    reversed_img.save(OUT_DIR / "Ecoshell Logo - reversed on dark.png")

    one_colour_logo = recolor_logo(BLACK_SRC, DARK, DARK)
    one_colour = on_background(one_colour_logo, WHITE)
    one_colour.save(OUT_DIR / "Ecoshell Logo - one colour.png")

    print(OUT_DIR)


if __name__ == "__main__":
    main()
