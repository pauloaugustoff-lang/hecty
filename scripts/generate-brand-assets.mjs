// Gera os derivados técnicos da identidade Hecty (favicon, ícones PWA,
// imagem de compartilhamento) a partir dos arquivos originais em
// public/brand/. Não redesenha nem altera o desenho da marca — apenas
// redimensiona e compõe sobre fundos sólidos da paleta oficial.
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BRAND = path.join(ROOT, "public", "brand");
const APP = path.join(ROOT, "src", "app");

const NAVY = "#0B1D3A";

const ICON_SOURCE = path.join(BRAND, "hecty-icon-source.png");
const LOGO_REVERSE = path.join(BRAND, "hecty-logo-horizontal-reversa.png");

async function main() {
  await mkdir(APP, { recursive: true });

  // favicon.ico multi-tamanho (16/32/48) --------------------------------
  const icoSizes = [16, 32, 48];
  const icoPngs = await Promise.all(
    icoSizes.map((size) =>
      // .ensureAlpha() garante RGBA mesmo a partir de uma fonte opaca.
      sharp(ICON_SOURCE).resize(size, size, { fit: "cover" }).ensureAlpha().png().toBuffer(),
    ),
  );
  const icoBuffer = await pngToIco(icoPngs);
  await writeFile(path.join(APP, "favicon.ico"), icoBuffer);
  console.log("✓ src/app/favicon.ico");

  // icon.png (usado pelo Next.js para <link rel="icon">) -----------------
  await sharp(ICON_SOURCE).resize(512, 512, { fit: "cover" }).png().toFile(path.join(APP, "icon.png"));
  console.log("✓ src/app/icon.png");

  // apple-icon.png (apple-touch-icon, sem transparência, cantos não
  // arredondados — o próprio iOS aplica a máscara) -----------------------
  await sharp(ICON_SOURCE).resize(180, 180, { fit: "cover" }).png().toFile(path.join(APP, "apple-icon.png"));
  console.log("✓ src/app/apple-icon.png");

  // Ícones para o manifest PWA -------------------------------------------
  for (const size of [192, 512]) {
    await sharp(ICON_SOURCE)
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(path.join(BRAND, `hecty-icon-${size}.png`));
    console.log(`✓ public/brand/hecty-icon-${size}.png`);
  }

  // opengraph-image.png (1200x630): logotipo reverso original,
  // redimensionado sem distorção e centralizado sobre um fundo sólido na
  // cor oficial — a arte do logo em si não é alterada, só posicionada. ---
  const OG_W = 1200;
  const OG_H = 630;
  const logoMeta = await sharp(LOGO_REVERSE).metadata();
  const maxLogoW = Math.round(OG_W * 0.72);
  const maxLogoH = Math.round(OG_H * 0.42);
  const scale = Math.min(maxLogoW / logoMeta.width, maxLogoH / logoMeta.height);
  const logoW = Math.round(logoMeta.width * scale);
  const logoH = Math.round(logoMeta.height * scale);

  const resizedLogo = await sharp(LOGO_REVERSE).resize(logoW, logoH).png().toBuffer();

  await sharp({
    create: { width: OG_W, height: OG_H, channels: 3, background: NAVY },
  })
    .composite([{ input: resizedLogo, left: Math.round((OG_W - logoW) / 2), top: Math.round((OG_H - logoH) / 2) }])
    .png()
    .toFile(path.join(APP, "opengraph-image.png"));
  console.log("✓ src/app/opengraph-image.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
