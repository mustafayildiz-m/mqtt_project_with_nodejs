"use strict";
const express = require("express");
const router = express.Router();
const auth = require('../middlewares/auth');
var publisherController = require("../controllers/publisher");
var resetController = require('../controllers/resetDevice')

// Publisher Home Route.
router.post("/publisher", auth, publisherController.publishMQTTMessage);
router.post("/delete-device", auth, resetController.resetDevice);
module.exports = router;
