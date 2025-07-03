const pino = require('pino');

// Configuration de base du logger
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageKey: 'msg', // Changé de 'message' à 'msg' pour correspondre aux logs
      singleLine: true,  // Pour un affichage plus propre
      minimumLevel: 'info'
    },
  },
});

// Exporter directement le logger sans modification des méthodes
module.exports = logger;