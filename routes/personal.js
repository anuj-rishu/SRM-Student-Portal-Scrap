const express = require("express");
const personalController = require("../controllers/personalController");

const router = express.Router();

router.post("/personal-details", personalController.getPersonalDetails);
router.post("/profile", personalController.getProfile);

module.exports = router;