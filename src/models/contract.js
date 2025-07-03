// contract.model.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const contractSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv4
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // required: true // Uncomment when user system is ready
    },
    content: {
      type: String,
      required: true
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'processed'],
      default: 'pending'
    }
  },
  {
    timestamps: true,
    _id: false // Important: disable auto _id generation since we're using custom
  }
);

// Add static method
contractSchema.statics.getContractFromDb = async function (id) {
  try {
    const contract = await this.findById(id).lean();
    if (!contract) return null;
    
    const analyses = await mongoose.model('Analysis').find({ contract: id }).lean();
    
    return { ...contract, analyses };
  } catch (error) {
    console.error(`Error in getContractFromDb: ${error.message}`);
    throw error;
  }
};

const Contract = mongoose.models.Contract || mongoose.model('Contract', contractSchema);
module.exports = Contract;
