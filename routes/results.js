const express = require("express");
const resultsController = require("../controllers/resultsController");

const router = express.Router();

router.post("/results", resultsController.getResults);

module.exports = router;