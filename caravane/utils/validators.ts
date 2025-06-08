
import { PatientFormData, ValidationErrors, CaravaneFormData, UserFormData, UserRole, ConsultationFormData, ConsultationType } from '../types';

export const validatePatientForm = (formData: PatientFormData): ValidationErrors<PatientFormData> => {
  const errors: ValidationErrors<PatientFormData> = {};

  if (!formData.prenom?.trim()) {
    errors.prenom = 'Le prénom est requis.';
  }
  if (!formData.nom?.trim()) {
    errors.nom = 'Le nom est requis.';
  }
  if (!formData.cin?.trim()) {
    errors.cin = 'Le CIN est requis.';
  } else if (!/^[A-Z]{1,2}\d{1,7}$/i.test(formData.cin)) { // Common Moroccan CIN format, adjust if needed
    errors.cin = 'Format CIN invalide (ex: AB123456).';
  }
  
  if (!formData.adresse?.trim()) {
    errors.adresse = "L'adresse est requise.";
  }

  if (!formData.age) {
    errors.age = "L'âge est requis.";
  } else {
    const ageNum = parseInt(formData.age, 10);
    if (isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
      errors.age = "L'âge doit être un nombre valide entre 1 et 120.";
    }
  }
  
  if (formData.date_naissance) {
    // Basic date validation
    if (isNaN(new Date(formData.date_naissance).getTime())) {
        errors.date_naissance = "Date de naissance invalide.";
    } else if (new Date(formData.date_naissance) > new Date()) {
        errors.date_naissance = "La date de naissance ne peut pas être dans le futur.";
    }
  }


  if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    errors.email = 'Adresse email invalide.';
  }
  
  if (formData.telephone && !/^(0[5-7])(\d{2}){4}$/.test(formData.telephone.replace(/\s/g, ''))) { // Moroccan phone format
     errors.telephone = 'Format de téléphone invalide (ex: 06 XX XX XX XX).';
  }


  return errors;
};

export const validateCaravaneForm = (formData: CaravaneFormData): ValidationErrors<CaravaneFormData> => {
  const errors: ValidationErrors<CaravaneFormData> = {};
  if (!formData.nom?.trim()) {
    errors.nom = 'Le nom de la caravane est requis.';
  }
  if (!formData.date_caravane) {
    errors.date_caravane = 'La date de la caravane est requise.';
  } else if (new Date(formData.date_caravane) < new Date(new Date().toDateString())) { // Compare date part only
    errors.date_caravane = 'La date de la caravane ne peut pas être dans le passé.';
  }
  if (!formData.lieu?.trim()) {
    errors.lieu = 'Le lieu de la caravane est requis.';
  }
  if (!formData.specialites_couvertes || formData.specialites_couvertes.length === 0) {
    errors.specialites_couvertes = 'Au moins une spécialité doit être sélectionnée.';
  }
  if (!formData.statut) {
    errors.statut = 'Le statut de la caravane est requis.';
  }
  return errors;
};

export const validateUserForm = (formData: UserFormData, isNewUser: boolean = false): ValidationErrors<UserFormData> => {
  const errors: ValidationErrors<UserFormData> = {};
  if (!formData.username?.trim()) {
    errors.username = 'Le nom d\'utilisateur est requis.';
  }
  
  // Email validation only applies if it's not a new user (i.e., editing an existing user)
  // For new users, email is not collected via the form, so no validation is needed here.
  if (!isNewUser) {
    if (!formData.email?.trim()) {
      errors.email = 'L\'email est requis.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Format d\'email invalide.';
    }
  }

  if (!formData.nom?.trim()) {
    errors.nom = 'Le nom est requis.';
  }
  if (!formData.prenom?.trim()) {
    errors.prenom = 'Le prénom est requis.';
  }
  if (!formData.role) {
    errors.role = 'Le rôle est requis.';
  }
  if ((formData.role === UserRole.MEDECIN_SPECIALISTE) && !formData.specialite) {
    errors.specialite = 'La spécialité est requise pour un médecin spécialiste.';
  }

  if (isNewUser) {
    if (!formData.password) {
      errors.password = 'Le mot de passe est requis.';
    } else if (formData.password.length < 6) {
      errors.password = 'Le mot de passe doit contenir au moins 6 caractères.';
    }
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'La confirmation du mot de passe est requise.';
    } else if (formData.password && formData.confirmPassword !== formData.password) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas.';
    }
  }
  
  return errors;
};

export const validateConsultationForm = (
  formData: ConsultationFormData, 
  isGPContext: boolean,
  isSpecialistContext?: boolean 
): ValidationErrors<ConsultationFormData> => {
  const errors: ValidationErrors<ConsultationFormData> = {};

  if (!formData.patient_id?.trim()) {
    errors.patient_id = 'L\'identifiant du patient est requis.';
  }
  if (!formData.caravane_id?.trim()) {
    errors.caravane_id = 'L\'identifiant de la caravane est requis.';
  }
  if (!formData.medecin_id?.trim()) {
    errors.medecin_id = 'L\'identifiant du médecin est requis.';
  }

  if (!formData.type_consultation) {
    errors.type_consultation = 'Le type de consultation est requis.';
  } else if (formData.type_consultation === ConsultationType.SPECIALISEE && !formData.specialite) {
    errors.specialite = 'La spécialité est requise pour une consultation spécialisée.';
  }

  if (!formData.statut) {
    errors.statut = 'Le statut de la consultation est requis.';
  }
  
  if (!isSpecialistContext) { 
    if (!isGPContext || (isGPContext && !formData.notes?.trim())) { 
        if (!formData.notes?.trim()) {
            errors.notes = 'Les notes de consultation sont requises.';
        }
    }
  }

  if (isSpecialistContext && formData.suivi_necessaire) {
    if (!formData.date_prochain_rdv) {
      errors.date_prochain_rdv = 'La date du prochain rendez-vous est requise si un suivi est nécessaire.';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Compare date part only
      const rdvDate = new Date(formData.date_prochain_rdv);
      if (isNaN(rdvDate.getTime())) {
        errors.date_prochain_rdv = "Date du prochain rendez-vous invalide.";
      } else if (rdvDate < today) {
        errors.date_prochain_rdv = "La date du prochain rendez-vous ne peut pas être dans le passé.";
      }
    }
  }
  
  return errors;
};