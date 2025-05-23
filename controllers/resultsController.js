const fetch = require("node-fetch");
const { RESULTS_URL, REFERER_URL } = require("../config/constants");
const { parseResultsData } = require("../utils/parsers");
const { logger } = require("../middleware/logger");

exports.getResults = async (req, res) => {
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
    const response = await fetch(RESULTS_URL, {
      method: "POST",
      headers: {
        Accept: "text/html, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Cookie: `JSESSIONID=${jsessionCookie.value}`,
        Origin: "https://sp.srmist.edu.in",
        Referer: REFERER_URL,
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: `iden=24&filter=&hdnFormDetails=1&csrfPreventionSalt=${encodeURIComponent(
        csrf
      )}`,
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const html = await response.text();
    const resultsData = parseResultsData(html);

    res.json({ success: true, results: resultsData });
  } catch (error) {
    logger.error({
      message: "Error fetching results",
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
    });
    res.status(500).json({ success: false, error: error.message });
  }
};