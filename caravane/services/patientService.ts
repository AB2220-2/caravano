
// Fix: Import PaginatedResponse from types.ts
import { Patient, PatientFormData, PatientSexe, PaginatedResponse, UserRole } from '../types';
import { INITIAL_PATIENTS } from '../constants';
import { generateUniqueId } from '../utils/helpers';
import consultationService from './consultationService'; // Import consultationService for cascade delete

// Simulate a database
let mockPatients: Patient[] = [...INITIAL_PATIENTS];

interface GetPatientsParams {
  page?: number;
  limit?: number;
  search?: string;
  patientIds?: string[]; 
  fetchReferredByAccueil?: boolean; 
  excludePatientIds?: string[]; 
  forAccueilPatientList?: boolean; 
}


const patientService = {
  getPatients: async (params: GetPatientsParams = {}): Promise<PaginatedResponse<Patient>> => {
    const { page = 1, limit = 10, search = '', patientIds, fetchReferredByAccueil, excludePatientIds, forAccueilPatientList } = params;
    await new Promise(resolve => setTimeout(resolve, 300));

    let filteredPatients = [...mockPatients]; 
    let applyGenericExclusionAfterSearch = false;
    let genericExclusionIds: string[] | undefined = undefined;


    if (patientIds && patientIds.length > 0) {
        // For specialist: patientIds are those oriented to them.
        // We'll apply excludePatientIds (those already consulted by this specialist) *after* search on this initial list.
        const idsSet = new Set(patientIds);
        filteredPatients = filteredPatients.filter(p => idsSet.has(p.id));
        if (excludePatientIds && excludePatientIds.length > 0) {
            applyGenericExclusionAfterSearch = true;
            genericExclusionIds = excludePatientIds;
        }
    } else if (forAccueilPatientList) {
        // Accueil: Patients not yet flagged for GP AND without any consultations.
        // excludePatientIds here are patient_ids from *any* consultation.
        const exclusionSet = new Set(excludePatientIds || []);
        filteredPatients = filteredPatients.filter(p => !p.est_oriente_generaliste && !exclusionSet.has(p.id));
    } else if (fetchReferredByAccueil) {
        // GP: Patients flagged by Accueil (`est_oriente_generaliste === true`).
        // `excludePatientIds` are patient_ids for whom THIS GP has created ANY consultation already.
        const exclusionSet = new Set(excludePatientIds || []);
        filteredPatients = filteredPatients.filter(p => p.est_oriente_generaliste === true && !exclusionSet.has(p.id));
    }
    // If none of the above specific filters apply (e.g., Admin viewing general list),
    // filtering proceeds based on search term if provided.
    
    if (search) {
      const searchTermLower = search.toLowerCase();
      filteredPatients = filteredPatients.filter(p =>
        p.nom.toLowerCase().includes(searchTermLower) ||
        p.prenom.toLowerCase().includes(searchTermLower) ||
        p.cin.toLowerCase().includes(searchTermLower) ||
        p.numero_unique.toLowerCase().includes(searchTermLower)
      );
    }
    
    // Apply generic exclusion if flagged (e.g. for specialist, after they've searched within their oriented patients)
    if (applyGenericExclusionAfterSearch && genericExclusionIds && genericExclusionIds.length > 0) {
        const exclusionSet = new Set(genericExclusionIds);
        filteredPatients = filteredPatients.filter(p => !exclusionSet.has(p.id));
    }


    filteredPatients.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filteredPatients.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedData = filteredPatients.slice((page - 1) * limit, page * limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
      totalPages
    };
  },

  getPatientById: async (id: string): Promise<Patient | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockPatients.find(p => p.id === id);
  },

  addPatient: async (patientData: PatientFormData): Promise<Patient> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    if (patientData.cin && mockPatients.some(p => p.cin.trim().toUpperCase() === patientData.cin!.trim().toUpperCase())) {
      throw new Error(`Un patient avec le CIN "${patientData.cin}" existe déjà.`);
    }

    const newPatient: Patient = {
      id: generateUniqueId(),
      numero_unique: `PAT-${generateUniqueId().substring(0,8)}`,
      prenom: patientData.prenom!,
      nom: patientData.nom!,
      cin: patientData.cin!,
      adresse: patientData.adresse!,
      age: parseInt(patientData.age || '0', 10), 
      sexe: patientData.sexe || PatientSexe.MASCULIN, 
      telephone: patientData.telephone,
      antecedents_medicaux: patientData.antecedents_medicaux,
      email: patientData.email,
      date_naissance: patientData.date_naissance,
      est_oriente_generaliste: patientData.est_oriente_generaliste || false, 
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockPatients.unshift(newPatient); 
    return newPatient;
  },

  updatePatient: async (id: string, patientData: PatientFormData): Promise<Patient | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const patientIndex = mockPatients.findIndex(p => p.id === id);
    if (patientIndex > -1) {
      const existingPatient = mockPatients[patientIndex];

      if (patientData.cin && patientData.cin !== existingPatient.cin && mockPatients.some(p => p.cin.trim().toUpperCase() === patientData.cin!.trim().toUpperCase() && p.id !== id) ) {
        throw new Error(`Un autre patient avec le CIN "${patientData.cin}" existe déjà.`);
      }

      const updatedPatient: Patient = {
        ...existingPatient,
        prenom: patientData.prenom !== undefined ? patientData.prenom! : existingPatient.prenom,
        nom: patientData.nom !== undefined ? patientData.nom! : existingPatient.nom,
        cin: patientData.cin !== undefined ? patientData.cin! : existingPatient.cin,
        adresse: patientData.adresse !== undefined ? patientData.adresse! : existingPatient.adresse,
        telephone: patientData.telephone !== undefined ? patientData.telephone : existingPatient.telephone,
        antecedents_medicaux: patientData.antecedents_medicaux !== undefined ? patientData.antecedents_medicaux : existingPatient.antecedents_medicaux,
        email: patientData.email !== undefined ? patientData.email : existingPatient.email,
        date_naissance: patientData.date_naissance !== undefined ? patientData.date_naissance : existingPatient.date_naissance,
        age: parseInt(patientData.age || existingPatient.age.toString(), 10),
        sexe: patientData.sexe !== undefined ? patientData.sexe : existingPatient.sexe,
        est_oriente_generaliste: patientData.est_oriente_generaliste !== undefined ? patientData.est_oriente_generaliste : existingPatient.est_oriente_generaliste, 
        updated_at: new Date().toISOString(),
      };
      mockPatients[patientIndex] = updatedPatient;
      return updatedPatient;
    }
    return undefined;
  },

  deletePatient: async (id: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const initialLength = mockPatients.length;
    mockPatients = mockPatients.filter(p => p.id !== id);
    const patientWasDeleted = mockPatients.length < initialLength;

    if (patientWasDeleted) {
      // Cascade delete consultations associated with this patient
      await consultationService.deleteConsultationsByPatientId(id);
    }
    return patientWasDeleted;
  },
};

export default patientService;
