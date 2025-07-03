const express = require('express');
const helmet = require('helmet');
const timeout = require('express-timeout-handler');
const mongoose = require('mongoose');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.dev') });


const logger = require('./utils/logger.js');
const router = require('./routes/index.js');
const { initializeMetrics, metricsRouter, metricsMiddleware } = require('./utils/metrics');

const { connectAndLoadModels, connect } = require('./models/index.js');
// const metricsRouter = require('../src/routes/metrics.route.js');

// dotenv.config();

const app = express();
const port = 8000;
app.use(helmet());
// Connect to DB once on startup
connect().catch(err => {
  console.error('DB Connection failed:', err);
  process.exit(1);
});

app.use(express.json()); // Pour parser le JSON dans les requêtes
app.use(express.urlencoded({ extended: true })); // Pour parser les données de formulaire
// app.use(globalRateLimiter);

// Set up CORS options
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
const io = new http.Server(app, {
  cors: corsOptions,
});


// Enable CORS
app.use(cors(corsOptions));

// 🔧 INITIALISATION DES MÉTRIQUES (OBLIGATOIRE)
initializeMetrics('authentification');

// 📊 MIDDLEWARE MÉTRIQUES (avant les autres middlewares)
app.use(metricsMiddleware);

// 🛣️ ROUTES MÉTRIQUES
app.use(metricsRouter);

// Gestion d'erreur globale avec métriques
app.use((err, req, res, next) => {
  const { recordError } = require('./utils/metrics');
  recordError('unhandled_error', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Gestion des erreurs CSRF
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Token CSRF invalide ou manquant.' });
  }
  next(err);
});

// // Database connection function
// async function connectWithRetry() {
//   const pRetry = (await import('p-retry')).default;
//   return pRetry(
//     () =>
//       mongoose.connect(process.env.MONGO_URI, {
//         useNewUrlParser: true,
//         useUnifiedTopology: true,
//         connectTimeoutMS: 5000,
//         socketTimeoutMS: 45000,
//       }),
//     {
//       retries: 3,
//       onFailedAttempt: (error) => {
//         logger.info(`Tentative ${error.attemptNumber} échouée. Erreur: ${error.message}`);
//       },
//     }
//   );
// }

// Configuration de la sauvegarde
const backupConfig = {
  containerName: process.env.AZURE_CONTAINER_NAME_BACKUP, // Nom du conteneur Azure
  notificationUrl: process.env.NOTIFICATION_URL, // URL de notification (ntfy.sh)
};


// // Initialize app and pass db to routes
// const initializeApp = async () => {
//   try {
//     const db = await connectAndLoadModels();
    
//     // Make db accessible to all routes via app.locals
//     app.locals.db = db;
    
//     logger.info('Application initialized successfully');
//   } catch (error) {
//     logger.error('Initialization failed:', error);
//     process.exit(1);
//   }
// };

// Then in your route files, you can access db via req.app.locals.db
app.use(express.json());
// app.use(trackBandwidth);
// app.use(trackSuccessFailure);

app.use('/api', router);


app.use(
  timeout.handler({
    timeout: 10000,
    onTimeout: (res) => {
      res.status(503).json({ error: 'Requête expirée, veuillez réessayer plus tard.' });
    },
    disable: ['write', 'setHeaders'], // Empêche de modifier les headers après timeout
  })
);
app.use((err, res) => {
  if (err.code === 'ETIMEDOUT') {
    return res.status(504).json({ error: 'Timeout serveur, veuillez réessayer plus tard.' });
  }
  logger.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// app.use(querycacheMiddleware);
// app.use('/metrics', metricsRouter);
const startServer = async () => {
  try {
    // Load DB models, connect once
    const db = await connectAndLoadModels();

    app.locals.db = db; // optional, if needed elsewhere
    logger.info('✅ MongoDB connected, launching server...');

    // Start Express server
    app.listen(port, () => {
      logger.info(`🚀 Server listening at http://localhost:${port}`);
    });

  } catch (err) {
    logger.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

startServer(); // ✅ This was commented, but it's critical!
