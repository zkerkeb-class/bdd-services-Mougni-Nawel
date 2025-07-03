const express = require('express');
const router = express.Router();
const uplaodRoute = require('./upload.route');
const contractRoute = require('./contract.route');

router.use('/upload', uplaodRoute);
router.use('/contract', contractRoute);

module.exports = router;
