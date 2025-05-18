const puppeteer = require("puppeteer");
const path = require("path");

const { LOGIN_URL } = require("../config/constants");
const {
  recognizeCaptchaWithRetry,
  cleanupCaptchaFiles,
} = require("../utils/captcha");

async function loginUser(login, passwd, captchaPath) {
  const launchOptions = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--disable-gpu",
    ],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

    launchOptions.args.push("--no-zygote", "--single-process");
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

  const captchaImg = await page.$('img[src*="captchas"]');
  if (!captchaImg) {
    await browser.close();
    throw new Error("CAPTCHA image not found");
  }
  await captchaImg.screenshot({ path: captchaPath });

  const captchaText = await recognizeCaptchaWithRetry(captchaPath);

  await page.type("#login", login);
  await page.type("#passwd", passwd);
  await page.type("#ccode", captchaText);

  const csrf = await page.$eval("#hdnCSRF", (el) => el.value);

  await page.evaluate(
    (login, passwd, captchaText, csrf) => {
      document.getElementById("txtAN").value = login;
      document.getElementById("txtSK").value = passwd;
      document.getElementById("hdnCaptcha").value = captchaText;
      document.getElementById("csrfPreventionSalt").value = csrf;
      document.getElementById("txtPageAction").value = "1";
    },
    login,
    passwd,
    captchaText,
    csrf
  );

  await Promise.all([
    page.$eval("#login_form", (form) => form.submit()),
    page
      .waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 })
      .catch(() => {}),
  ]);

  const finalUrl = page.url();
  const pageContent = await page.content();

  if (finalUrl.includes("youLogin.jsp") || pageContent.includes("Invalid")) {
    await browser.close();
    throw new Error("Login failed: Invalid credentials or captcha");
  }

  const cookies = await page.cookies();

  await browser.close();

  return { cookies, csrf };
}

exports.login = async (req, res) => {
  const { login, passwd } = req.body;
  const captchaPath = path.join(__dirname, "..", "captcha.png");

  // Add retries for the entire login process
  let attempts = 0;
  const maxAttempts = 5; // Increased from 3 to 5 for better success rate
  let lastError = null;

  while (attempts < maxAttempts) {
    try {
      // Clear previous captcha file if it exists
      if (attempts > 0) {
        try {
          const fs = require("fs");
          if (fs.existsSync(captchaPath)) {
            fs.unlinkSync(captchaPath);
          }
        } catch (e) {
          console.log("Error cleaning up previous captcha:", e.message);
        }
      }

      const { cookies, csrf } = await loginUser(login, passwd, captchaPath);
      cleanupCaptchaFiles(captchaPath); // Clean up on success
      return res.json({
        success: true,
        cookies,
        csrf,
        message:
          attempts > 0
            ? `Login successful after ${attempts + 1} attempts.`
            : "Login successful.",
      });
    } catch (err) {
      lastError = err;
      attempts++;
      console.log(`Login attempt ${attempts} failed: ${err.message}`);

      if (attempts >= maxAttempts) {
        break;
      }

      // More intelligent wait time between retries (increases with each attempt)
      const waitTime = 1000 + attempts * 500; // 1.5s, 2s, 2.5s, etc.
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  // Clean up captcha files before returning error
  cleanupCaptchaFiles(captchaPath);
  return res.status(401).json({
    success: false,
    error: lastError ? lastError.message : "Maximum login attempts reached",
    attempts: attempts,
  });
};
