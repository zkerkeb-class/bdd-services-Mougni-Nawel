
const mockFs = {
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn(),
}

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}

const mockExtractTextFromFile = jest.fn()

jest.doMock("fs", () => mockFs)
jest.doMock("../../src/utils/logger", () => mockLogger)
jest.doMock("../../src/services/upload.service", () => ({
  extractTextFromFile: mockExtractTextFromFile,
}))

const { handleUpload } = require("../../src/controllers/upload.controller")

describe("UploadController", () => {
  let req, res

  beforeEach(() => {
    req = { file: null }
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    jest.clearAllMocks()
  })

  describe("handleUpload", () => {
    it("should handle file upload successfully", async () => {
      const mockFile = {
        mimetype: "application/pdf",
        path: "/tmp/test.pdf",
        originalname: "test.pdf",
      }
      const extractedText = "Texte extrait du fichier"

      req.file = mockFile
      mockExtractTextFromFile.mockResolvedValue(extractedText)

      await handleUpload(req, res)

      expect(mockExtractTextFromFile).toHaveBeenCalledWith(mockFile)
      expect(mockFs.unlinkSync).toHaveBeenCalledWith("/tmp/test.pdf")
      expect(mockLogger.info).toHaveBeenCalledWith("Text extracted from file : ", extractedText)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({ extractedText })
    })

    it("should return 400 if no file is provided", async () => {
      req.file = null

      await handleUpload(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: "Aucun fichier reçu" })
      expect(mockExtractTextFromFile).not.toHaveBeenCalled()
    })

    it("should handle extraction errors", async () => {
      const mockFile = {
        mimetype: "application/pdf",
        path: "/tmp/test.pdf",
        originalname: "test.pdf",
      }

      req.file = mockFile
      mockExtractTextFromFile.mockRejectedValue(new Error("Extraction failed"))

      await handleUpload(req, res)

      expect(mockLogger.error).toHaveBeenCalledWith("Erreur upload.controller:", expect.any(Error))
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ message: "Erreur interne serveur" })
    })

    it("should handle file deletion errors gracefully", async () => {
      const mockFile = {
        mimetype: "application/pdf",
        path: "/tmp/test.pdf",
        originalname: "test.pdf",
      }
      const extractedText = "Texte extrait"

      req.file = mockFile
      mockExtractTextFromFile.mockResolvedValue(extractedText)
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("File deletion failed")
      })

      await handleUpload(req, res)

      expect(mockLogger.error).toHaveBeenCalledWith("Erreur upload.controller:", expect.any(Error))
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ message: "Erreur interne serveur" })
    })

    it("should handle unsupported file format", async () => {
      const mockFile = {
        mimetype: "text/plain",
        path: "/tmp/test.txt",
        originalname: "test.txt",
      }

      req.file = mockFile
      mockExtractTextFromFile.mockRejectedValue(new Error("Format de fichier non supporté"))

      await handleUpload(req, res)

      expect(mockLogger.error).toHaveBeenCalledWith("Erreur upload.controller:", expect.any(Error))
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ message: "Erreur interne serveur" })
    })
  })
})
