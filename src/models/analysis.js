const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');

const analysisSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4
  },
  contract: {
    type: String,
    ref: "Contract",
    required: true,
    index: true
  },
  result: {
    type: {
      overview: String,
      clauses_abusives: [{
        clause: String,
        explanation: String,
        suggested_change: String
      }],
      risks: [{
        risk: String,
        explanation: String,
        suggested_solution: String
      }],
      recommendations: [{
        recommendation: String,
        justification: String
      }]
    },
    required: true
  },
  abusiveClauses: [String],
  riskLevel: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "low"
  },
  analysisDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    }
  }
});
module.exports = mongoose.models.Analysis || mongoose.model("Analysis", analysisSchema);
