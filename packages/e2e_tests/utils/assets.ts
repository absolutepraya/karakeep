import * as fs from "fs";
import * as path from "path";

const pdfFixturePath = path.join(__dirname, "..", "fixtures", "test.pdf");
const pdfContent = fs.readFileSync(pdfFixturePath);

export function createTestPdfFile(fileName = "test.pdf"): File {
  return new File([pdfContent], fileName, {
    type: "application/pdf",
  });
}

const pngContent = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44,
  0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0x0f, 0x00, 0x00, 0x01, 0x00, 0x01, 0x5c,
  0xc2, 0x8a, 0x8e, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
]);

export function createTestImageFile(fileName = "test.png"): File {
  return new File([pngContent], fileName, {
    type: "image/png",
  });
}

// Minimal valid containers are enough for the upload MIME sniffer. These
// fixtures keep the API tests small while still exercising real video types.
const mp4Content = Buffer.from("AAAAGGZ0eXBpc29tAAAAAGlzb21pc28y", "base64");

const webmContent = Buffer.from(
  "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAHsEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsggElTbuMU6uEHFO7a1OsggHW7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjIuMTIuMTAyV0GNTGF2ZjYyLjEyLjEwMkSJiECPQAAAAAAAFlSua8iuAQAAAAAAAD/XgQFzxYjrTyjvvBhgnZyBACK1nIN1bmSIgQCGhVZfVlA5g4EBI+ODhDuaygDgkLCBELqBEJqBAlWwhFW5gQESVMNnQIBzc6BjwIBnyJpFo4dFTkNPREVSRIeNTGF2ZjYyLjEyLjEwMnNz2mPAi2PFiOtPKO+8GGCdZ8ilRaOHRU5DT0RFUkSHmExhdmM2Mi4yOC4xMDIgbGlidnB4LXZwOWfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDEuMDAwMDAwMDAwAB9DtnWm54EAo6GBAACAgkmDQgAA8AD2ADgkHBhCAAAwYAAAEL///YsqAAAcU7trkbuPs4EAt4r3gQHxggGr8IED",
  "base64",
);

export function createTestVideoFile(
  fileName = "test.mp4",
  contentType = "video/mp4",
): File {
  const content = contentType === "video/webm" ? webmContent : mp4Content;
  return new File([content], fileName, { type: contentType });
}

const wavContent = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x2c, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66,
  0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x40, 0x1f,
  0x00, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x01, 0x00, 0x08, 0x00, 0x64, 0x61, 0x74,
  0x61, 0x08, 0x00, 0x00, 0x00, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80,
]);

export function createTestAudioFile(fileName = "test.wav"): File {
  return new File([wavContent], fileName, { type: "audio/wav" });
}
