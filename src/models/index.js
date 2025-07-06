const mongoose = require('mongoose');
const Contract = require('./contract');
const Analysis = require('./analysis'); // Supprimé (mongoose) 
const User = require('./user');
const Subscription = require('./subscription');

async function connect() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
        
    console.log('✅ MongoDB connected');
    return mongoose.connection.db;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

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