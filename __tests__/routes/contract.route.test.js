const request = require("supertest")
const express = require("express")

jest.mock("../../src/controllers/contract.controller", () => ({
  saveContract: jest.fn(),
  getContract: jest.fn(),
  getContractsWithAnalyses: jest.fn(),
  saveAnalysis: jest.fn(),
}))

jest.mock("../../src/models/Contract", () => {
  const mockContract = {
    findOne: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
  }

  const ContractConstructor = jest.fn().mockImplementation((data) => ({
    ...data,
    save: mockContract.save,
  }))

  Object.assign(ContractConstructor, mockContract)

  return ContractConstructor
})

jest.mock("../../src/services/contract.service", () => ({
  verifyUser: jest.fn(),
  saveContract: jest.fn(),
  getContractWithAnalyses: jest.fn(),
}))

const contractRoutes = require("../../src/routes/contract.route")
const contractController = require("../../src/controllers/contract.controller")

const app = express()
app.use(express.json())
app.use("/contract", contractRoutes)

describe("Contract Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("POST /contract/save", () => {
    it("should call saveContract", async () => {
      contractController.saveContract.mockImplementation((req, res) => res.status(201).json({ success: true }))

      const response = await request(app).post("/contract/save").send({ text: "test" }).set("Authorization", "token")

      expect(response.status).toBe(201)
      expect(contractController.saveContract).toHaveBeenCalled()
    })
  })

  describe("GET /contract/:id/info", () => {
    it("should call getContract", async () => {
      contractController.getContract.mockImplementation((req, res) => res.json({ success: true }))

      const response = await request(app).get("/contract/123/info")

      expect(response.status).toBe(200)
      expect(contractController.getContract).toHaveBeenCalled()
    })
  })

  describe("GET /contract/allContracts", () => {
    it("should call getContractsWithAnalyses", async () => {
      contractController.getContractsWithAnalyses.mockImplementation((req, res) => res.json({ success: true }))

      const response = await request(app).get("/contract/allContracts").set("Authorization", "token")

      expect(response.status).toBe(200)
      expect(contractController.getContractsWithAnalyses).toHaveBeenCalled()
    })
  })
})
