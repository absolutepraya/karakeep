import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { generateAssets, manifest } from "./generate-marka-assets.mjs";

const BRAND_NAVY = [3, 19, 47];
const BRAND_WHITE = [255, 255, 255];
const SOURCE_HASHES = {
  "assets/brand/marka/source/marka-navy-app-icon.png":
    "9e7ebfe3ada9756fdc3eda2757c73b4da13b439d9ae06e147dbe5a8692c881f3",
  "assets/brand/marka/source/marka-navy-mark.png":
    "8e52090957e27ca853cc054be622091bf207b697aea6befc0f67e5a9f53b6dd7",
  "assets/brand/marka/source/marka-navy-wordmark.png":
    "bbce1cadff00fd9b1e70597f01cc00f6c369fabae5994c9d0b91a95e364fdb58",
  "assets/brand/marka/source/marka-white-app-icon.png":
    "6c426b5e50eeaea82d41d77dda9e67590062b255fbe9687ce6753f26eef00b1a",
  "assets/brand/marka/source/marka-white-mark.png":
    "f76da5e383b5c4a1ff004b6399da1a736fee090bdd9cdbcf172b2213d0ca3e2b",
  "assets/brand/marka/source/marka-white-wordmark.png":
    "977ca1221aee8810668e1b2b5a4009304dcfd902eb7b81dda52ff360799050c9",
};

async function colorsIn(path) {
  const { data, info } = await sharp(path)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set();

  for (let index = 0; index < data.length; index += info.channels) {
    if (info.channels === 4 && data[index + 3] === 0) {
      continue;
    }

    colors.add(
      `${data[index].toString(16).padStart(2, "0")}${data[index + 1]
        .toString(16)
        .padStart(2, "0")}${data[index + 2].toString(16).padStart(2, "0")}`,
    );
  }

  return colors;
}

async function pixelsIn(path) {
  return sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function pixelAt(data, info, x, y) {
  const index = (y * info.width + x) * info.channels;
  return [...data.subarray(index, index + info.channels)];
}

test("preserves the supplied Marka source PNG bytes", async () => {
  for (const [path, expectedHash] of Object.entries(SOURCE_HASHES)) {
    const source = await readFile(path);
    const actualHash = createHash("sha256").update(source).digest("hex");
    assert.equal(actualHash, expectedHash, path);
  }
});

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

test("regenerates Marka assets deterministically", async () => {
  const firstOutputRoot = await mkdtemp(join(tmpdir(), "marka-assets-"));
  const secondOutputRoot = await mkdtemp(join(tmpdir(), "marka-assets-"));
  await generateAssets({ outputRoot: firstOutputRoot, writeIco: false });
  await generateAssets({ outputRoot: secondOutputRoot, writeIco: false });

  for (const output of manifest.outputs) {
    const [first, second] = await Promise.all([
      readFile(join(firstOutputRoot, output.path)),
      readFile(join(secondOutputRoot, output.path)),
    ]);
    assert.deepEqual(first, second, output.path);
  }
});

test("generates only exact navy and white nontransparent Marka pixels", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "marka-assets-"));
  await generateAssets({ outputRoot, writeIco: false });

  const approvedColors = new Set([
    BRAND_NAVY.map((part) => part.toString(16).padStart(2, "0")).join(""),
    BRAND_WHITE.map((part) => part.toString(16).padStart(2, "0")).join(""),
  ]);

  for (const output of manifest.outputs) {
    const colors = await colorsIn(join(outputRoot, output.path));
    assert.ok(colors.size > 0, output.path);
    assert.ok(
      [...colors].every((color) => approvedColors.has(color)),
      output.path,
    );
  }
});

test("generates transparent header wordmarks from one shared alpha geometry", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "marka-assets-"));
  await generateAssets({ outputRoot, writeIco: false });
  const navyPath = join(
    outputRoot,
    "apps/web/public/brand/marka/marka-wordmark-navy.png",
  );
  const whitePath = join(
    outputRoot,
    "apps/web/public/brand/marka/marka-wordmark-white.png",
  );
  const navy = await pixelsIn(navyPath);
  const white = await pixelsIn(whitePath);

  assert.deepEqual(navy.info, white.info);
  assert.equal(navy.info.channels, 4);

  for (let index = 0; index < navy.data.length; index += 4) {
    assert.equal(navy.data[index + 3], white.data[index + 3]);
    if (navy.data[index + 3] === 0) {
      continue;
    }

    assert.deepEqual([...navy.data.subarray(index, index + 3)], BRAND_NAVY);
    assert.deepEqual([...white.data.subarray(index, index + 3)], BRAND_WHITE);
  }
});

test("generates rounded-square favicon tiles with transparent outer corners", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "marka-assets-"));
  await generateAssets({ outputRoot, writeIco: false });

  for (const name of ["marka-favicon-light.png", "marka-favicon-dark.png"]) {
    const { data, info } = await pixelsIn(
      join(outputRoot, "apps/web/public/brand/marka", name),
    );

    for (const [x, y] of [
      [0, 0],
      [info.width - 1, 0],
      [0, info.height - 1],
      [info.width - 1, info.height - 1],
    ]) {
      assert.equal(pixelAt(data, info, x, y)[3], 0, `${name} at ${x},${y}`);
    }

    assert.equal(pixelAt(data, info, 0, Math.floor(info.height / 2))[3], 255);
    assert.equal(pixelAt(data, info, Math.floor(info.width / 2), 0)[3], 255);
    assert.ok(pixelAt(data, info, 2, 2)[3] < 255);
    assert.equal(pixelAt(data, info, 10, 0)[3], 255);
    assert.equal(
      pixelAt(
        data,
        info,
        Math.floor(info.width / 2),
        Math.floor(info.height / 2),
      )[3],
      255,
    );
  }
});
