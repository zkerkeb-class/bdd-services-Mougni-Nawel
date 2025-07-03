// saveContract.controller.js
const logger = require('../utils/logger');
const { saveContractService, getContractFromDb } = require('../services/contract.service');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Missing axios import
const contract = require('../models/contract');
const analysis = require('../models/analysis');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const { db, getContractInfo, connectAndLoadModels, Contract, Analysis, User } = require('../models/index.js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.dev') });

const saveContract = async (req, res) => {
  try {
    const text = req.body.text;
    const token = req.headers.authorization;

    if (!text) {
      return res.status(400).json({ message: 'Aucun texte reçu' });
    }

    if (!token) {
      return res.status(401).json({ message: "No auth token provided" });
    }
    // ✅ Fetch user info from auth microservice
    const responseAuth = await axios.get(`${process.env.API_AUTH}/api/auth/me`, {
      headers: {
        Authorization: token // Forward the same token
      }
    });

    const user = await User.findById(responseAuth.data._id);
    console.log('tests 2 : ', user);

    if (!user) {
      logger.warn('User not found during analysis');
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    console.log('te : ');

    const savedContract = await saveContractService(text, user); // Renamed to avoid variable name conflict

    logger.info(`Test 8 : ${process.env.AI_SERVICE_URL}/analyze/analyzeContract/${savedContract._id}`); // Removed extra } bracket

    // Call service ia endpoint analyze
    const response = await axios.get(
      `${process.env.AI_SERVICE_URL}/analyze/analyzeContract/${savedContract._id}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${token}`
        }
      }
    );

    logger.info('Contract analyzed by IA : ', response.data); // Use response.data, not the whole response

    return res.status(200).json({ message: "Text saved", data: response.data, contract: savedContract }); // Use response.data, remove await
  } catch (error) {
    logger.error('Erreur saveContract.controller:', error.stack); // Log stack trace for more info
    res.status(500).json({ message: 'Erreur interne serveur' });
  }
};

const getContract = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Looking for contract ID:', id);
    
    // Use the static method from your Contract model to get contract with analyses
    const contractWithAnalyses = await Contract.getContractFromDb(id);
    
    if (!contractWithAnalyses) {
      console.log('Contract not found with ID:', id);
      
      // DEBUG: Check what contracts exist in database
      const allContracts = await Contract.find({}).limit(5);
      console.log('Available contracts:');
      allContracts.forEach(contract => {
        console.log(`- ID: ${contract._id} (type: ${typeof contract._id})`);
      });
      
      return res.status(404).json({
        error: 'Contract not found',
        searchedId: id,
        availableIds: allContracts.map(c => c._id)
      });
    }

    console.log('Contract found with analyses:', contractWithAnalyses);
    
    // Return the contract with its analyses
    return res.json({
      success: true,
      data: contractWithAnalyses
    });
        
  } catch (error) {
    console.error('Error in getContract:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

const getContractsWithAnalyses = async (req, res) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: "No auth token provided" });
    }

    // ✅ Fetch user info from auth microservice
    const response = await axios.get(`${process.env.API_AUTH}/api/auth/me`, {
      headers: {
        Authorization: token // Forward the same token
      }
    });

    const user = await User.findById(response.data._id);
    console.log('tests 2 : ', user);

    if (!user) {
      logger.warn('User not found during analysis');
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Get contracts with their analyses using aggregation
    const contractsWithAnalyses = await Contract.aggregate([
      { $match: { user: user._id } },
      {
        $lookup: {
          from: 'analyses', // Collection name for Analysis model
          localField: '_id',
          foreignField: 'contract',
          as: 'analyses'
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: 50 }
    ]);

    return res.json({
      success: true,
      data: contractsWithAnalyses,
      count: contractsWithAnalyses.length
    });
        
  } catch (error) {
    console.error('Error in getContractsWithAnalyses:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

module.exports = {
  saveContract,
  getContract,
  getContractsWithAnalyses
};