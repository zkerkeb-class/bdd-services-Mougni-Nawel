const Contract = require("../models/contract");
const Analysis = require("../models/analysis");
const axios = require("axios");
const mongoose = require("mongoose");
const crypto = require('crypto');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL;

class ContractService {

  generateContentHash(content) {
    return crypto.createHash('sha256')
      .update(content.trim().toLowerCase())
      .digest('hex');
  }


  async verifyUser(token) {
    const authResponse = await axios.get(`${AUTH_SERVICE_URL}/api/auth/me`, {
      headers: { Authorization: token },
    });

    if (!authResponse.data.success) {
      throw new Error("Utilisateur non authentifié");
    }

    return authResponse.data.data;
  }

  async saveContract(text, userId, token) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const contentHash = this.generateContentHash(text);

      const existingContract = await Contract.findOne({
        $or: [
          { content: text, user: userId },
          { contentHash: contentHash, user: userId },
        ],
        status: { $in: ["pending", "analyzed"] }
      }).session(session);

      if (existingContract) {
        await session.abortTransaction();

        return {
          ...existingContract.toObject(),
          isDuplicate: true,
          message: "Ce contrat existe déjà"
        };

      }

      const contract = new Contract({
        content: text,
        contentHash: contentHash,
        user: userId,
        status: "pending",
        analysisStarted: false,
        createdAt: new Date(),
      });

      await contract.save({ session });
      await session.commitTransaction();

      this.triggerAIAnalysisIfNotStarted(contract._id, token).catch((error) => {
        console.error("Erreur analyse IA:", error);
        Contract.findByIdAndUpdate(contract._id, {
          analysisStarted: false,
          lastAnalysisError: error.message
        });
      });

      return {
        ...contract.toObject(),
        isDuplicate: false,
        message: "Contrat créé avec succès"
      };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }


  async callAIAnalysis(contractId, token) {
    try {
      const response = await axios.get(`${AI_SERVICE_URL}/api/analyze/analyzeContract/${contractId}`, {
        headers: { Authorization: token },
        timeout: 30000,
      });

      return response.data;
    } catch (error) {
      console.error("Erreur analyse IA:", error);
      await this.saveDefaultAnalysis(contractId);
      throw error;
    }
  }


  async getContractWithAnalyses(id) {
    const contract = await Contract.findById(id).lean();
    if (!contract) {
      throw new Error("Contrat non trouvé");
    }

    const analyses = await Analysis.find({ contract: contract._id })
      .sort({ analysisDate: -1 })
      .lean();

    const formattedAnalyses = analyses.map((analysis) => ({
      ...analysis,
      result: typeof analysis.result === "string" ? JSON.parse(analysis.result) : analysis.result,
      analysisDate: analysis.analysisDate ? analysis.analysisDate.toISOString() : null,
    }));

    return {
      contract,
      analyses: formattedAnalyses,
      analysisStatus: this.getAnalysisStatus(contract.status, analyses.length),
    };
  }

  async getUserContracts(userId) {
    return await Contract.aggregate([
      { $match: { user: userId } },
      {
        $lookup: {
          from: "analyses",
          localField: "_id",
          foreignField: "contract",
          as: "analyses",
        },
      },
      {
        $addFields: {
          analysisStatus: {
            status: "$status",
            hasAnalyses: { $gt: [{ $size: "$analyses" }, 0] },
            analysesCount: { $size: "$analyses" },
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  }

  async saveAnalysis(contractId, analysisData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const contract = await Contract.findById(contractId).session(session);
      if (!contract) {
        throw new Error("Contrat non trouvé");
      }

      // Formatter les données pour le schéma
      const formattedAnalysis = {
        contract: contractId,
        result: analysisData,
        abusiveClauses: (analysisData.clauses_abusives || []).map(c => c.clause),
        riskLevel: this.calculateRiskLevel(analysisData.risks || [])
      };

      // Créer ou mettre à jour l'analyse
      const analysis = await Analysis.findOneAndUpdate(
        { contract: contractId },
        formattedAnalysis,
        {
          upsert: true,
          new: true,
          session,
          setDefaultsOnInsert: true
        }
      );

      await Contract.findByIdAndUpdate(
        contractId,
        {
          status: "analyzed",
          analysis: analysis._id,
          analysisStarted: false 
        },
        { session }
      );

      await session.commitTransaction();
      return analysis;
    } catch (error) {
      await session.abortTransaction();
      console.error("Erreur saveAnalysis:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }


  calculateRiskLevel(risks) {
    if (!Array.isArray(risks)) return "low";

    const highRisks = risks.filter((r) => r.severity === "high").length;

    if (highRisks >= 2) return "high";
    if (risks.length >= 3 || highRisks >= 1) return "medium";
    return "low";
  }

  getAnalysisStatus(status, analysesCount) {
    if (status === "pending" && analysesCount === 0) {
      return "Analyse en cours de traitement...";
    }
    if (status === "pending" && analysesCount > 0) {
      return "Contrat en attente mais analyses disponibles";
    }
    if (status === "analyzed" && analysesCount > 0) {
      return `Analyse terminée (${analysesCount} analyse${analysesCount > 1 ? "s" : ""})`;
    }
    if (status === "analyzed" && analysesCount === 0) {
      return "Marqué comme analysé mais aucune analyse trouvée";
    }
    return "Statut inconnu";
  }


async triggerAIAnalysisIfNotStarted(contractId, token) {
  const maxRetries = 3;
  let retryCount = 0;
  let lastError;

  while (retryCount < maxRetries) {
    try {
      const contract = await Contract.findOneAndUpdate(
        {
          _id: contractId,
          $or: [
            { analysisStarted: { $ne: true } },
            { analysisStarted: null }
          ]
        },
        {
          $set: {
            analysisStarted: true,
            lastAnalysisAttempt: new Date()
          },
          $inc: {
            analysisRetryCount: 1
          }
        },
        { new: true, upsert: false }
      );

      if (!contract) {
        return Promise.resolve();
      }

      return await this.callAIAnalysis(contractId, token);

    } catch (error) {
      lastError = error;
      retryCount++;
      if (retryCount >= maxRetries) {
        await Contract.findByIdAndUpdate(contractId, {
          $set: {
            analysisStarted: false,
            lastAnalysisError: error.message,
            status: "failed"
          }
        });
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
  throw lastError;
}


  async callAIAnalysis(contractId, token) {
    try {
      const response = await axios.get(`${AI_SERVICE_URL}/api/analyze/analyzeContract/${contractId}`, {
        headers: { Authorization: token },
        timeout: 30000,
      });

      return response.data;
    } catch (error) {
      console.error("Erreur analyse IA:", error);
      throw error;
    }
  }

  async normalizeAIResponse(response) {
    try {
      if (typeof response === 'object' && response !== null) {
        if (response.analysis_summary) {
          return response.analysis_summary;
        }
        return response;
      }

      if (typeof response === 'string') {
        const parsed = JSON.parse(response);
        return this.normalizeAIResponse(parsed);
      }

      throw new Error("Format de réponse IA non reconnu");
    } catch (error) {
      console.error("Erreur normalisation réponse IA:", error);
      return {
        overview: "Erreur d'analyse du contrat",
        clauses_abusives: [],
        risks: [],
        recommendations: []
      };
    }
  }
}

module.exports = new ContractService();
