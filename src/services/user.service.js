const User = require("../models/user")

class UserService {
  async findUserByEmail(email, includePassword = false) {
    const query = User.findOne({ email: email.toLowerCase() })
    if (includePassword) {
      query.select("+password")
    }
    return query.exec()
  }

  async findUserByGoogleId(googleId) {
    return User.findOne({ googleId })
  }

  async findUserById(id) {
    return User.findById(id)
  }

  async findUserByStripeId(stripeId) {
    return User.findOne({ stripeCustomerId: stripeId })
  }

  async createUser(userData) {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.findUserByEmail(userData.email)
    if (existingUser) {
      throw new Error("Un utilisateur avec cet email existe déjà")
    }

    const user = new User(userData)
    await user.save()
    return user
  }

async createOrGetGoogleUser(userData) {
    try {
      console.log('Données reçues dans createOrGetGoogleUser:', userData);
      
      // Validation et nettoyage des données
      const cleanedData = {
        email: userData.email ? userData.email.toLowerCase().trim() : null,
        googleId: userData.googleId ? userData.googleId.toString() : null,
        firstname: userData.firstname ? userData.firstname.trim() : userData.given_name ? userData.given_name.trim() : '',
        lastname: userData.lastname ? userData.lastname.trim() : userData.family_name ? userData.family_name.trim() : ''
      };

      console.log('Données nettoyées:', cleanedData);

      // Validation des champs obligatoires
      if (!cleanedData.email) {
        throw new Error('Email est requis');
      }
      if (!cleanedData.googleId) {
        throw new Error('Google ID est requis');
      }
      if (!cleanedData.firstname) {
        throw new Error('Prénom est requis');
      }
      if (!cleanedData.lastname) {
        throw new Error('Nom est requis');
      }

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({
        $or: [
          { email: cleanedData.email },
          { googleId: cleanedData.googleId }
        ]
      });

      if (existingUser) {
        console.log('Utilisateur existant trouvé:', existingUser._id);
        return existingUser;
      }

      // Créer un nouvel utilisateur avec toutes les données requises
      const newUser = new User({
        email: cleanedData.email,
        googleId: cleanedData.googleId,
        firstname: cleanedData.firstname,
        lastname: cleanedData.lastname,
        typeAbonnement: 'free'
      });

      console.log('Tentative de sauvegarde du nouvel utilisateur:', newUser);
      await newUser.save();
      console.log('Utilisateur créé avec succès:', newUser._id);
      
      return newUser;
    } catch (error) {
      console.error("Error in createOrGetGoogleUser:", error);
      throw error;
    }
  }


  async updateUser(id, updateData) {
    return User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
  }

  async incrementAnalysisCount(id) {
    return User.findByIdAndUpdate(id, { $inc: { analysisCount: 1 } }, { new: true })
  }
}

module.exports = new UserService()