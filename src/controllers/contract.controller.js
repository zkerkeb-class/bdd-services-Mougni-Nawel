const contractService = require("../services/contract.service");

const defaultAnalysis = {
  overview: "Analyse par défaut",
  clauses_abusives: [],
  risks: [],
  recommendations: []
};

class ContractController {
  async saveContract(req, res) {
    try {
      const { text } = req.body;
      const token = req.headers.authorization;
      if (!text || !token) {
        return res.status(400).json({
          success: false,
          message: "Contenu et token requis",
        });
      }

      const user = await contractService.verifyUser(token);
      const contract = await contractService.saveContract(text, user._id, token);

      res.status(201).json({
        success: true,
        data: contract,
        message: "Contrat sauvegardé et analyse déclenchée",
      });
    } catch (error) {
      console.error("Erreur saveContract:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Erreur lors de la sauvegarde",
      });
    }
  }

  async getContract(req, res) {
    try {
      const { id } = req.params;
      const contractData = await contractService.getContractWithAnalyses(id);

      res.json({
        success: true,
        data: {
          ...contractData.contract,
          analyses: contractData.analyses,
          analysisStatus: contractData.analysisStatus,
        },
      });
    } catch (error) {
      console.error("Erreur getContract:", error);
      res.status(error.message === "Contrat non trouvé" ? 404 : 500).json({
        success: false,
        message: error.message || "Erreur serveur",
      });
    }
  }

  async getContractsWithAnalyses(req, res) {
    try {
      const token = req.headers.authorization;

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Token requis",
        });
      }

      const user = await contractService.verifyUser(token);
      const contracts = await contractService.getUserContracts(user._id);

      const contractsWithStatus = contracts.map((contract) => ({
        ...contract,
        analysisStatus: {
          ...contract.analysisStatus,
          message: contractService.getAnalysisStatus(contract.status, contract.analyses.length),
        },
      }));

      res.json({
        success: true,
        data: contractsWithStatus,
        summary: {
          total: contracts.length,
          pending: contracts.filter((c) => c.status === "pending").length,
          analyzed: contracts.filter((c) => c.status === "analyzed").length,
          withAnalyses: contracts.filter((c) => c.analyses.length > 0).length,
        },
      });
    } catch (error) {
      console.error("Erreur getContractsWithAnalyses:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Erreur serveur",
      });
    }
  }

  async saveAnalysis(req, res) {
    try {
      const { contractId } = req.params;
      const { analysisData } = req.body;

      if (!contractId || !analysisData) {
        return res.status(400).json({
          success: false,
          message: "ID contrat et données d'analyse requis",
        });
      }

      const analysis = await contractService.saveAnalysis(contractId, analysisData);

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      console.error("Erreur saveAnalysis:", error);
      res.status(error.message === "Contrat non trouvé" ? 404 : 500).json({
        success: false,
        message: error.message || "Erreur lors de la sauvegarde de l'analyse",
      });
    }
  }

  async triggerAnalysis(req, res) {
    try {
      const { id } = req.params;
      const token = req.headers.authorization;

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Token requis",
        });
      }

      const result = await contractService.triggerAnalysisWithFallback(id, token);

      res.json({
        success: true,
        message: result === defaultAnalysis ? "Analyse créée avec données par défaut" : "Analyse déclenchée avec succès",
        data: result,
      });
    } catch (error) {
      console.error("Erreur triggerAnalysis:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Erreur lors du déclenchement de l'analyse",
      });
    }
  }
}

module.exports = new ContractController();