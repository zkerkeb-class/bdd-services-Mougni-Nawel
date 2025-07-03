// analysis.model.js
const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema(
  {
    contract: {
      type: String, // This should match your Contract _id type
      ref: 'Contract',
      required: true
    },
    result: {
      type: String,
      required: true
    },
    abusiveClauses: [{
      type: String
    }],
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low'
    },
    analysisDate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
  }
);

const Analysis = mongoose.models.Analysis || mongoose.model('Analysis', analysisSchema);
module.exports = Analysis;
