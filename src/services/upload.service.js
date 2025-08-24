const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const logger = require('../utils/logger');

const extractTextFromFile = async (file) => {
  const { mimetype, path } = file;
  console.log('INN : ', { mimetype, path } );

  if (mimetype === 'application/pdf') {
    const dataBuffer = fs.readFileSync(path);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const data = await mammoth.extractRawText({ path });
    return data.value;
  }

  logger.error('Format de fichier non supporté');
  throw new Error('Format de fichier non supporté');
};

module.exports = {
  extractTextFromFile
}
