const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const analysis = require('../models/analysis');
// const contract = require('../models/contract')(mongoose);
// const contract = require('../models/contract');
const { db, Contract, Analysis } = require('../models/index.js');
// const contract = require('../models/contract');

const saveContractService = async (text, user) => {
    console.log('in : ', text)

  try {

    const newContract = new Contract({
      content: text,
      user: user._id
    });
    console.log('in 2 : ', newContract)

    const res = await newContract.save();

    logger.info('Text saved in db');
    return newContract;
  } catch (error) {
    logger.error('Error in saveContract :', error.message);
    throw error;
  }

};

const getContractFromDb = async (id) => {
  const contract = await Contract.findById(id).lean();
  
  if (!contract) return null;
  
  const analyses = await Analysis.find({ contract: id }).lean();
  
  return {
    ...contract,
    analyses,
  };
};

module.exports = {
  saveContractService,
  getContractFromDb
}
