import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { generateAssets, manifest } from "./generate-marka-assets.mjs";

const BRAND_NAVY = [3, 19, 47];
const BRAND_WHITE = [255, 255, 255];

async function colorsIn(path) {
  const { data, info } = await sharp(path)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set();

  for (let index = 0; index < data.length; index += info.channels) {
    colors.add(
      `${data[index].toString(16).padStart(2, "0")}${data[index + 1]
        .toString(16)
        .padStart(2, "0")}${data[index + 2].toString(16).padStart(2, "0")}`,
    );
  }

  return colors;
}

test("generates every declared Marka PNG at its manifest dimensions", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "marka-assets-"));
  await generateAssets({ outputRoot, writeIco: false });
  for (const output of manifest.outputs) {
    const metadata = await sharp(join(outputRoot, output.path)).metadata();
    assert.equal(metadata.format, "png");
    assert.equal(metadata.width, output.width);
    assert.equal(metadata.height, output.height);
  }
});

test("generates only exact navy and white Marka pixels", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "marka-assets-"));
  await generateAssets({ outputRoot, writeIco: false });

  const approvedColors = [
    BRAND_NAVY.map((part) => part.toString(16).padStart(2, "0")).join(""),
    BRAND_WHITE.map((part) => part.toString(16).padStart(2, "0")).join(""),
  ].sort();

  for (const output of manifest.outputs) {
    const colors = [...(await colorsIn(join(outputRoot, output.path)))].sort();
    assert.deepEqual(colors, approvedColors, output.path);
  }
});
