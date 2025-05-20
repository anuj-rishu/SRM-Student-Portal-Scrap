const express = require("express");
const hallticketController = require("../controllers/hallticketController");

const router = express.Router();

router.get("/hall-ticket", hallticketController.getHallTicket);

module.exports = router;
