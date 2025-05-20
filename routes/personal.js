const express = require("express");
const personalController = require("../controllers/personalController");

const router = express.Router();

router.get("/personal-details", personalController.getPersonalDetails);
router.get("/profile", personalController.getProfile);

module.exports = router;