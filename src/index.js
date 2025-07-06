const express = require("express")
const mongoose = require("mongoose")
const helmet = require("helmet")
const timeout = require("express-timeout-handler")
const cors = require("cors")
const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "../.env.dev") })

// Import des dépendances internes
const routes = require("./routes")
const { initializeMetrics, metricsRouter, metricsMiddleware } = require("./utils/metrics")
const logger = require("./utils/logger")

// Configuration initiale
const app = express()
const SERVICE_NAME = "bdd-service" // À modifier selon le service
const PORT = process.env.PORT

// 1. Fonction de connexion à MongoDB avec retry
async function connectWithRetry() {
  const pRetry = (await import("p-retry")).default
  return pRetry(
    () => mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }),
    {
      retries: 3,
      onFailedAttempt: (error) => {
        logger.info(`Tentative ${error.attemptNumber} échouée. Erreur: ${error.message}`)
      },
    }
  )
}

// 2. Initialisation de l'application
const initializeApp = async () => {
  try {
    await connectWithRetry()
    logger.info("✅ Connecté à MongoDB")
    mongoose.set("debug", true)
  } catch (error) {
    logger.error("❌ Échec de la connexion à MongoDB après 3 tentatives", error)
    throw error // Important pour arrêter le serveur si la DB est critique
  }
}

// 3. Middlewares de sécurité
app.use(helmet())
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
)

// 4. Middlewares de base
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// 5. Métriques
initializeMetrics()
app.use(metricsMiddleware)
app.use(metricsRouter)

// 6. Routes principales
app.use("/api", routes)

// 7. Health Check amélioré
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  
  res.json({
    status: dbStatus === "connected" ? "UP" : "DOWN",
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    database: dbStatus,
    details: {
      mongodb: {
        status: dbStatus,
        version: mongoose.version
      }
    }
  })
})

app.get("/ready", (req, res) => {
  const isReady = mongoose.connection.readyState === 1
  res.status(isReady ? 200 : 503).json({ 
    ready: isReady,
    database: isReady ? "connected" : "disconnected"
  })
})

// 8. Gestion des timeouts
app.use(
  timeout.handler({
    timeout: 10000,
    onTimeout: (res) => {
      res.status(503).json({ error: "Service timeout" })
    },
    disable: ["write", "setHeaders"],
  })
)

// 9. Gestion des erreurs standardisée
app.use((err, req, res, next) => {
  const { recordError } = require("./utils/metrics")
  recordError("unhandled_error", err)
  
  logger.error(`[${SERVICE_NAME}] Error:`, {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  })

  // Gestion spécifique des erreurs Mongoose
  if (err instanceof mongoose.Error) {
    return res.status(400).json({
      error: {
        type: "DatabaseError",
        message: err.message,
        code: err.code,
        service: SERVICE_NAME,
      }
    })
  }

  res.status(err.status || 500).json({
    error: {
      type: err.name || "InternalServerError",
      message: err.message || "Internal Server Error",
      service: SERVICE_NAME,
    }
  })
})

// 10. Démarrage du serveur
const startServer = async () => {
  try {
    await initializeApp()
    
    app.listen(PORT, () => {
      logger.info(`🚀 ${SERVICE_NAME} démarré sur le port ${PORT}`)
      logger.info(`📊 Métriques disponibles sur /metrics`)
      logger.info(`🩺 Health check sur /health`)
    })
  } catch (error) {
    logger.error("Échec du démarrage du serveur:", error)
    process.exit(1)
  }
}

// 11. Graceful shutdown amélioré
const shutdown = async () => {
  try {
    logger.info(`Arrêt de ${SERVICE_NAME}...`)
    await mongoose.connection.close()
    logger.info("Connexion MongoDB fermée")
    process.exit(0)
  } catch (error) {
    logger.error("Erreur lors de l'arrêt:", error)
    process.exit(1)
  }
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

startServer()

module.exports = app