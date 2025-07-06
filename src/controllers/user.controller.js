const userService = require("../services/user.service")

const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params
    const user = await userService.findUserByEmail(email, true)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé",
      })
    }

    res.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error("Erreur getUserByEmail:", error)
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    })
  }
}

const getUserByGoogleId = async (req, res) => {
  try {
    const { googleId } = req.params
    const user = await userService.findUserByGoogleId(googleId)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé",
      })
    }

    res.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error("Erreur getUserByGoogleId:", error)
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    })
  }
}

const getUserById = async (req, res) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID utilisateur requis",
      })
    }

    const user = await userService.findUserById(id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé",
      })
    }

    res.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error("Erreur getUserById:", error)
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    })
  }
}

const createUser = async (req, res) => {
  try {
    const userData = req.body

    const user = await userService.createUser(userData)

    res.status(201).json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error("Erreur createUser:", error)

    if (error.message === "Un utilisateur avec cet email existe déjà" || error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Un utilisateur avec cet email existe déjà",
      })
    }

    res.status(500).json({
      success: false,
      message: "Erreur lors de la création de l'utilisateur",
    })
  }
}

const createGoogleUser = async (req, res) => {
  try {
    console.log('Données reçues dans createGoogleUser:', req.body);
    
    const userData = req.body;
    
    // Validation des données avant d'appeler le service
    if (!userData.email) {
      return res.status(400).json({
        success: false,
        message: "Email est requis",
      });
    }
    
    if (!userData.googleId) {
      return res.status(400).json({
        success: false,
        message: "Google ID est requis",
      });
    }
    
    // Assurer que firstname et lastname ont des valeurs par défaut
    const processedUserData = {
      email: userData.email,
      googleId: userData.googleId,
      firstname: userData.firstname || userData.given_name || 'Utilisateur',
      lastname: userData.lastname || userData.family_name || 'Google'
    };
    
    console.log('Données traitées:', processedUserData);
    
    const user = await userService.createOrGetGoogleUser(processedUserData);

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Erreur createGoogleUser:", error);
    
    // Gestion spécifique des erreurs de validation
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Erreur de validation",
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Erreur lors de la création de l'utilisateur Google",
    });
  }
}

const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body

    const user = await userService.updateUser(id, updateData)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé",
      })
    }

    res.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error("Erreur updateUser:", error)
    res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour",
    })
  }
}

const incrementAnalysisCount = async (req, res) => {
  try {
    const { id } = req.params

    const user = await userService.incrementAnalysisCount(id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé",
      })
    }

    res.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error("Erreur incrementAnalysisCount:", error)
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'incrémentation",
    })
  }
}

const getUserByStripeId = async (req, res) => {
  try {
    const { stripeId } = req.params
    const user = await userService.findUserByStripeId(stripeId)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé",
      })
    }

    res.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error("Erreur getUserByStripeId:", error)
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    })
  }
}

module.exports = {
  getUserByEmail,
  getUserById,
  createUser,
  getUserByGoogleId,
  createGoogleUser,
  updateUser,
  incrementAnalysisCount,
  getUserByStripeId,
}