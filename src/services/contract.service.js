const Contract = require("../models/Contract");
const Analysis = require("../models/Analysis");
const axios = require("axios");
const mongoose = require("mongoose");
const crypto = require('crypto');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
// const BDD_SERVICE_URL = process.env.BDD_SERVICE_URL;

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

      // 🔍 Vérification améliorée des doublons
      const existingContract = await Contract.findOne({
        $or: [
          { content: text, user: userId }, // Contenu exact
          { contentHash: contentHash, user: userId }, // Hash identique
        ],
        status: { $in: ["pending", "analyzed"] }
      }).session(session);

      if (existingContract) {
        await session.abortTransaction();
        console.log("Contrat identique trouvé:", existingContract._id);

        // ✅ Retourner le contrat existant avec un flag pour le frontend
        return {
          ...existingContract.toObject(),
          isDuplicate: true,
          message: "Ce contrat existe déjà"
        };
      }

      const contract = new Contract({
        content: text,
        contentHash: contentHash, // ✅ Stocker le hash
        user: userId,
        status: "pending",
        analysisStarted: false,
        createdAt: new Date(),
      });

      await contract.save({ session });
      await session.commitTransaction();

      // ✅ Déclencher l'analyse avec une meilleure gestion des erreurs
      this.triggerAIAnalysisIfNotStarted(contract._id, token).catch((error) => {
        console.error("Erreur analyse IA:", error);
        // Optionnel : marquer le contrat comme ayant échoué
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

  // // ✅ Améliorer la gestion des analyses simultanées
  // async triggerAIAnalysisIfNotStarted(contractId, token) {
  //   const maxRetries = 3;
  //   let retryCount = 0;

  //   while (retryCount < maxRetries) {
  //     try {
  //       // Utiliser findOneAndUpdate avec upsert pour éviter les race conditions
  //       const contract = await Contract.findOneAndUpdate(
  //         { 
  //           _id: contractId, 
  //           $or: [
  //             { analysisStarted: { $ne: true } },
  //             { analysisStarted: null }
  //           ]
  //         },
  //         { 
  //           analysisStarted: true,
  //           lastAnalysisAttempt: new Date(),
  //           analysisRetryCount: { $inc: 1 }
  //         },
  //         { new: true, upsert: false }
  //       );

  //       if (!contract) {
  //         console.log(`Analyse déjà en cours pour le contrat ${contractId}`);
  //         return;
  //       }

  //       console.log(`Démarrage analyse pour contrat ${contractId} (tentative ${retryCount + 1})`);
  //       await this.callAIAnalysis(contractId, token);
  //       return; // Succès, sortir de la boucle

  //     } catch (error) {
  //       retryCount++;
  //       console.error(`Erreur analyse tentative ${retryCount}:`, error);

  //       if (retryCount >= maxRetries) {
  //         // Réinitialiser le flag et sauvegarder l'analyse par défaut
  //         await Contract.findByIdAndUpdate(contractId, { 
  //           analysisStarted: false,
  //           lastAnalysisError: error.message 
  //         });

  //         await this.saveDefaultAnalysis(contractId);
  //         throw error;
  //       }

  //       // Attendre avant la prochaine tentative
  //       await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
  //     }
  //   }
  // }

  // ✅ Méthode séparée pour l'appel à l'IA
  async callAIAnalysis(contractId, token) {
    try {
      const response = await axios.get(`${AI_SERVICE_URL}/api/analyze/analyzeContract/${contractId}`, {
        headers: { Authorization: token },
        timeout: 30000,
      });

      console.log("Analyse IA réussie pour contrat", contractId);
      return response.data;
    } catch (error) {
      console.error("Erreur analyse IA:", error);
      // ✅ Fallback amélioré - sauvegarde directe sans appel API
      await this.saveDefaultAnalysis(contractId);
      throw error;
    }
  }

  // ✅ Sauvegarde directe de l'analyse par défaut (évite l'appel API)
  // async saveDefaultAnalysis(contractId) {
  //   const defaultAnalysis = {
  //     overview: "Analyse du contrat effectuée avec succès. Le contrat présente plusieurs points d'attention.",
  //     clauses_abusives: [
  //       {
  //         clause: "Clause de non-concurrence excessive",
  //         explanation: "La durée de non-concurrence dépasse les limites légales recommandées.",
  //         suggested_change: "Réduire la durée à 12 mois maximum.",
  //       },
  //     ],
  //     risks: [
  //       {
  //         risk: "Risque juridique élevé",
  //         explanation: "Certaines clauses peuvent être contestées en justice.",
  //         severity: "medium",
  //         suggested_solution: "Réviser les clauses problématiques.",
  //       },
  //     ],
  //     recommendations: [
  //       {
  //         recommendation: "Révision par un avocat",
  //         justification: "Le contrat nécessite une révision juridique approfondie.",
  //         suggested_change: "Consulter un avocat spécialisé en droit du travail.",
  //       },
  //     ],
  //   };

  //   // ✅ Sauvegarde directe sans appel API
  //   await this.saveAnalysis(contractId, defaultAnalysis);
  //   console.log("Analyse par défaut sauvegardée pour contrat", contractId);
  // }

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
          analysisStarted: false // Réinitialiser le flag
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

  // ✅ Méthode pour trigger manuel (évite la double analyse)
  // async triggerAnalysisWithFallback(contractId, token) {
  //   try {
  //     const contract = await Contract.findById(contractId);
  //     if (!contract) {
  //       throw new Error("Contrat non trouvé");
  //     }

  //     // ✅ Vérifier si une analyse existe déjà
  //     const existingAnalysis = await Analysis.findOne({ contract: contractId });
  //     if (existingAnalysis) {
  //       console.log("Analyse déjà existante, retour des données existantes");
  //       return existingAnalysis.result;
  //     }

  //     // ✅ Vérifier si l'analyse est déjà en cours
  //     if (contract.analysisStarted && 
  //         contract.lastAnalysisAttempt && 
  //         (new Date() - contract.lastAnalysisAttempt) < 60000) { // 1 minute
  //       console.log("Analyse déjà en cours, attente...");
  //       return { message: "Analyse en cours, veuillez patienter..." };
  //     }

  //     // Déclencher l'analyse
  //     return await this.triggerAIAnalysisIfNotStarted(contractId, token);
  //   } catch (error) {
  //     console.error("Erreur lors du déclenchement manuel:", error);
  //     throw error;
  //   }
  // }

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

  //   async triggerAIAnalysisIfNotStarted(contractId, token) {
  //     const maxRetries = 3;
  //     let retryCount = 0;

  //     while (retryCount < maxRetries) {
  //       try {
  //         const contract = await Contract.findOneAndUpdate(
  //           { 
  //             _id: contractId, 
  //             $or: [
  //               { analysisStarted: { $ne: true } },
  //               { analysisStarted: null }
  //             ]
  //           },
  //           { 
  //             analysisStarted: true,
  //             lastAnalysisAttempt: new Date(),
  //             analysisRetryCount: { $inc: 1 }
  //           },
  //           { new: true, upsert: false }
  //         );

  //         if (!contract) {
  //           console.log(`Analyse déjà en cours pour le contrat ${contractId}`);
  //           return;
  //         }

  //         console.log(`Démarrage analyse pour contrat ${contractId} (tentative ${retryCount + 1})`);
  //         return await this.callAIAnalysis(contractId, token);

  //       } catch (error) {
  //         retryCount++;
  //         console.error(`Erreur analyse tentative ${retryCount}:`, error);

  //         if (retryCount >= maxRetries) {
  //           await Contract.findByIdAndUpdate(contractId, { 
  //             analysisStarted: false,
  //             lastAnalysisError: error.message,
  //             status: "failed" // Nouveau statut pour les échecs
  //           });
  //           throw error;
  //         }

  //         await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
  //       }
  //     }
  // }

  async triggerAIAnalysisIfNotStarted(contractId, token) {
    const maxRetries = 3;
    let retryCount = 0;

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
          console.log(`Analyse déjà en cours pour le contrat ${contractId}`);
          return;
        }

        console.log(`Démarrage analyse pour contrat ${contractId} (tentative ${retryCount + 1})`);
        return await this.callAIAnalysis(contractId, token);

      } catch (error) {
        retryCount++;
        console.error(`Erreur analyse tentative ${retryCount}:`, error);

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
  }

  async callAIAnalysis(contractId, token) {
    try {
      const response = await axios.get(`${AI_SERVICE_URL}/api/analyze/analyzeContract/${contractId}`, {
        headers: { Authorization: token },
        timeout: 30000,
      });

      console.log("Analyse IA réussie pour contrat", contractId);
      return response.data;
    } catch (error) {
      console.error("Erreur analyse IA:", error);
      throw error; // On ne fait plus de fallback
    }
  }

  async normalizeAIResponse(response) {
  try {
    // Si la réponse est déjà un objet, vérifier sa structure
    if (typeof response === 'object' && response !== null) {
      if (response.analysis_summary) {
        return response.analysis_summary;
      }
      return response;
    }

    // Si c'est une string, tenter de la parser
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