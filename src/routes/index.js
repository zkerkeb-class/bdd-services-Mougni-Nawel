const express = require("express")
const router = express.Router()
const userRoutes = require("./user.route")
const contractRoutes = require("./contract.route")
const uploadRoutes = require("./upload.route")

router.use("/user", userRoutes)
router.use("/contract", contractRoutes)
router.use("/upload", uploadRoutes)

module.exports = router
