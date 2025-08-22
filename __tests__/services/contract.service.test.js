const ContractService = require("../../src/services/contract.service")
const axios = require("axios")
const mongoose = require("mongoose")

const createQueryChain = (resolvedValue) => {
  const mockDocument = resolvedValue
    ? {
      ...resolvedValue,
      toObject: jest.fn().mockReturnValue({ ...resolvedValue }),
      save: jest.fn().mockResolvedValue(resolvedValue), // Add save for consistency
    }
    : null

  const chain = {
    lean: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(mockDocument),
  }

  chain.lean.mockImplementation(() => ({
    exec: jest.fn().mockResolvedValue(resolvedValue), // Resolve to plain object
    session: jest.fn().mockReturnThis(),
  }))

  return chain
}

jest.mock("../../src/models/contract", () => {
  const mockContract = {
    findOne: jest.fn(),
    findById: jest.fn(), 
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    aggregate: jest.fn(),
  }

  const ContractConstructor = jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ _id: "mockId", ...data }),
    toObject: jest.fn().mockReturnValue({ _id: "mockId", ...data }),
  }))

  mockContract.findOne.mockReturnValue({
    session: jest.fn().mockResolvedValue(null),
  })
  mockContract.findById.mockReturnValue({
    lean: jest.fn().mockResolvedValue(null),
  })
  mockContract.findOneAndUpdate.mockResolvedValue(null)
  mockContract.findByIdAndUpdate.mockResolvedValue({})
  mockContract.aggregate.mockResolvedValue([])

  Object.assign(ContractConstructor, mockContract)
  return ContractConstructor
})

jest.mock("../../src/models/analysis", () => ({
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    }),
  }),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}))

jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
}))
jest.mock("mongoose", () => ({
  startSession: jest.fn(),
  Schema: class {
    constructor(definition) {
      this.definition = definition;
      this.statics = {};
    }
    index() { return this; }
    static(name, fn) { this.statics[name] = fn; return this; }
  },
  model: jest.fn(),
  models: {},
}));

