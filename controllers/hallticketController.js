const fetch = require("node-fetch");
const { HALL_TICKET_URL, REFERER_URL } = require("../config/constants");
const { parseHallTicketData } = require("../utils/parsers");

exports.getHallTicket = async (req, res) => {
  const { cookies, csrf } = req.body;
  if (!cookies || !csrf)
    return res
      .status(400)
      .json({ success: false, error: "Missing cookies or csrf token" });

  const jsessionCookie = cookies.find((c) => c.name === "JSESSIONID");
  if (!jsessionCookie)
    return res
      .status(400)
      .json({ success: false, error: "JSESSIONID cookie not found" });

  try {
    const response = await fetch(HALL_TICKET_URL, {
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
      body: `iden=42&filter=&hdnFormDetails=1&csrfPreventionSalt=${encodeURIComponent(
        csrf
      )}`,
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const html = await response.text();
    const hallTicketData = parseHallTicketData(html);

    if (!hallTicketData.available) {
      return res.json({ success: false, message: "No hall ticket available" });
    }

    const pdfResponse = await fetch(hallTicketData.downloadUrl, {
      method: "POST",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: `JSESSIONID=${jsessionCookie.value}`,
        Origin: "https://sp.srmist.edu.in",
        Referer: HALL_TICKET_URL,
        "User-Agent": "Mozilla/5.0",
      },
      body: `exammonth=${hallTicketData.examMonth}&examyear=${hallTicketData.examYear}&courseid=${hallTicketData.courseId}&studentId=${hallTicketData.studentId}&studentsemesterid=${hallTicketData.studentSemesterId}`,
    });

    if (!pdfResponse.ok)
      throw new Error(`PDF fetch error! status: ${pdfResponse.status}`);

    const pdfBuffer = await pdfResponse.buffer();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="hall-ticket-${hallTicketData.examMonth}-${hallTicketData.examYear}.pdf"`
    );

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error fetching hall ticket:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};