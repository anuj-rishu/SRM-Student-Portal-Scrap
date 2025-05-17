const express = require("express");
const hallticketController = require("../controllers/hallticketController");

const router = express.Router();

router.post("/hall-ticket", hallticketController.getHallTicket);

module.exports = router;