describe("ContractService", () => {
  const Contract = require("../../src/models/contract")
  const Analysis = require("../../src/models/analysis")
  let mockSession

beforeEach(() => {
  jest.clearAllMocks()
  
  Contract.findOneAndUpdate.mockResolvedValue(null)
  Contract.findByIdAndUpdate.mockResolvedValue({})
  
  mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  }
  mongoose.startSession.mockResolvedValue(mockSession)
  
  jest.spyOn(ContractService, "callAIAnalysis").mockResolvedValue("AI OK")
})

  describe("verifyUser", () => {
    it("should return user if token is valid", async () => {
      const mockUser = { _id: "user123", email: "test@test.com" }
      axios.get.mockResolvedValue({ data: { success: true, data: mockUser } })
      const result = await ContractService.verifyUser("token")
      expect(result).toEqual(mockUser)
    })
    it("should throw error if user is not authenticated", async () => {
      axios.get.mockResolvedValue({ data: { success: false } })
      await expect(ContractService.verifyUser("token")).rejects.toThrow("Utilisateur non authentifié")
    })
  })

  describe("saveContract", () => {
    it("should return existing contract if duplicate is found", async () => {
      const existingContractData = {
        _id: "existing123",
        content: "duplicate content",
        user: "user123",
        status: "pending",
        toObject: jest.fn().mockReturnValue({
          _id: "existing123",
          content: "duplicate content",
          user: "user123",
          status: "pending",
        }),
      };
      Contract.findOne.mockImplementation(() => ({
        session: () => existingContractData,
      }));

      const result = await ContractService.saveContract("duplicate content", "user123", "token");
      expect(result).toEqual({ ...existingContractData.toObject(), isDuplicate: true, message: "Ce contrat existe déjà" });
    });

    it("should save a new contract and trigger AI analysis", async () => {
      Contract.findOne.mockImplementation(() => ({
        session: () => null,
      }));
      const contractData = {
        content: "new content",
        user: "user123",
        status: "pending",
        analysisStarted: false,
        createdAt: expect.any(Date),
      }
      const savedContractData = { _id: "contract123", ...contractData }
      const mockNewContractInstance = {
        ...contractData,
        save: jest.fn().mockResolvedValue(savedContractData),
        toObject: jest.fn().mockReturnValue(savedContractData),
      }
      Contract.mockImplementation(() => mockNewContractInstance)
      jest.spyOn(ContractService, "triggerAIAnalysisIfNotStarted").mockResolvedValue()
      const result = await ContractService.saveContract("new content", "user123", "token")
      expect(result).toEqual({ ...savedContractData, isDuplicate: false, message: "Contrat créé avec succès" })
    })
  })

  describe("getContractWithAnalyses", () => {
    it("should return contract with parsed analysis", async () => {
      Contract.findById.mockImplementation(() => ({
        lean: () => Promise.resolve({ _id: "contract123", content: "test" })
      }));
      Analysis.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ _id: "a1", result: '{"overview":"ok"}', analysisDate: new Date() }]),
        }),
      })
      const result = await ContractService.getContractWithAnalyses("contract123")
      expect(result.contract).toBeDefined()
      expect(result.analyses.length).toBe(1)
      expect(result.analyses[0].result).toEqual({ overview: "ok" })
    })
    it("should throw error if contract not found", async () => {
      Contract.findById.mockImplementation(() => ({
        lean: () => Promise.resolve(null)
      }));
      await expect(ContractService.getContractWithAnalyses("nonexistent")).rejects.toThrow("Contrat non trouvé")
    })
  })

  describe("saveAnalysis", () => {
    it("should save analysis and update contract", async () => {
      const contractId = "contract123"
      const analysisData = {
        overview: "Analysis summary",
        clauses_abusives: [{ clause: "Clause A" }],
        risks: [{ risk: "Risk A", severity: "high" }],
      }
      Contract.findById.mockImplementation(() => createQueryChain({ _id: contractId }))
      const savedAnalysis = { _id: "a1", result: analysisData }
      Analysis.findOneAndUpdate.mockResolvedValue(savedAnalysis)
      Contract.findByIdAndUpdate.mockResolvedValue({})
      const result = await ContractService.saveAnalysis(contractId, analysisData)
      expect(result).toEqual(savedAnalysis)
    })
  })

  describe("generateContentHash", () => {
    it("should generate consistent hash for same content", () => {
      const content = "Contract text"
      const h1 = ContractService.generateContentHash(content)
      const h2 = ContractService.generateContentHash(content)
      expect(h1).toEqual(h2)
      expect(h1).toHaveLength(64)
    })
  })

  describe("calculateRiskLevel", () => {
    it("should return high if more than one high", () => {
      const risks = [{ severity: "high" }, { severity: "high" }]
      expect(ContractService.calculateRiskLevel(risks)).toBe("high")
    })
    it("should return medium for one high", () => {
      const risks = [{ severity: "high" }]
      expect(ContractService.calculateRiskLevel(risks)).toBe("medium")
    })
    it("should return low for no high", () => {
      const risks = [{ severity: "low" }]
      expect(ContractService.calculateRiskLevel(risks)).toBe("low")
    })
    it("should return low if risks is null", () => {
      expect(ContractService.calculateRiskLevel(null)).toBe("low")
    })
  })

  describe("normalizeAIResponse", () => {
    it("should return nested analysis_summary", async () => {
      const response = {
        analysis_summary: {
          overview: "Résumé",
          clauses_abusives: [],
          risks: [],
          recommendations: [],
        },
      }
      const result = await ContractService.normalizeAIResponse(response)
      expect(result.overview).toBe("Résumé")
    })
    it("should parse JSON string", async () => {
      const response = JSON.stringify({
        overview: "Résumé depuis string",
        clauses_abusives: [],
        risks: [],
        recommendations: [],
      })
      const result = await ContractService.normalizeAIResponse(response)
      expect(result.overview).toBe("Résumé depuis string")
    })
    it("should fallback on error", async () => {
      const result = await ContractService.normalizeAIResponse(12345)
      expect(result.overview).toBe("Erreur d'analyse du contrat")
    })
  })

})
