const logger = require('../utils/logger');
const { extractTextFromFile } = require('../services/upload.service');
const fs = require('fs');

const handleUpload = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Aucun fichier reçu' });
    }

    const extractedText = await extractTextFromFile(file);

    fs.unlinkSync(file.path);

    logger.info('Text extracted from file : ', extractedText);
    return res.status(200).json({ extractedText });
  } catch (error) {
    logger.error('Erreur upload.controller:', error);
    res.status(500).json({ message: 'Erreur interne serveur' });
  }
};


module.exports = {
  handleUpload
};
