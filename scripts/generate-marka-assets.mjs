import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import sharp from "sharp";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = join(repoRoot, "assets/brand/marka/manifest.json");
const rawManifest = JSON.parse(await readFile(manifestPath, "utf8"));

export const manifest = {
  ...rawManifest,
  outputs: rawManifest.sources.flatMap((source) => source.outputs),
};

const sourcesByPath = new Map(
  manifest.sources.map((source) => [source.source, source]),
);

function normalizeBrandPalette(data, info) {
  const normalized = Buffer.from(data);

  for (let index = 0; index < normalized.length; index += info.channels) {
    const brightness =
      normalized[index] + normalized[index + 1] + normalized[index + 2];
    const color = brightness >= 384 ? [255, 255, 255] : [3, 19, 47];

    normalized[index] = color[0];
    normalized[index + 1] = color[1];
    normalized[index + 2] = color[2];
  }

  return normalized;
}

export async function generateAssets({
  outputRoot = repoRoot,
  writeIco = true,
} = {}) {
  for (const output of manifest.outputs) {
    const source = sourcesByPath.get(output.source);
    if (!source) {
      throw new Error(`Missing Marka source record for ${output.path}`);
    }

    const sourcePath = join(repoRoot, source.source);
    const destination = join(outputRoot, output.path);
    const { background, crop, padding } = source;
    const padX = Math.round(crop.width * padding);
    const padY = Math.round(crop.height * padding);

    await mkdir(dirname(destination), { recursive: true });

    const image = sharp(sourcePath).extract(crop).extend({
      top: padY,
      bottom: padY,
      left: padX,
      right: padX,
      background,
    });

    const { data: paddedCrop, info } = await image
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const normalizedCrop = normalizeBrandPalette(paddedCrop, info);

    const { data: resizedCrop, info: resizedInfo } = await sharp(
      normalizedCrop,
      {
        raw: {
          width: info.width,
          height: info.height,
          channels: info.channels,
        },
      },
    )
      .resize({
        width: output.width,
        height: output.height,
        fit: "contain",
        background,
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    await sharp(normalizeBrandPalette(resizedCrop, resizedInfo), {
      raw: {
        width: resizedInfo.width,
        height: resizedInfo.height,
        channels: resizedInfo.channels,
      },
    })
      .png({ compressionLevel: 9, palette: false })
      .toFile(destination);
  }

  if (!writeIco) {
    return;
  }

  const iconPath = join(
    outputRoot,
    "apps/web/public/brand/marka/marka-icon-48.png",
  );
  const faviconPath = join(outputRoot, "apps/web/app/favicon.ico");
  await mkdir(dirname(faviconPath), { recursive: true });
  await rm(faviconPath, { force: true });
  await execa("sips", ["-s", "format", "ico", iconPath, "--out", faviconPath]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generateAssets();
}
