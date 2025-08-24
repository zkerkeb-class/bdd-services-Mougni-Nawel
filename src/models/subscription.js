const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  maxContracts: {
    type: Number,
    required: true,
    default: 10
  },
  maxAnalyses: {
    type: Number,
    required: true,
    default: 10
  },
  price: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Subscription || mongoose.model("Subscription", subscriptionSchema);