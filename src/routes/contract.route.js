const express = require('express');
const { saveContract, getContract, getContractsWithAnalyses } = require('../controllers/contract.controller');


const router = express.Router();

router.get('/:id/info', getContract)
router.post('/save', saveContract);
router.get('/allContracts', getContractsWithAnalyses);

module.exports = router;
