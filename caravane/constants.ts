

import { Patient, PatientSexe, Specialite, UserRole, User, Consultation, ConsultationType, ConsultationStatut, CaravaneStatut, Caravane } from './types';
import { generateUniqueId } from './utils/helpers';

export const APP_NAME = "Caravane Médicale";
export const DEFAULT_ITEMS_PER_PAGE = 10;

export const USER_ROLES_CONFIG: Record<UserRole, { name: string; permissions: string[], idPrefix?: string, baseUsername?: string, defaultSpecialty?: Specialite }> = {
  [UserRole.ACCUEIL]: { 
    name: 'Personnel d\'Accueil',
    permissions: ['view_dashboard', 'manage_patients_accueil', 'view_consultations_basic', 'add_patients', 'edit_consultations_accueil'],
    idPrefix: 'accueil',
    baseUsername: 'accueil.user'
  },
  [UserRole.MEDECIN_GENERALISTE]: { 
    name: 'Médecin Généraliste',
    permissions: ['view_dashboard', 'view_patients', 'manage_consultations_general', 'add_consultations', 'edit_patients_gp'], // Removed 'view_caravanes_basic', added 'edit_patients_gp'
    idPrefix: 'mg',
    baseUsername: 'dr.general',
    defaultSpecialty: Specialite.GENERALE,
  },
  [UserRole.MEDECIN_SPECIALISTE]: { 
    name: 'Médecin Spécialiste',
    permissions: ['view_dashboard', 'view_patients_specialist', 'manage_consultations_specialist', 'add_consultations'], // Removed 'view_caravanes_basic' from here as well
    idPrefix: 'ms',
    baseUsername: 'dr.spec',
  },
  [UserRole.ADMIN]: { 
    name: 'Administrateur',
    permissions: ['view_dashboard', 'manage_patients_full', 'add_patients', 'manage_caravanes_full', 'add_caravanes', 'manage_consultations_full', 'add_consultations', 'edit_consultations_accueil', 'edit_patients_gp', 'manage_users', 'view_reports_full', 'access_admin_panel'], // Admin implicitly gets new permissions too
    idPrefix: 'admin',
    baseUsername: 'admin.system'
  },
};

export const NAV_ITEMS = [
  { name: 'Tableau de Bord', path: '/', icon: 'fa-solid fa-chart-line', requiredRoles: [UserRole.ADMIN, UserRole.MEDECIN_GENERALISTE, UserRole.MEDECIN_SPECIALISTE, UserRole.ACCUEIL] },
  { name: 'Patients', path: '/patients', icon: 'fa-solid fa-users', requiredRoles: [UserRole.ADMIN, UserRole.MEDECIN_GENERALISTE, UserRole.MEDECIN_SPECIALISTE, UserRole.ACCUEIL] },
  { name: 'Caravanes', path: '/caravanes', icon: 'fa-solid fa-truck-medical', requiredRoles: [UserRole.ADMIN] }, // Removed MEDECIN_SPECIALISTE
  { name: 'Consultations', path: '/consultations', icon: 'fa-solid fa-stethoscope', requiredRoles: [UserRole.ADMIN, UserRole.MEDECIN_GENERALISTE, UserRole.MEDECIN_SPECIALISTE, UserRole.ACCUEIL] }, 
  { name: 'Patients Hors Champ', path: '/patients-hors-champ', icon: 'fa-solid fa-user-tag', requiredRoles: [UserRole.ADMIN, UserRole.MEDECIN_GENERALISTE] },
  { name: 'Administration', path: '/admin', icon: 'fa-solid fa-user-shield', requiredRoles: [UserRole.ADMIN] },
];


