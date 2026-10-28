from pathlib import Path
from PIL import Image

src = Path(r"G:\Shared drives\Ecoshell Core\Ecoshell Marketing and Branding\Branding Guidelines\Brand Icons & Logos\Ecoshell Main Logo.png")
out = Path(r"C:\Users\Sisters\Documents\Ecoshell\Site\Ecoshell Main Logo - white text.png")

im = Image.open(src).convert("RGBA")
pix = im.load()
width, height = im.size
changed = 0
kept = 0

for y in range(height):
    for x in range(width):
        r, g, b, a = pix[x, y]
        if a == 0:
            continue

        # Preserve the green egg mark. Recolor every other visible logo pixel,
        # including anti-aliased black/gray text edges, to white.
        is_green_egg = g > 90 and r < 80 and b < 120 and g > r * 1.4
        if is_green_egg:
            kept += 1
            continue

        pix[x, y] = (255, 255, 255, a)
        changed += 1

im.save(out)
print(out)
print(f"changed={changed} kept={kept} size={im.size}")
