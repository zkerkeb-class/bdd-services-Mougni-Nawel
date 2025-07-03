// models/index.js
const mongoose = require('mongoose');
const Contract = require('./contract');
const Analysis = require('./analysis');
const User = require('./user');
const Subscription = require('./subscription');

async function connect() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    // Initialize all models
    await Promise.all([
      Contract.init(),
      Analysis.init(),
      User.init(),
      Subscription.init()
    ]);
    
    console.log('✅ MongoDB connected and models initialized');
    return mongoose.connection.db;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Alternative function if you need to return models
async function connectAndLoadModels() {
  const db = await connect();
  return {
    db,
    Contract,
    Analysis,
    User,
    Subscription
  };
}

module.exports = { 
  connect, 
  connectAndLoadModels,
  Contract, 
  Analysis, 
  User, 
  Subscription 
};