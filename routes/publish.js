"use strict";
const express = require("express");
const router = express.Router();
const auth = require('../middlewares/auth');
var publisherController = require("../controllers/publisher");

// Publisher Home Route.
router.post("/publisher", auth, publisherController.publishMQTTMessage);
module.exports = router;
