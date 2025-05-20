const fetch = require("node-fetch");
const { PERSONAL_DETAILS_URL, PROFILE_URL, REFERER_URL } = require("../config/constants");
const { parsePersonalDetails, parseProfileData } = require("../utils/parsers");
const { logger } = require("../middleware/logger");

exports.getPersonalDetails = async (req, res) => {
  const { cookies, csrf } = req;
  
  if (!cookies || !csrf) {
    logger.error({
      message: "Authentication data missing",
      url: req.originalUrl,
      method: req.method,
      body: req.body,
    });
    return res
      .status(400)
      .json({ success: false, error: "Authentication data missing" });
  }

  const jsessionCookie = cookies.find((c) => c.name === "JSESSIONID");
  if (!jsessionCookie) {
    logger.error({
      message: "JSESSIONID cookie not found",
      url: req.originalUrl,
      method: req.method,
      body: req.body,
    });
    return res
      .status(400)
      .json({ success: false, error: "JSESSIONID cookie not found" });
  }

  try {
    const response = await fetch(PERSONAL_DETAILS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: `JSESSIONID=${jsessionCookie.value}`,
        Origin: "https://sp.srmist.edu.in",
        Referer: REFERER_URL,
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: `iden=17&filter=&hdnFormDetails=1&csrfPreventionSalt=${encodeURIComponent(
        csrf
      )}`,
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const html = await response.text();
    const personalDetailsJSON = parsePersonalDetails(html);

    res.json({ success: true, personalDetails: personalDetailsJSON });
  } catch (error) {
    logger.error({
      message: "Error fetching personal details",
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
    });
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  const { cookies, csrf } = req;
  
  if (!cookies || !csrf) {
    logger.error({
      message: "Authentication data missing",
      url: req.originalUrl,
      method: req.method,
      body: req.body,
    });
    return res
      .status(400)
      .json({ success: false, error: "Authentication data missing" });
  }

  const jsessionCookie = cookies.find((c) => c.name === "JSESSIONID");
  if (!jsessionCookie) {
    logger.error({
      message: "JSESSIONID cookie not found",
      url: req.originalUrl,
      method: req.method,
      body: req.body,
    });
    return res
      .status(400)
      .json({ success: false, error: "JSESSIONID cookie not found" });
  }

  try {
    const response = await fetch(PROFILE_URL, {
      method: "POST",
      headers: {
        "Accept": "text/html, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Cookie": `JSESSIONID=${jsessionCookie.value}`,
        "Origin": "https://sp.srmist.edu.in",
        "Referer": REFERER_URL,
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: `iden=1&filter=&hdnFormDetails=1&csrfPreventionSalt=${encodeURIComponent(csrf)}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({
        message: `Profile fetch failed with status ${response.status}`,
        error: errorText.substring(0, 200),
        url: req.originalUrl,
        method: req.method,
        body: req.body,
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const profileData = parseProfileData(html);

    res.json({ success: true, profile: profileData });
  } catch (error) {
    logger.error({
      message: "Error fetching student profile",
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
    });
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack
    });
  }
};