export const INITIAL_PATIENTS: Patient[] = [
  {
    id: generateUniqueId(),
    numero_unique: `PAT-${generateUniqueId().substring(0,8)}`,
    prenom: "Fatima",
    nom: "El Alaoui",
    cin: "AB123456",
    adresse: "12 Rue de la Paix, Casablanca",
    age: 45,
    sexe: PatientSexe.FEMININ,
    telephone: "0600112233",
    antecedents_medicaux: "Diabète type 2, HTA",
    email: "fatima.elalaoui@example.com",
    date_naissance: "1979-05-15",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: generateUniqueId(),
    numero_unique: `PAT-${generateUniqueId().substring(0,8)}`,
    prenom: "Ahmed",
    nom: "Bennani",
    cin: "CD789012",
    adresse: "34 Avenue Hassan II, Rabat",
    age: 62,
    sexe: PatientSexe.MASCULIN,
    telephone: "0601223344",
    antecedents_medicaux: "Problèmes cardiaques",
    email: "ahmed.bennani@example.com",
    date_naissance: "1962-11-20",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: generateUniqueId(),
    numero_unique: `PAT-${generateUniqueId().substring(0,8)}`,
    prenom: "Khadija",
    nom: "Chafik",
    cin: "EF345678",
    adresse: "56 Boulevard Mohammed V, Marrakech",
    age: 30,
    sexe: PatientSexe.FEMININ,
    telephone: "0602334455",
    antecedents_medicaux: "Asthme",
    email: "khadija.chafik@example.com",
    date_naissance: "1994-02-10",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const SPECIALTIES_LIST: Specialite[] = [
  Specialite.NEUROLOGIE,
  Specialite.NEUROCHIRURGIE,
  Specialite.PSYCHIATRIE,
  Specialite.GENERALE
];

export const MOCK_USERS: User[] = [
  {
    id: 'admin001',
    username: 'Admin', // Updated username
    email: 'admin@caravanemedicale.app',
    role: UserRole.ADMIN,
    nom: 'Admin', // Updated nom
    prenom: 'Principal', // Updated prenom
    actif: true,
    passwordHash: 'admine6_hashed', // Updated passwordHash for "admine6"
    created_at: new Date('2023-01-01').toISOString(),
    updated_at: new Date('2023-01-01').toISOString(),
  }
  // All other users are removed
];

export const MOCK_CARAVANES: Caravane[] = [ 
    {
    id: generateUniqueId(),
    numero_unique: `CAR-${generateUniqueId().substring(0,6)}`,
    nom: "Caravane Espoir Atlas",
    date_caravane: "2024-08-15",
    lieu: "Village Ait Ourir",
    specialites_couvertes: [Specialite.NEUROLOGIE, Specialite.GENERALE],
    statut: CaravaneStatut.PLANIFIEE,
    equipe_medicale: MOCK_USERS.find(u => u.id === 'admin001') ? [] : [], // Simplified as only admin exists
    participants: [],
    created_at: new Date("2024-05-01T10:00:00Z").toISOString(),
    updated_at: new Date("2024-05-01T10:00:00Z").toISOString(),
  },
  {
    id: generateUniqueId(),
    numero_unique: `CAR-${generateUniqueId().substring(0,6)}`,
    nom: "Caravane Lumière du Sud",
    date_caravane: new Date().toISOString().split('T')[0], 
    lieu: "Ville de Zagora",
    specialites_couvertes: [Specialite.PSYCHIATRIE, Specialite.NEUROCHIRURGIE, Specialite.GENERALE],
    statut: CaravaneStatut.EN_COURS,
    equipe_medicale: MOCK_USERS.find(u => u.id === 'admin001') ? [] : [], // Simplified
    participants: [INITIAL_PATIENTS[0], INITIAL_PATIENTS[1]],
    created_at: new Date("2024-04-10T14:30:00Z").toISOString(),
    updated_at: new Date().toISOString(), 
  }
];


export const MOCK_CONSULTATIONS: Consultation[] = [
  {
    id: generateUniqueId(),
    patient_id: INITIAL_PATIENTS[0].id, 
    patient_nom: `${INITIAL_PATIENTS[0].prenom} ${INITIAL_PATIENTS[0].nom}`,
    caravane_id: MOCK_CARAVANES.find(c => c.statut === CaravaneStatut.EN_COURS)?.id || MOCK_CARAVANES[0].id, 
    caravane_nom: MOCK_CARAVANES.find(c => c.statut === CaravaneStatut.EN_COURS)?.nom || MOCK_CARAVANES[0].nom,
    medecin_id: MOCK_USERS.find(u => u.role === UserRole.MEDECIN_GENERALISTE)?.id || 'mg_fallback_id', // Fallback if no MG
    medecin_nom: MOCK_USERS.find(u => u.role === UserRole.MEDECIN_GENERALISTE) ? `${MOCK_USERS.find(u => u.role === UserRole.MEDECIN_GENERALISTE)!.prenom} ${MOCK_USERS.find(u => u.role === UserRole.MEDECIN_GENERALISTE)!.nom}` : 'Dr. Général Fallback',
    type_consultation: ConsultationType.GENERALE,
    specialite: Specialite.GENERALE,
    notes: "Patient se plaint de maux de tête fréquents. Tension artérielle légèrement élevée.",
    diagnostic: "Céphalées de tension, HTA légère",
    orientation: "Surveillance tension, consultation neurologique si persistance",
    scanner_effectue: false,
    orientation_chu: false,
    suivi_necessaire: true,
    statut: ConsultationStatut.TERMINEE,
    oriented_to_specialties: [Specialite.NEUROLOGIE],
    hors_champ_specialite_caravane: false, 
    date_rdv: undefined,
    date_prochain_rdv: undefined,
    created_at: new Date(new Date().setDate(new Date().getDate() -1)).toISOString(), 
    updated_at: new Date(new Date().setDate(new Date().getDate() -1)).toISOString(),
  },
  {
    id: generateUniqueId(),
    patient_id: INITIAL_PATIENTS[1].id,
    patient_nom: `${INITIAL_PATIENTS[1].prenom} ${INITIAL_PATIENTS[1].nom}`,
    caravane_id: MOCK_CARAVANES.find(c => c.statut === CaravaneStatut.EN_COURS)?.id || MOCK_CARAVANES[1].id,
    caravane_nom: MOCK_CARAVANES.find(c => c.statut === CaravaneStatut.EN_COURS)?.nom || MOCK_CARAVANES[1].nom,
    medecin_id: MOCK_USERS.find(u => u.role === UserRole.MEDECIN_SPECIALISTE && u.specialite === Specialite.NEUROLOGIE)?.id || 'ms_neuro_fallback_id',
    medecin_nom: MOCK_USERS.find(u => u.role === UserRole.MEDECIN_SPECIALISTE && u.specialite === Specialite.NEUROLOGIE) ? `${MOCK_USERS.find(u => u.role === UserRole.MEDECIN_SPECIALISTE && u.specialite === Specialite.NEUROLOGIE)!.prenom} ${MOCK_USERS.find(u => u.role === UserRole.MEDECIN_SPECIALISTE && u.specialite === Specialite.NEUROLOGIE)!.nom}`: 'Dr. Neuro Fallback',
    type_consultation: ConsultationType.SPECIALISEE,
    specialite: Specialite.NEUROLOGIE,
    notes: "Patient orienté pour investigation de douleurs neuropathiques chroniques. Examen neurologique en cours.",
    diagnostic: "Suspicion de neuropathie périphérique",
    orientation: "EMG à programmer",
    oriented_to_specialties: [],
    hors_champ_specialite_caravane: false,
    scanner_effectue: false,
    orientation_chu: false,
    suivi_necessaire: true,
    statut: ConsultationStatut.EN_COURS,
    date_rdv: new Date().toISOString().split('T')[0], 
    date_prochain_rdv: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0], 
    created_at: new Date().toISOString(), 
    updated_at: new Date().toISOString(),
  }
];