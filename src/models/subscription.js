const mongoose = require('mongoose');
  const subscriptionSchema = new mongoose.Schema(
    {
      cname: {
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
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    },
    {
      timestamps: true,
    }
  );
  const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
module.exports = Subscription;
