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

function hexToRgb(color) {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
}

function isLight(color) {
  return hexToRgb(color).reduce((total, channel) => total + channel, 0) >= 384;
}

function normalizeBrandPalette(
  data,
  info,
  { background, foreground, sourceForeground },
) {
  const normalized = Buffer.from(data);
  const foregroundRgb = hexToRgb(foreground);
  const backgroundRgb = hexToRgb(background);
  const sourceForegroundIsLight = isLight(sourceForeground);

  for (let index = 0; index < normalized.length; index += info.channels) {
    const brightness =
      normalized[index] + normalized[index + 1] + normalized[index + 2];
    const isForeground = brightness >= 384 === sourceForegroundIsLight;
    const color = isForeground ? foregroundRgb : backgroundRgb;

    normalized[index] = color[0];
    normalized[index + 1] = color[1];
    normalized[index + 2] = color[2];
  }

  return normalized;
}

function makeTransparent(data, info, { foreground, sourceForeground }) {
  const transparent = Buffer.alloc((data.length / info.channels) * 4);
  const foregroundRgb = hexToRgb(foreground);
  const sourceForegroundIsLight = isLight(sourceForeground);

  for (
    let sourceIndex = 0, targetIndex = 0;
    sourceIndex < data.length;
    sourceIndex += info.channels, targetIndex += 4
  ) {
    const brightness =
      data[sourceIndex] + data[sourceIndex + 1] + data[sourceIndex + 2];
    const isForeground = brightness >= 384 === sourceForegroundIsLight;

    transparent[targetIndex] = foregroundRgb[0];
    transparent[targetIndex + 1] = foregroundRgb[1];
    transparent[targetIndex + 2] = foregroundRgb[2];
    transparent[targetIndex + 3] = isForeground ? 255 : 0;
  }

  return transparent;
}

function normalizeTransparentPalette(data, info, foreground) {
  const normalized = Buffer.from(data);
  const foregroundRgb = hexToRgb(foreground);

  for (let index = 0; index < normalized.length; index += info.channels) {
    if (normalized[index + 3] === 0) {
      normalized[index] = 0;
      normalized[index + 1] = 0;
      normalized[index + 2] = 0;
      continue;
    }

    normalized[index] = foregroundRgb[0];
    normalized[index + 1] = foregroundRgb[1];
    normalized[index + 2] = foregroundRgb[2];
  }

  return normalized;
}

async function roundedSquareAlpha(width, height, radius) {
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" rx="${radius}" fill="white" /></svg>`,
  );
  const { data, info } = await sharp(svg)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(width * height);

  for (
    let index = 0, alphaIndex = 0;
    index < data.length;
    index += info.channels, alphaIndex += 1
  ) {
    alpha[alphaIndex] = data[index + 3];
  }

  return alpha;
}

async function applyRoundedSquareCorners(data, info, radius) {
  const rounded =
    info.channels === 4
      ? Buffer.from(data)
      : Buffer.alloc((data.length / info.channels) * 4);

  if (info.channels !== 4) {
    for (
      let sourceIndex = 0, targetIndex = 0;
      sourceIndex < data.length;
      sourceIndex += info.channels, targetIndex += 4
    ) {
      rounded[targetIndex] = data[sourceIndex];
      rounded[targetIndex + 1] = data[sourceIndex + 1];
      rounded[targetIndex + 2] = data[sourceIndex + 2];
      rounded[targetIndex + 3] = 255;
    }
  }

  const alpha = await roundedSquareAlpha(info.width, info.height, radius);

  for (
    let index = 0, alphaIndex = 0;
    index < rounded.length;
    index += 4, alphaIndex += 1
  ) {
    rounded[index + 3] = Math.round(
      (rounded[index + 3] * alpha[alphaIndex]) / 255,
    );
  }

  return { data: rounded, info: { ...info, channels: 4 } };
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
    const { crop, padding } = source;
    const foreground = output.foreground ?? source.foreground;
    const background = output.background ?? source.background;
    const palette = {
      background,
      foreground,
      sourceForeground: source.foreground,
    };
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
    const input =
      background === "transparent"
        ? makeTransparent(paddedCrop, info, palette)
        : normalizeBrandPalette(paddedCrop, info, palette);
    const inputInfo = {
      width: info.width,
      height: info.height,
      channels: background === "transparent" ? 4 : info.channels,
    };

    const { data: resizedCrop, info: resizedInfo } = await sharp(input, {
      raw: {
        ...inputInfo,
      },
    })
      .resize({
        width: output.width,
        height: output.height,
        fit: "contain",
        background:
          background === "transparent"
            ? { r: 0, g: 0, b: 0, alpha: 0 }
            : background,
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let finalPixels =
      background === "transparent"
        ? normalizeTransparentPalette(resizedCrop, resizedInfo, foreground)
        : normalizeBrandPalette(resizedCrop, resizedInfo, palette);
    let finalInfo = resizedInfo;

    if (output.cornerRadius) {
      const rounded = await applyRoundedSquareCorners(
        finalPixels,
        finalInfo,
        output.cornerRadius,
      );
      finalPixels = rounded.data;
      finalInfo = rounded.info;
    }

    await sharp(finalPixels, {
      raw: {
        width: finalInfo.width,
        height: finalInfo.height,
        channels: finalInfo.channels,
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
