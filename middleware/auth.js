require("dotenv").config();
const jwt = require("jsonwebtoken");
const { logger } = require("../middleware/logger");

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      logger.error({
        message: "Authorization header missing",
        url: req.originalUrl,
        method: req.method,
        body: req.body,
      });
      return res.status(401).json({
        success: false,
        error: "Authorization header missing",
      });
    }

    let token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;

    if (!token || token === "undefined" || token === "null") {
      logger.error({
        message: "Invalid token format",
        url: req.originalUrl,
        method: req.method,
        body: req.body,
      });
      return res.status(401).json({
        success: false,
        error: "Invalid token format",
      });
    }

    if (token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1);
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      req.cookies = [
        {
          name: "JSESSIONID",
          value: decoded.jsessionid,
        },
      ];

      req.csrf = decoded.csrf;

      next();
    } catch (jwtError) {
      logger.error({
        message: "JWT verification error",
        error: jwtError.message,
        name: jwtError.name,
        expiredAt: jwtError.expiredAt,
        token: token.substring(0, 15) + "...",
        url: req.originalUrl,
        method: req.method,
        body: req.body,
      });

      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error: "Token has expired. Please login again.",
        });
      }

      return res.status(401).json({
        success: false,
        error: "Token is not valid",
        details: jwtError.message,
      });
    }
  } catch (error) {
    logger.error({
      message: "Auth middleware general error",
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
    });
    return res.status(500).json({
      success: false,
      error: "Authentication error",
    });
  }
};