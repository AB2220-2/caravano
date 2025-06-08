

export enum UserRole {
  ADMIN = 'admin',
  MEDECIN_GENERALISTE = 'medecin_generaliste',
  MEDECIN_SPECIALISTE = 'medecin_specialiste',
  ACCUEIL = 'accueil',
}

export enum PatientSexe {
  MASCULIN = 'M',
  FEMININ = 'F',
}

export enum CaravaneStatut {
  PLANIFIEE = 'planifiee',
  EN_COURS = 'en_cours',
  TERMINEE = 'terminee',
}

export enum ConsultationType {
  GENERALE = 'generale',
  SPECIALISEE = 'specialisee',
}

export enum ConsultationStatut {
  EN_ATTENTE = 'en_attente',
  EN_COURS = 'en_cours',
  TERMINEE = 'terminee',
}

export enum Specialite {
  NEUROLOGIE = 'Neurologie',
  NEUROCHIRURGIE = 'Neurochirurgie',
  PSYCHIATRIE = 'Psychiatrie',
  GENERALE = 'Médecine Générale'
}

export interface Patient {
  id: string;
  numero_unique: string;
  prenom: string;
  nom: string;
  cin: string;
  adresse: string;
  age: number;
  sexe: PatientSexe;
  telephone?: string;
  antecedents_medicaux?: string;
  email?: string; 
  date_naissance?: string; 
  created_at: string; 
  updated_at: string; 
  triggering_consultation_id?: string; // Contextual: ID of consultation leading to orientation for GP list
  est_oriente_generaliste?: boolean; // Flag if patient is oriented to GP by accueil
}

export interface Caravane {
  id: string;
  numero_unique: string;
  nom: string;
  date_caravane: string; 
  lieu: string;
  specialites_couvertes: Specialite[];
  statut: CaravaneStatut;
  participants?: Patient[]; 
  equipe_medicale?: User[]; 
  created_at: string; 
  updated_at: string; 
}

// Represents a user in a list or as part of medical team etc.
export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  specialite?: Specialite;
  nom: string;
  prenom: string;
  actif: boolean;
  passwordHash?: string; // Added for simulated password storage
  derniere_connexion?: string; 
  created_at: string; 
  updated_at: string; 
}

// Represents the currently authenticated user/role
export interface CurrentUser {
  id: string; 
  username: string; 
  role: UserRole;
  nom?: string; 
  prenom?: string; 
  specialite?: Specialite; // Added specialite field
  permissions: string[]; 
}


export interface Consultation {
  id: string;
  patient_id: string; 
  patient_nom?: string; // For display convenience
  caravane_id: string; 
  caravane_nom?: string; // For display convenience
  medecin_id: string; 
  medecin_nom?: string; // For display convenience
  type_consultation: ConsultationType;
  specialite?: Specialite; 
  notes?: string;
  diagnostic?: string;
  orientation?: string; 
  oriented_to_medecin_id?: string; // ID of the specialist doctor oriented to
  oriented_to_medecin_nom?: string; // Name of the specialist doctor oriented to (for display)
  oriented_to_specialties?: Specialite[]; 
  hors_champ_specialite_caravane?: boolean; // Added for GP new checkbox
  scanner_effectue: boolean;
  orientation_chu: boolean;
  suivi_necessaire: boolean;
  statut: ConsultationStatut;
  date_rdv?: string; // Date of appointment
  date_prochain_rdv?: string; // Date of next appointment
  created_at: string; 
  updated_at: string; 
}

export type PatientFormData = Partial<Omit<Patient, 'id' | 'created_at' | 'updated_at' | 'age' | 'numero_unique' | 'triggering_consultation_id'>> & {
  age?: string; 
  est_oriente_generaliste?: boolean; // Added for form handling
};

export type CaravaneFormData = {
  nom: string;
  date_caravane: string;
  lieu: string;
  specialites_couvertes: Specialite[];
  statut: CaravaneStatut;
  selectedGPIds?: string[];
  selectedSpecialistIds?: string[];
  selectedAccueilIds?: string[];
};

export type UserFormData = {
  username: string;
  email?: string; // Email is now optional in the form data
  nom: string;
  prenom: string;
  role: UserRole;
  specialite?: Specialite;
  actif?: boolean; // Default to true
  password?: string; // Added for user creation/update
  confirmPassword?: string; // Added for password confirmation
};

export type ConsultationFormData = {
  patient_id: string;
  caravane_id: string;
  medecin_id: string;
  type_consultation: ConsultationType;
  specialite?: Specialite;
  notes: string; // Made non-optional based on validator
  diagnostic?: string;
  orientation?: string;
  oriented_to_medecin_id?: string; 
  oriented_to_specialties?: Specialite[]; 
  hors_champ_specialite_caravane?: boolean; // Added for GP new checkbox
  scanner_effectue: boolean; // Default to false
  orientation_chu: boolean; // Default to false
  suivi_necessaire: boolean; // Default to false
  statut: ConsultationStatut;
  date_rdv?: string;
  date_prochain_rdv?: string;
};


export type ValidationErrors<T> = {
  [K in keyof T]?: string;
};

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}