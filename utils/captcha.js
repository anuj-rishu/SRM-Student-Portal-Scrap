const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const fs = require("fs");

async function preprocessCaptcha(imagePath) {
  const processedPath = imagePath.replace(".png", "_processed.png");
  
  
  await sharp(imagePath)
    .grayscale()
    .normalize() 
    .median(1)   
    .threshold(160) 
    .toFile(processedPath);
    
  return processedPath;
}

async function recognizeCaptchaWithRetry(imagePath, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const processedPath = await preprocessCaptcha(imagePath);
      
      const result = await Tesseract.recognize(processedPath, 'eng', {
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        tessjs_create_hocr: false,
        tessjs_create_tsv: false
      });
      
  
      let captchaText = result.data.text.trim();
      captchaText = captchaText.replace(/\s+/g, ''); 
      captchaText = captchaText.replace(/[^a-zA-Z0-9]/g, '');
      
      if (captchaText.length < 4 || captchaText.length > 8) {
        throw new Error("Invalid captcha length");
      }
      
      return captchaText;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Failed to recognize captcha after ${maxRetries} attempts: ${error.message}`);
      }
      console.log(`OCR attempt ${attempt} failed: ${error.message}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
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
