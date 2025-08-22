const UserController = require("../../src/controllers/user.controller")

jest.mock("../../src/services/user.service", () => ({
  findUserByEmail: jest.fn(),
  findUserByGoogleId: jest.fn(),
  findUserById: jest.fn(),
  createUser: jest.fn(),
  createOrGetGoogleUser: jest.fn(),
  updateUser: jest.fn(),
  incrementAnalysisCount: jest.fn(),
  findUserByStripeId: jest.fn(),
}))

const userService = require("../../src/services/user.service")

describe("UserController", () => {
  let req, res

  beforeEach(() => {
    req = { params: {}, body: {} }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    jest.clearAllMocks()
  })

  describe("getUserByEmail", () => {
    it("devrait retourner l'utilisateur si trouvé", async () => {
      req.params.email = "test@example.com"
      const user = { id: "1", email: "test@example.com" }

      userService.findUserByEmail.mockResolvedValue(user)

      await UserController.getUserByEmail(req, res)

      expect(userService.findUserByEmail).toHaveBeenCalledWith("test@example.com", true)
      expect(res.json).toHaveBeenCalledWith({ success: true, data: user })
    })

    it("devrait retourner 404 si non trouvé", async () => {
      req.params.email = "test@example.com"
      userService.findUserByEmail.mockResolvedValue(null)

      await UserController.getUserByEmail(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Utilisateur non trouvé" })
    })

    it("devrait retourner 500 en cas d'erreur", async () => {
      req.params.email = "test@example.com"
      userService.findUserByEmail.mockRejectedValue(new Error("Erreur"))

      await UserController.getUserByEmail(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Erreur serveur" })
    })
  })

  describe("getUserByGoogleId", () => {
    it("retourne 200 si trouvé", async () => {
      req.params.googleId = "abc123"
      const user = { id: "1", googleId: "abc123" }

      userService.findUserByGoogleId.mockResolvedValue(user)

      await UserController.getUserByGoogleId(req, res)

      expect(res.json).toHaveBeenCalledWith({ success: true, data: user })
    })

    it("retourne 404 si non trouvé", async () => {
      req.params.googleId = "abc123"
      userService.findUserByGoogleId.mockResolvedValue(null)

      await UserController.getUserByGoogleId(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Utilisateur non trouvé" })
    })
  })

  describe("getUserById", () => {
    it("retourne 400 si id manquant", async () => {
      await UserController.getUserById(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "ID utilisateur requis" })
    })

    it("retourne 404 si non trouvé", async () => {
      req.params.id = "123"
      userService.findUserById.mockResolvedValue(null)

      await UserController.getUserById(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })

    it("retourne 200 si trouvé", async () => {
      req.params.id = "123"
      const user = { id: "123", email: "test@test.com" }
      userService.findUserById.mockResolvedValue(user)

      await UserController.getUserById(req, res)

      expect(res.json).toHaveBeenCalledWith({ success: true, data: user })
    })
  })

  describe("createUser", () => {
    it("retourne 201 si création réussie", async () => {
      const user = { email: "new@user.com" }
      req.body = user
      userService.createUser.mockResolvedValue(user)

      await UserController.createUser(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ success: true, data: user })
    })

    it("retourne 409 si email déjà utilisé", async () => {
      req.body = { email: "duplicate@test.com" }
      userService.createUser.mockRejectedValue(new Error("Un utilisateur avec cet email existe déjà"))

      await UserController.createUser(req, res)

      expect(res.status).toHaveBeenCalledWith(409)
    })
  })

  describe("createGoogleUser", () => {
    it("retourne 400 si email manquant", async () => {
      req.body = { googleId: "g123" }
      await UserController.createGoogleUser(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it("retourne 400 si googleId manquant", async () => {
      req.body = { email: "test@google.com" }
      await UserController.createGoogleUser(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it("retourne 201 si ok", async () => {
      req.body = {
        email: "google@test.com",
        googleId: "gid123",
        firstname: "Test",
        lastname: "User",
      }
      const mockUser = { id: "id1", ...req.body }

      userService.createOrGetGoogleUser.mockResolvedValue(mockUser)

      await UserController.createGoogleUser(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUser })
    })
  })

  describe("updateUser", () => {
    it("retourne 404 si utilisateur non trouvé", async () => {
      req.params.id = "1"
      userService.updateUser.mockResolvedValue(null)

      await UserController.updateUser(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })

    it("retourne 200 si mise à jour ok", async () => {
      req.params.id = "1"
      req.body = { firstname: "Updated" }
      const updatedUser = { id: "1", firstname: "Updated" }

      userService.updateUser.mockResolvedValue(updatedUser)

      await UserController.updateUser(req, res)

      expect(res.json).toHaveBeenCalledWith({ success: true, data: updatedUser })
    })
  })

  describe("incrementAnalysisCount", () => {
    it("retourne 404 si utilisateur non trouvé", async () => {
      req.params.id = "1"
      userService.incrementAnalysisCount.mockResolvedValue(null)

      await UserController.incrementAnalysisCount(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })

    it("retourne 200 si ok", async () => {
      req.params.id = "1"
      const user = { id: "1", analysisCount: 2 }

      userService.incrementAnalysisCount.mockResolvedValue(user)

      await UserController.incrementAnalysisCount(req, res)

      expect(res.json).toHaveBeenCalledWith({ success: true, data: user })
    })
  })

  describe("getUserByStripeId", () => {
    it("retourne 404 si non trouvé", async () => {
      req.params.stripeId = "stripe_123"
      userService.findUserByStripeId.mockResolvedValue(null)

      await UserController.getUserByStripeId(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })

    it("retourne 200 si trouvé", async () => {
      req.params.stripeId = "stripe_123"
      const user = { id: "1", stripeId: "stripe_123" }

      userService.findUserByStripeId.mockResolvedValue(user)

      await UserController.getUserByStripeId(req, res)

      expect(res.json).toHaveBeenCalledWith({ success: true, data: user })
    })
  })
})
