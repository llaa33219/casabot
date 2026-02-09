import { Jimp, intToRGBA } from "jimp";
import chalk from "chalk";

const BRAILLE_BASE = 0x2800;

const BRAILLE_MAP = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
] as const;

export async function renderBrailleLogo(
  logoPath: string,
  maxWidth: number,
): Promise<string> {
  const image = await Jimp.read(logoPath);
  const targetPixelWidth = maxWidth * 2;
  image.resize({ w: targetPixelWidth });

  const { width, height } = image.bitmap;
  const lines: string[] = [];

  for (let y = 0; y < height; y += 4) {
    let line = "";

    for (let x = 0; x < width; x += 2) {
      let pattern = 0;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let onCount = 0;

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 2; col++) {
          const px = x + col;
          const py = y + row;
          if (px >= width || py >= height) continue;

          const { r, g, b, a } = intToRGBA(image.getPixelColor(px, py));
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

          if (a > 20 && brightness > 30) {
            pattern |= BRAILLE_MAP[row][col];
            rSum += r;
            gSum += g;
            bSum += b;
            onCount++;
          }
        }
      }

      if (onCount > 0) {
        const ch = String.fromCharCode(BRAILLE_BASE + pattern);
        const avgR = Math.round(rSum / onCount);
        const avgG = Math.round(gSum / onCount);
        const avgB = Math.round(bSum / onCount);
        line += chalk.rgb(avgR, avgG, avgB)(ch);
      } else {
        line += " ";
      }
    }

    lines.push(line);
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  return lines.join("\n");
}
