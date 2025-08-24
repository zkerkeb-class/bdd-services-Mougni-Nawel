const express = require("express")
const router = express.Router()
const userController = require("../controllers/user.controller")

router.get("/by-email/:email", userController.getUserByEmail)
router.get("/by-google-id/:googleId", userController.getUserByGoogleId)
router.get("/by-stripe-id/:stripeId", userController.getUserByStripeId)
router.get("/:id", userController.getUserById)
router.post("/", userController.createUser)
router.post("/google", userController.createGoogleUser)
router.patch("/:id/incrementAnalysisCount", userController.incrementAnalysisCount)
router.patch("/:id", userController.updateUser)

module.exports = router
