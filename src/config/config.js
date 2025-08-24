const dotenv = require('dotenv');
const path = require('path');

const environment = process.env.NODE_ENV || 'dev';

const envFilePath = path.resolve(__dirname, `../../.env.${environment}`);

dotenv.config({ path: envFilePath });

const {
  MONGO_URI,
  AI_SERVICE_URL
} = process.env;

module.exports = {
  development: {
    uri: `${MONGO_URI}`,
  },
};
