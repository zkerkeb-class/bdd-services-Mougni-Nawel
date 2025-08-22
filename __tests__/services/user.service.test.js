const UserService = require("../../src/services/user.service")

jest.mock("../../src/models/user", () => {
  const mockUser = {
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  }

  const UserConstructor = jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ _id: "user123", ...data }),
    toObject: jest.fn().mockReturnValue({ _id: "user123", ...data }),
  }))

  Object.assign(UserConstructor, mockUser)
  return UserConstructor
})

describe("UserService", () => {
  const User = require("../../src/models/user")

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("findUserByEmail", () => {
    it("should find user by email", async () => {
      const mockUser = { _id: "user123", email: "test@test.com" }
      
      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUser),
      })

      const result = await UserService.findUserByEmail("test@test.com")
      
      expect(result).toEqual(mockUser)
      expect(User.findOne).toHaveBeenCalledWith({ email: "test@test.com" })
    })

    it("should return null if user not found", async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      })

      const result = await UserService.findUserByEmail("notfound@test.com")
      
      expect(result).toBeNull()
    })
  })

  describe("createUser", () => {
    it("should create new user successfully", async () => {
      const userData = { email: "new@test.com", firstname: "John" }
      const savedUser = { _id: "user123", ...userData }

      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      })

      const mockInstance = {
        ...userData,
        save: jest.fn().mockResolvedValue(savedUser),
      }
      User.mockImplementation(() => mockInstance)

      const result = await UserService.createUser(userData)

      expect(User).toHaveBeenCalledWith(userData)
      expect(mockInstance.save).toHaveBeenCalled()
      expect(result).toEqual(mockInstance)
    })

    it("should throw error if user already exists", async () => {
      const userData = { email: "existing@test.com" }
      const existingUser = { _id: "existing123", email: "existing@test.com" }

      User.findOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(existingUser),
      })

      await expect(UserService.createUser(userData))
        .rejects.toThrow("Un utilisateur avec cet email existe déjà")
    })
  })

  describe("createOrGetGoogleUser", () => {
    it("should create new Google user", async () => {
      const googleData = {
        email: "google@test.com",
        googleId: "google123",
        firstname: "John",
        lastname: "Doe",
      }
      const savedUser = { _id: "user123", ...googleData }

      User.findOne.mockResolvedValue(null)

      const mockInstance = {
        ...googleData,
        typeAbonnement: 'free',
        save: jest.fn().mockResolvedValue(savedUser),
      }
      User.mockImplementation(() => mockInstance)

      const result = await UserService.createOrGetGoogleUser(googleData)

      expect(result).toEqual(mockInstance)
      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { email: "google@test.com" },
          { googleId: "google123" }
        ]
      })
    })

    it("should return existing Google user", async () => {
      const googleData = {
        email: "existing@test.com",
        googleId: "google123",
        firstname: "John",
        lastname: "Doe",
      }
      const existingUser = { _id: "existing123", ...googleData }

      User.findOne.mockResolvedValue(existingUser)

      const result = await UserService.createOrGetGoogleUser(googleData)

      expect(result).toEqual(existingUser)
    })

    it("should throw error for missing required fields", async () => {
      const invalidData = { email: "test@test.com" }

      await expect(UserService.createOrGetGoogleUser(invalidData))
        .rejects.toThrow("Google ID est requis")
    })
  })

  describe("updateUser", () => {
    it("should update user successfully", async () => {
      const userId = "user123"
      const updateData = { firstname: "UpdatedName" }
      const updatedUser = { _id: userId, ...updateData }

      User.findByIdAndUpdate.mockResolvedValue(updatedUser)

      const result = await UserService.updateUser(userId, updateData)

      expect(result).toEqual(updatedUser)
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userId, 
        updateData, 
        { new: true, runValidators: true }
      )
    })
  })
})