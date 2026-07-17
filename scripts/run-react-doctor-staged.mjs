import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const snapshotDirectory = mkdtempSync(
  join(tmpdir(), "karakeep-react-doctor-staged-"),
);

try {
  const checkout = spawnSync(
    "git",
    ["checkout-index", "--all", `--prefix=${snapshotDirectory}/`],
    { cwd: repositoryRoot, stdio: "inherit" },
  );

  if (checkout.status !== 0) {
    process.exitCode = checkout.status ?? 1;
  } else {
    const doctor = spawnSync(
      join(repositoryRoot, "node_modules", ".bin", "react-doctor"),
      [
        "--project",
        "@karakeep/web,@karakeep/browser-extension,@karakeep/mobile,@karakeep/landing,@karakeep/shared-react",
        "--scope",
        "full",
        "--no-score",
        "--blocking",
        "none",
      ],
      { cwd: snapshotDirectory, stdio: "inherit" },
    );
    process.exitCode = doctor.status ?? 1;
  }
} finally {
  rmSync(snapshotDirectory, { recursive: true, force: true });
}
