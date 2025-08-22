// const express = require('express');
// const multer = require('multer');
// const { handleUpload } = require('../controllers/upload.controller');

// const router = express.Router();
// const upload = multer({ dest: '../../uploads/' });

// router.post('/', upload.single('contract'), handleUpload);

// module.exports = router;

// src/routes/upload.route.js
const express = require('express');
const multer = require('multer');
const { handleUpload } = require('../controllers/upload.controller');

const router = express.Router();
const upload = multer({ dest: '../../uploads/' });

router.post('/', upload.single('contract'), handleUpload);

module.exports = router;
