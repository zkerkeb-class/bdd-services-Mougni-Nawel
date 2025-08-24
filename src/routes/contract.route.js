const express = require("express")
const router = express.Router()
const contractController = require("../controllers/contract.controller")

router.get("/:id/info", contractController.getContract)
router.post("/save", contractController.saveContract)
router.post("/analyze/:contractId", contractController.saveAnalysis)
router.get("/allContracts", contractController.getContractsWithAnalyses)



module.exports = router
