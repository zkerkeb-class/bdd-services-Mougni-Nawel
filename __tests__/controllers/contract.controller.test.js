const ContractController = require("../../src/controllers/contract.controller")

jest.mock("../../src/services/contract.service", () => ({
  verifyUser: jest.fn(),
  saveContract: jest.fn(),
  getContractWithAnalyses: jest.fn(),
  getUserContracts: jest.fn(),
  saveAnalysis: jest.fn(),
  triggerAnalysisWithFallback: jest.fn(),
  getAnalysisStatus: jest.fn(),
}))

const contractService = require("../../src/services/contract.service")

describe("ContractController", () => {
  let req, res

  beforeEach(() => {
    req = { body: {}, params: {}, headers: {} }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    jest.clearAllMocks()
  })

  describe("saveContract", () => {
    it("should save contract successfully", async () => {
      const mockUser = { _id: "user123" }
      const mockContract = { _id: "contract123", content: "test content" }

      req.body.text = "test content"
      req.headers.authorization = "Bearer token123"

      contractService.verifyUser.mockResolvedValue(mockUser)
      contractService.saveContract.mockResolvedValue(mockContract)

      await ContractController.saveContract(req, res)

      expect(contractService.saveContract).toHaveBeenCalledWith("test content", "user123", "Bearer token123")
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockContract,
        message: "Contrat sauvegardé et analyse déclenchée",
      })
    })

    it("should return 400 if text is missing", async () => {
      req.headers.authorization = "Bearer token123"

      await ContractController.saveContract(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Contenu et token requis",
      })
    })

    it("should return 400 if token is missing", async () => {
      req.body.text = "test content"

      await ContractController.saveContract(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })
  })

  describe("getContract", () => {
    it("should return contract with analyses", async () => {
      const mockData = {
        contract: { _id: "contract123", content: "test" },
        analyses: [{ _id: "analysis123" }],
        analysisStatus: "Analyse terminée",
      }

      req.params.id = "contract123"
      contractService.getContractWithAnalyses.mockResolvedValue(mockData)

      await ContractController.getContract(req, res)

      expect(contractService.getContractWithAnalyses).toHaveBeenCalledWith("contract123")
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          ...mockData.contract,
          analyses: mockData.analyses,
          analysisStatus: mockData.analysisStatus,
        },
      })
    })

    it("should return 404 if contract not found", async () => {
      req.params.id = "nonexistent"
      contractService.getContractWithAnalyses.mockRejectedValue(new Error("Contrat non trouvé"))

      await ContractController.getContract(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Contrat non trouvé",
      })
    })
  })

  describe("getContractsWithAnalyses", () => {
    it("should return contracts with summary", async () => {
      const mockUser = { _id: "user123" }
      const mockContracts = [
        { _id: "contract1", status: "pending", analyses: [] },
        { _id: "contract2", status: "analyzed", analyses: ["analysis1"] },
      ]

      req.headers.authorization = "Bearer token123"
      contractService.verifyUser.mockResolvedValue(mockUser)
      contractService.getUserContracts.mockResolvedValue(mockContracts)
      contractService.getAnalysisStatus.mockReturnValue("Status message")

      await ContractController.getContractsWithAnalyses(req, res)

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array),
        summary: {
          total: 2,
          pending: 1,
          analyzed: 1,
          withAnalyses: 1,
        },
      })
    })

    it("should return 401 if no token", async () => {

      await ContractController.getContractsWithAnalyses(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Token requis",
      })
    })
  })
})
