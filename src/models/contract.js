const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const contractSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4
  },
  user: {
    type: String,
    ref: "User",
    required: true
  },
  content: {
    type: String,
    required: true
  },
  contentHash: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ["pending", "analyzed", "failed"],
    default: "pending"
  },
  analysis: {
    type: String,
    ref: "Analysis"
  },
   analysisStarted: {
    type: Boolean,
    default: false
  },
  lastAnalysisAttempt: {
    type: Date,
    default: null
  },
  lastAnalysisError: {
    type: String,
    default: null
  },
  analysisRetryCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

contractSchema.index({ user: 1, contentHash: 1 }, { unique: true });


contractSchema.statics.getContractWithAnalyses = async function(id) {
  const contract = await this.findById(id).lean();
  if (!contract) return null;

  const analyses = await mongoose.model('Analysis')
    .find({ contract: id })
    .sort({ createdAt: -1 })
    .lean();

  return {
    contract,
    analyses,
    analysisStatus: 'Analyse terminée'
  };
};

contractSchema.statics.cleanupFailedContracts = async function() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  return await this.updateMany(
    {
      analysisStarted: true,
      lastAnalysisAttempt: { $lt: oneHourAgo },
      status: "pending"
    },
    {
      analysisStarted: false,
      status: "failed",
      lastAnalysisError: "Timeout - analyse non terminée"
    }
  );
};


module.exports = mongoose.models.Contract || mongoose.model("Contract", contractSchema);