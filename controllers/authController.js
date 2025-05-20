require("dotenv").config();
const puppeteer = require("puppeteer");
const path = require("path");
const jwt = require("jsonwebtoken");
const { logger } = require("../middleware/logger");

const { LOGIN_URL } = require("../config/constants");
const {
  recognizeCaptchaWithRetry,
  cleanupCaptchaFiles,
} = require("../utils/captcha");

const JWT_SECRET = process.env.JWT_SECRET;

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

  let attempts = 0;
  const maxAttempts = 5;
  let lastError = null;

  while (attempts < maxAttempts) {
    try {
      if (attempts > 0) {
        try {
          const fs = require("fs");
          if (fs.existsSync(captchaPath)) {
            fs.unlinkSync(captchaPath);
          }
        } catch (e) {
          logger.error({
            message: "Error cleaning up previous captcha",
            error: e.message,
            stack: e.stack,
            url: req.originalUrl,
            method: req.method,
            body: req.body,
          });
        }
      }

      const { cookies, csrf } = await loginUser(login, passwd, captchaPath);
      cleanupCaptchaFiles(captchaPath);

      const jsessionCookie = cookies.find((c) => c.name === "JSESSIONID");

      if (!jsessionCookie) {
        throw new Error("JSESSIONID cookie not found");
      }

      const token = jwt.sign(
        {
          jsessionid: jsessionCookie.value,
          csrf: csrf,
        },
        JWT_SECRET,
        { expiresIn: "12h" }
      );

      return res.json({
        success: true,
        token: token,
        message:
          attempts > 0
            ? `Login successful after ${attempts + 1} attempts.`
            : "Login successful.",
      });
    } catch (err) {
      lastError = err;
      attempts++;
      logger.error({
        message: `Login attempt ${attempts} failed: ${err.message}`,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        body: req.body,
      });

      if (attempts >= maxAttempts) {
        break;
      }

      const waitTime = 1000 + attempts * 500;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  cleanupCaptchaFiles(captchaPath);
  logger.error({
    message: "Login failed after maximum attempts",
    error: lastError ? lastError.message : "Maximum login attempts reached",
    attempts: attempts,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
  });
  return res.status(401).json({
    success: false,
    error: lastError ? lastError.message : "Maximum login attempts reached",
    attempts: attempts,
  });
};
