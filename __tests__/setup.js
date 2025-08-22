const path = require("path")

require("dotenv").config({
  path: path.resolve(__dirname, "../.env.dev"),
})

process.env.NODE_ENV = "test"
process.env.AUTH_SERVICE_URL = "http://authentification:3001"
process.env.AI_SERVICE_URL = "http://ia:3002"

jest.mock("mongoose", () => ({
  connect: jest.fn().mockResolvedValue({}),
  connection: {
    readyState: 1,
    close: jest.fn(),
  },
  startSession: jest.fn(() => ({
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  })),
  Schema: class MockSchema {
    constructor(definition) {
      this.definition = definition
      this.statics = {}
    }
    index() {
      return this
    }
    pre() {
      return this
    }
    post() {
      return this
    }
    static(name, fn) {
      this.statics[name] = fn
      return this
    }
  },
  model: jest.fn(),
  models: {},
  Types: {
    ObjectId: jest.fn((id) => id || "mock-id"),
  },
}))

jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}))

global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
}

describe("Configuration des tests", () => {
  it("devrait charger les variables depuis .env.dev", () => {
    expect(process.env.NODE_ENV).toBe("test")
    expect(process.env.MONGO_URI).toBeDefined()
  })
})
