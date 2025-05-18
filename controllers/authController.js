const puppeteer = require("puppeteer");
const path = require("path");

const { LOGIN_URL } = require("../config/constants");
const {
  recognizeCaptchaWithRetry,
  cleanupCaptchaFiles,
} = require("../utils/captcha");

async function loginUser(login, passwd, captchaPath) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/home/ubuntu/chromium/chrome-linux/chrome',
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu"
    ],
  });
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

  try {
    const { cookies, csrf } = await loginUser(login, passwd, captchaPath);
    res.json({ success: true, cookies, csrf, message: "Login successful." });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  } finally {
    cleanupCaptchaFiles(captchaPath);
  }
};