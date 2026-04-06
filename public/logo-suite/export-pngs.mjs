import sharp from 'sharp';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const dir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const files = readdirSync(dir).filter(f => f.endsWith('.svg'));

for (const file of files) {
  const svgPath = join(dir, file);
  const pngPath = join(dir, file.replace('.svg', '.png'));
  const svg = readFileSync(svgPath);
  try {
    await sharp(svg).png().toFile(pngPath);
    console.log(`✓ ${file} → ${basename(pngPath)}`);
  } catch (e) {
    console.error(`✗ ${file}: ${e.message}`);
  }
}
