const express = require("express");
const puppeteer = require("puppeteer");
const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const LOGIN_URL =
  "https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp";
const PROFILE_URL =
  "https://sp.srmist.edu.in/srmiststudentportal/students/report/studentProfile.jsp";

app.post("/login-and-profile", async (req, res) => {
  const { login, passwd } = req.body;
  const captchaPath = path.join(__dirname, "captcha.png");
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();

    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

    const captchaImg = await page.$('img[src*="captchas"]');
    if (!captchaImg) throw new Error("CAPTCHA image not found");
    await captchaImg.screenshot({ path: captchaPath });

    const {
      data: { text },
    } = await Tesseract.recognize(captchaPath, "eng");
    const captchaText = text.trim().replace(/\s/g, "");

    console.log("OCR Captcha:", captchaText);

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
      throw new Error("Login failed: Invalid credentials or captcha");
    }

    const profileHTML = await page.evaluate(
      async (url, csrf) => {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `iden=1&filter=&hdnFormDetails=1&csrfPreventionSalt=${encodeURIComponent(
            csrf
          )}`,
        });
        return response.text();
      },
      PROFILE_URL,
      csrf
    );

    const extract = (html, label) => {
      const re = new RegExp(
        label + '[\\s\\S]*?<div class="[^"]*?">([^<]+)<\\/div>',
        "i"
      );
      const match = html.match(re);
      return match ? match[1].trim() : "N/A";
    };

    const profile = {
      name: extract(profileHTML, "Student Name"),
      studentId: extract(profileHTML, "Student ID"),
      regNo: extract(profileHTML, "Register No\\."),
      email: extract(profileHTML, "Email ID"),
    };

    res.json({
      success: true,
      message: "Login and profile fetched successfully.",
      profile,
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (browser) await browser.close();
    if (fs.existsSync(captchaPath)) fs.unlinkSync(captchaPath);
  }
});

const PORT = 9000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
