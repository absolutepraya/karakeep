const minimumScore = Number(process.argv[2]);

if (!Number.isFinite(minimumScore)) {
  throw new Error("Usage: check-react-doctor-score.mjs <minimum-score>");
}

let output = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  output += chunk;
});
process.stdin.on("end", () => {
  try {
    const report = JSON.parse(output);
    const score = report.summary?.score;

    if (typeof score !== "number") {
      throw new Error("React Doctor did not report a numeric health score.");
    }

    if (score < minimumScore) {
      throw new Error(
        `React Doctor score ${score} is below the required ${minimumScore}.`,
      );
    }

    console.log(
      `React Doctor score ${score} meets the required ${minimumScore}.`,
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Unable to check React Doctor score.",
    );
    process.exitCode = 1;
  }
});
