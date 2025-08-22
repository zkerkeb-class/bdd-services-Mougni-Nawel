
const mockFs = {
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn(),
}

const mockPdfParse = jest.fn()

const mockMammoth = {
  extractRawText: jest.fn(),
}

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}

jest.doMock("fs", () => mockFs)
jest.doMock("pdf-parse", () => mockPdfParse)
jest.doMock("mammoth", () => mockMammoth)
jest.doMock("../../src/utils/logger", () => mockLogger)

const { extractTextFromFile } = require("../../src/services/upload.service")

describe("UploadService", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("extractTextFromFile", () => {
    it("should extract text from PDF file", async () => {
      const mockFile = {
        mimetype: "application/pdf",
        path: "/tmp/test.pdf",
      }
      const mockPdfData = { text: "Contenu du PDF extrait" }
      const mockBuffer = Buffer.from("pdf content")

      mockFs.readFileSync.mockReturnValue(mockBuffer)
      mockPdfParse.mockResolvedValue(mockPdfData)

      const result = await extractTextFromFile(mockFile)

      expect(mockFs.readFileSync).toHaveBeenCalledWith("/tmp/test.pdf")
      expect(mockPdfParse).toHaveBeenCalledWith(mockBuffer)
      expect(result).toBe("Contenu du PDF extrait")
    })

    it("should extract text from Word document", async () => {
      const mockFile = {
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        path: "/tmp/test.docx",
      }
      const mockWordData = { value: "Contenu du Word extrait" }

      mockMammoth.extractRawText.mockResolvedValue(mockWordData)

      const result = await extractTextFromFile(mockFile)

      expect(mockMammoth.extractRawText).toHaveBeenCalledWith({ path: "/tmp/test.docx" })
      expect(result).toBe("Contenu du Word extrait")
    })

    it("should throw error for unsupported file format", async () => {
      const mockFile = {
        mimetype: "text/plain",
        path: "/tmp/test.txt",
      }

      await expect(extractTextFromFile(mockFile)).rejects.toThrow("Format de fichier non supporté")
    })

    it("should handle PDF parsing errors", async () => {
      const mockFile = {
        mimetype: "application/pdf",
        path: "/tmp/corrupted.pdf",
      }
      const mockBuffer = Buffer.from("corrupted pdf")

      mockFs.readFileSync.mockReturnValue(mockBuffer)
      mockPdfParse.mockRejectedValue(new Error("PDF parsing failed"))

      await expect(extractTextFromFile(mockFile)).rejects.toThrow("PDF parsing failed")
    })

    it("should handle Word document parsing errors", async () => {
      const mockFile = {
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        path: "/tmp/corrupted.docx",
      }

      mockMammoth.extractRawText.mockRejectedValue(new Error("Word parsing failed"))

      await expect(extractTextFromFile(mockFile)).rejects.toThrow("Word parsing failed")
    })
  })
})
