const express = require('express');
const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const LOGIN_URL = 'https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp';
const PERSONAL_DETAILS_URL = 'https://sp.srmist.edu.in/srmiststudentportal/students/report/studentPersonalDetails.jsp';

async function preprocessCaptcha(imagePath) {
  const processedPath = imagePath.replace('.png', '_processed.png');
  await sharp(imagePath)
    .grayscale()
    .threshold(150)
    .toFile(processedPath);
  return processedPath;
}

async function recognizeCaptchaWithRetry(imagePath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const processedPath = await preprocessCaptcha(imagePath);
      const { data: { text } } = await Tesseract.recognize(processedPath, 'eng');
      const captchaText = text.trim().replace(/\s/g, '');

      console.log(`OCR attempt ${attempt}: "${captchaText}"`);

      if (captchaText && /^[a-zA-Z0-9]{4,7}$/.test(captchaText)) {
        return captchaText;
      }
      console.log('OCR result invalid, retrying...');
    } catch (err) {
      console.log(`OCR attempt ${attempt} failed:`, err.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Failed to read CAPTCHA text after retries');
}

async function loginUser(login, passwd, captchaPath) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const captchaImg = await page.$('img[src*="captchas"]');
  if (!captchaImg) {
    await browser.close();
    throw new Error("CAPTCHA image not found");
  }
  await captchaImg.screenshot({ path: captchaPath });

  const captchaText = await recognizeCaptchaWithRetry(captchaPath);

  await page.type('#login', login);
  await page.type('#passwd', passwd);
  await page.type('#ccode', captchaText);

  const csrf = await page.$eval('#hdnCSRF', el => el.value);

  await page.evaluate((login, passwd, captchaText, csrf) => {
    document.getElementById('txtAN').value = login;
    document.getElementById('txtSK').value = passwd;
    document.getElementById('hdnCaptcha').value = captchaText;
    document.getElementById('csrfPreventionSalt').value = csrf;
    document.getElementById('txtPageAction').value = '1';
  }, login, passwd, captchaText, csrf);

  await Promise.all([
    page.$eval('#login_form', form => form.submit()),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
  ]);

  const finalUrl = page.url();
  const pageContent = await page.content();

  if (finalUrl.includes('youLogin.jsp') || pageContent.includes('Invalid')) {
    await browser.close();
    throw new Error('Login failed: Invalid credentials or captcha');
  }

  const cookies = await page.cookies();

  await browser.close();

  return { cookies, csrf };
}

function parsePersonalDetails(html) {
  const $ = cheerio.load(html);
  const data = {};

  function getRowValue(label) {
    const row = $('table tbody tr').filter((i, el) => {
      return $(el).find('td').first().text().trim() === label;
    }).first();
    return row.find('td').eq(1).text().trim() || 'N/A';
  }

  data.studentName = getRowValue('Student Name') || getRowValue('Student Name ');
  data.registerNo = getRowValue('Register No.') || getRowValue('Register No. ');
  data.institution = getRowValue('Institution');
  data.program = getRowValue('Program');
  data.batch = getRowValue('Batch');
  data.semester = getRowValue('Semester');
  data.section = getRowValue('Section');

  data.dateOfBirth = getRowValue('Date of Birth');
  data.gender = getRowValue('Gender');
  data.nationality = getRowValue('Nationality');
  data.bloodGroup = getRowValue('Blood Group');

  data.fatherName = getRowValue('Father Name');
  data.motherName = getRowValue('Mother Name');
  data.parentContactNo = getRowValue('Parent Contact No.');
  data.parentEmailID = getRowValue('Parent Email ID');

  data.address = getRowValue('Address');
  data.pincode = getRowValue('Pincode');
  data.district = getRowValue('District');
  data.state = getRowValue('State');
  data.personalEmailID = getRowValue('Personal Email ID');
  data.studentMobileNo = getRowValue('Student Mobile No.');
  data.alternativeStudentMobileNo = getRowValue('Alternative Student Mobile No.');

  return data;
}

app.post('/login', async (req, res) => {
  const { login, passwd } = req.body;
  const captchaPath = path.join(__dirname, 'captcha.png');

  try {
    const { cookies, csrf } = await loginUser(login, passwd, captchaPath);
    res.json({ success: true, cookies, csrf, message: 'Login successful.' });
  } catch (err) {
    res.status(401).json({ success: false, error: err.message });
  } finally {
    if (fs.existsSync(captchaPath)) fs.unlinkSync(captchaPath);
    if (fs.existsSync(captchaPath.replace('.png', '_processed.png'))) fs.unlinkSync(captchaPath.replace('.png', '_processed.png'));
  }
});

app.post('/personal-details', async (req, res) => {
  const { cookies, csrf } = req.body;
  if (!cookies || !csrf) return res.status(400).json({ success: false, error: 'Missing cookies or csrf token' });

  const jsessionCookie = cookies.find(c => c.name === 'JSESSIONID');
  if (!jsessionCookie) return res.status(400).json({ success: false, error: 'JSESSIONID cookie not found' });

  try {
    const response = await fetch(PERSONAL_DETAILS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `JSESSIONID=${jsessionCookie.value}`,
        'Origin': 'https://sp.srmist.edu.in',
        'Referer': 'https://sp.srmist.edu.in/srmiststudentportal/students/template/HRDSystem.jsp',
        'User-Agent': 'Mozilla/5.0',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: `iden=17&filter=&hdnFormDetails=1&csrfPreventionSalt=${encodeURIComponent(csrf)}`
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const html = await response.text();

    const personalDetailsJSON = parsePersonalDetails(html);

    res.json({ success: true, personalDetails: personalDetailsJSON });

  } catch (error) {
    console.error('Error fetching personal details:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 9000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
