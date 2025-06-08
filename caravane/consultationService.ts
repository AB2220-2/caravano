

// Fix: Ensure PaginatedResponse is imported from types (it was likely already in the import list)
import { Consultation, ConsultationFormData, ConsultationStatut, ConsultationType, PaginatedResponse, Patient, User, Caravane, UserRole, Specialite } from '../types';
import { MOCK_CONSULTATIONS, MOCK_CARAVANES, MOCK_USERS } from '../constants'; // Removed INITIAL_PATIENTS from direct use here
import patientService from './patientService'; 
import { generateUniqueId } from '../utils/helpers';

// Simulate a database for consultations
let mockConsultations: Consultation[] = [...MOCK_CONSULTATIONS];

// Helper to find doctor name
const getDoctorName = (doctorId?: string): string | undefined => {
    if (!doctorId) return undefined;
    const doctor = MOCK_USERS.find(u => u.id === doctorId); 
    return doctor ? `${doctor.prenom} ${doctor.nom}` : undefined;
};


const consultationService = {
  getConsultations: async (params: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    patientId?: string; 
    medecinId?: string; 
    caravaneId?: string; 
    isOrientedToSpecialist?: boolean; 
    filterByPatientIds?: string[]; 
    fetchHorsChamp?: boolean; 
  } = {}): Promise<PaginatedResponse<Consultation>> => {
    const { page = 1, limit = 10, search = '', patientId, medecinId, caravaneId, isOrientedToSpecialist, filterByPatientIds, fetchHorsChamp } = params;
    await new Promise(resolve => setTimeout(resolve, 300));

    let filteredConsultations = [...mockConsultations]; 

    if (patientId) {
      filteredConsultations = filteredConsultations.filter(c => c.patient_id === patientId);
    }
    if (medecinId) {
      filteredConsultations = filteredConsultations.filter(c => c.medecin_id === medecinId);
    }
    if (caravaneId) {
      filteredConsultations = filteredConsultations.filter(c => c.caravane_id === caravaneId);
    }
    if (isOrientedToSpecialist) { 
      filteredConsultations = filteredConsultations.filter(c => 
        (c.oriented_to_specialties && c.oriented_to_specialties.length > 0) || 
        c.oriented_to_medecin_id 
      );
    }
    if (filterByPatientIds && filterByPatientIds.length > 0) {
      const patientIdSet = new Set(filterByPatientIds);
      filteredConsultations = filteredConsultations.filter(c => patientIdSet.has(c.patient_id));
    }
    if (fetchHorsChamp) {
        filteredConsultations = filteredConsultations.filter(c => c.hors_champ_specialite_caravane === true);
    }


    if (search) {
      const searchTermLower = search.toLowerCase();
      filteredConsultations = filteredConsultations.filter(c =>
        c.patient_nom?.toLowerCase().includes(searchTermLower) ||
        c.medecin_nom?.toLowerCase().includes(searchTermLower) ||
        c.caravane_nom?.toLowerCase().includes(searchTermLower) ||
        c.diagnostic?.toLowerCase().includes(searchTermLower) ||
        c.notes?.toLowerCase().includes(searchTermLower) ||
        c.id.toLowerCase().includes(searchTermLower)
      );
    }
    
    filteredConsultations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filteredConsultations.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedData = filteredConsultations.slice((page - 1) * limit, page * limit);

    const dataWithPopulatedNames = paginatedData.map(consult => ({
        ...consult,
        oriented_to_medecin_nom: getDoctorName(consult.oriented_to_medecin_id)
    }));


    return {
      data: dataWithPopulatedNames,
      total,
      page,
      limit,
      totalPages
    };
  },

  getConsultationById: async (id: string): Promise<Consultation | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const consultation = mockConsultations.find(c => c.id === id);
    if (consultation) {
        return {
            ...consultation,
            oriented_to_medecin_nom: getDoctorName(consultation.oriented_to_medecin_id)
        };
    }
    return undefined;
  },

  addConsultation: async (consultationData: ConsultationFormData): Promise<Consultation> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const patient = await patientService.getPatientById(consultationData.patient_id); 
    const caravane = MOCK_CARAVANES.find(car => car.id === consultationData.caravane_id); 
    const medecin = MOCK_USERS.find(u => u.id === consultationData.medecin_id); 

    const newConsultation: Consultation = {
      id: generateUniqueId(),
      ...consultationData,
      patient_nom: patient ? `${patient.prenom} ${patient.nom}` : 'N/A',
      caravane_nom: caravane ? caravane.nom : 'N/A',
      medecin_nom: medecin ? `${medecin.prenom} ${medecin.nom}` : 'N/A',
      oriented_to_medecin_nom: getDoctorName(consultationData.oriented_to_medecin_id),
      oriented_to_specialties: consultationData.oriented_to_specialties || [],
      specialite: consultationData.type_consultation === ConsultationType.SPECIALISEE ? consultationData.specialite : Specialite.GENERALE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockConsultations.unshift(newConsultation);
    return newConsultation;
  },

  updateConsultation: async (id: string, consultationData: Partial<ConsultationFormData>): Promise<Consultation | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const consultationIndex = mockConsultations.findIndex(c => c.id === id);
    if (consultationIndex > -1) {
      const existingConsultation = mockConsultations[consultationIndex];
      
      let patientName = existingConsultation.patient_nom;
      if (consultationData.patient_id && consultationData.patient_id !== existingConsultation.patient_id) {
        const patient = await patientService.getPatientById(consultationData.patient_id);
        patientName = patient ? `${patient.prenom} ${patient.nom}` : 'N/A';
      } else if (consultationData.patient_id === existingConsultation.patient_id) { // Ensure name is refreshed if patient details changed elsewhere
        const patient = await patientService.getPatientById(existingConsultation.patient_id);
        patientName = patient ? `${patient.prenom} ${patient.nom}` : existingConsultation.patient_nom;
      }
      
      const caravane = consultationData.caravane_id ? MOCK_CARAVANES.find(car => car.id === consultationData.caravane_id) : null;
      const medecin = consultationData.medecin_id ? MOCK_USERS.find(u => u.id === consultationData.medecin_id) : null;

      const updatedConsultation: Consultation = { 
        ...existingConsultation, 
        ...consultationData, 
        patient_nom: patientName,
        caravane_nom: caravane ? caravane.nom : existingConsultation.caravane_nom,
        medecin_nom: medecin ? `${medecin.prenom} ${medecin.nom}` : existingConsultation.medecin_nom,
        oriented_to_specialties: consultationData.oriented_to_specialties !== undefined 
            ? consultationData.oriented_to_specialties 
            : (existingConsultation.oriented_to_specialties || []),
        updated_at: new Date().toISOString() 
      };
      
      if (consultationData.type_consultation) {
        if (consultationData.type_consultation === ConsultationType.GENERALE) {
          updatedConsultation.specialite = Specialite.GENERALE;
        } else if (consultationData.type_consultation === ConsultationType.SPECIALISEE) {
          if (updatedConsultation.specialite === Specialite.GENERALE || !updatedConsultation.specialite) { // If changing to specialist, and current specialty is General or undefined
             // Keep the specialty from `consultationData.specialite` if provided, otherwise set to undefined
             updatedConsultation.specialite = consultationData.specialite || undefined;
          }
        }
      }
      updatedConsultation.oriented_to_medecin_nom = getDoctorName(updatedConsultation.oriented_to_medecin_id);

      mockConsultations[consultationIndex] = updatedConsultation;
      return updatedConsultation;
    }
    return undefined;
  },

  deleteConsultation: async (id: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const initialLength = mockConsultations.length;
    mockConsultations = mockConsultations.filter(c => c.id !== id);
    return mockConsultations.length < initialLength;
  },

  deleteConsultationsByPatientId: async (patientId: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 100)); // Shorter delay for internal op
    const initialLength = mockConsultations.length;
    mockConsultations = mockConsultations.filter(c => c.patient_id !== patientId);
    return mockConsultations.length < initialLength;
  },
};

export default consultationService;