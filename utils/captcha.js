const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const fs = require("fs");

async function preprocessCaptcha(imagePath) {
  const processedPath = imagePath.replace(".png", "_processed.png");
  await sharp(imagePath).grayscale().threshold(150).toFile(processedPath);
  return processedPath;
}

async function recognizeCaptchaWithRetry(imagePath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const processedPath = await preprocessCaptcha(imagePath);
      const {
        data: { text },
      } = await Tesseract.recognize(processedPath, "eng");
      const captchaText = text.trim().replace(/\s/g, "");

      console.log(`OCR attempt ${attempt}: "${captchaText}"`);

      if (captchaText && /^[a-zA-Z0-9]{4,7}$/.test(captchaText)) {
        return captchaText;
      }
      console.log("OCR result invalid, retrying...");
    } catch (err) {
      console.log(`OCR attempt ${attempt} failed:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Failed to read CAPTCHA text after retries");
}

function cleanupCaptchaFiles(captchaPath) {
  if (fs.existsSync(captchaPath)) {
    fs.unlinkSync(captchaPath);
  }

  const processedPath = captchaPath.replace(".png", "_processed.png");
  if (fs.existsSync(processedPath)) {
    fs.unlinkSync(processedPath);
  }
}

module.exports = {
  preprocessCaptcha,
  recognizeCaptchaWithRetry,
  cleanupCaptchaFiles,
};
