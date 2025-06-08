

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { Consultation, UserRole, ConsultationStatut, ConsultationType, Specialite, Patient, PatientSexe, User, ConsultationFormData, Caravane, CaravaneStatut, PatientFormData } from '../types';
import consultationService from '../services/consultationService';
import patientService from '../services/patientService'; 
import userService from '../services/userService';
import caravaneService from '../services/caravaneService';
import { USER_ROLES_CONFIG, DEFAULT_ITEMS_PER_PAGE, SPECIALTIES_LIST } from '../constants';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';
import Modal from '../components/common/Modal';
import OrientationEditForm from '../components/consultations/OrientationEditForm';
import { formatDate, formatDateTime } from '../utils/helpers';
import { validateConsultationForm, validatePatientForm } from '../utils/validators';

const ConsultationsPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]); 
  const [referredPatientsList, setReferredPatientsList] = useState<Patient[]>([]); 
  const [orientedPatientsForGP, setOrientedPatientsForGP] = useState<Patient[]>([]); 
  const [gpOrientationConsultationMap, setGpOrientationConsultationMap] = useState<Record<string, string>>({}); 

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGpData, setIsLoadingGpData] = useState(false); 
  const [isLoadingAccueilFilterData, setIsLoadingAccueilFilterData] = useState(false); 
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [isEditOrientationModalOpen, setIsEditOrientationModalOpen] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<Consultation | null>(null);
  const [isLoadingEditingConsultation, setIsLoadingEditingConsultation] = useState(false);
  const [editOrientationError, setEditOrientationError] = useState<string | null>(null);
  const [specialistDoctors, setSpecialistDoctors] = useState<User[]>([]);
  const [specialistWorkload, setSpecialistWorkload] = useState<Record<string, number>>({});
  const [isSubmittingOrientation, setIsSubmittingOrientation] = useState(false);

  // Excel Import/Export State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error' | 'info', text: string, details?: string[] } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  const [referralSourceMap, setReferralSourceMap] = useState<Record<string, string | undefined>>({});
  const [isLoadingReferralSources, setIsLoadingReferralSources] = useState(false);


  const itemsPerPage = DEFAULT_ITEMS_PER_PAGE;

  const roleName = USER_ROLES_CONFIG[currentUser!.role].name;
  const canAddConsultationPermission = hasPermission('add_consultations');
  const isAdmin = currentUser!.role === UserRole.ADMIN; 
  const isGP = currentUser!.role === UserRole.MEDECIN_GENERALISTE;
  const isAccueil = currentUser!.role === UserRole.ACCUEIL;
  const isSpecialist = currentUser!.role === UserRole.MEDECIN_SPECIALISTE;
  const canEditConsultationPermission = isAdmin || hasPermission('edit_consultations_accueil') || (isGP && hasPermission('add_consultations')) || (isSpecialist && hasPermission('add_consultations')); 
  const orientationSpecialtiesForCheckboxes: Specialite[] = [Specialite.NEUROLOGIE, Specialite.PSYCHIATRIE, Specialite.NEUROCHIRURGIE];


  const fetchSupportingDataForGPModal = useCallback(async () => {
    if (!isGP) return;
    try {
        const usersRes = await userService.getUsers({ limit: 1000 });
        setSpecialistDoctors(usersRes.data.filter(u => u.role === UserRole.MEDECIN_SPECIALISTE));

        const allConsultationsResponse = await consultationService.getConsultations({ limit: 99999 });
        const workload: Record<string, number> = {};
        allConsultationsResponse.data.forEach(consult => {
            if (consult.oriented_to_medecin_id) {
            workload[consult.oriented_to_medecin_id] = (workload[consult.oriented_to_medecin_id] || 0) + 1;
            }
        });
        setSpecialistWorkload(workload);
    } catch (error) {
        console.error("Failed to fetch supporting data for GP modal:", error);
    }
  }, [isGP]);

  const fetchReferralSourcesForSpecialist = useCallback(async (specialistConsultations: Consultation[]) => {
    if (!isSpecialist || specialistConsultations.length === 0 || !currentUser || !currentUser.specialite) return;
    setIsLoadingReferralSources(true);
    const newReferralSourceMap: Record<string, string | undefined> = {};
    try {
        const allPatientIds = Array.from(new Set(specialistConsultations.map(sc => sc.patient_id)));
        if (allPatientIds.length === 0) {
             setIsLoadingReferralSources(false);
             setReferralSourceMap({});
             return;
        }

        const patientConsultationsResponse = await consultationService.getConsultations({
            filterByPatientIds: allPatientIds,
            limit: 99999, 
        });
        const allRelevantConsultations = patientConsultationsResponse.data;

        for (const specConsult of specialistConsultations) {
            const patientConsults = allRelevantConsultations.filter(c => c.patient_id === specConsult.patient_id);
            
            const referringConsult = patientConsults
                .filter(c => 
                    c.type_consultation === ConsultationType.GENERALE &&
                    new Date(c.created_at) < new Date(specConsult.created_at) &&
                    (c.oriented_to_medecin_id === currentUser.id || 
                     (c.oriented_to_specialties?.includes(currentUser.specialite!) && !c.oriented_to_medecin_id))
                )
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

            if (referringConsult) {
                newReferralSourceMap[specConsult.id] = referringConsult.medecin_nom;
            }
        }
        setReferralSourceMap(newReferralSourceMap);
    } catch (error) {
        console.error("Failed to fetch referral sources for specialist:", error);
    } finally {
        setIsLoadingReferralSources(false);
    }
}, [isSpecialist, currentUser]);


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setExportMessage(null); 
    setImportMessage(null);

    if (isAccueil) {
      setIsLoadingAccueilFilterData(true);
      try {
        const patientParams: Parameters<typeof patientService.getPatients>[0] = {
          page: currentPage,
          limit: itemsPerPage,
          search: searchTerm,
          fetchReferredByAccueil: true, 
        };
        const result = await patientService.getPatients(patientParams);
        setReferredPatientsList(result.data);
        setTotalItems(result.total);
      } catch (error) {
        console.error("Failed to fetch referred patients for Accueil:", error);
        setReferredPatientsList([]);
        setTotalItems(0);
      } finally {
        setIsLoading(false);
        setIsLoadingAccueilFilterData(false);
      }
    } else if (isGP) {
      setIsLoadingGpData(true);
      await fetchSupportingDataForGPModal(); 
      try {
        const gpConsultationsResponse = await consultationService.getConsultations({
          medecinId: currentUser!.id,
          isOrientedToSpecialist: true, 
          limit: 100000, 
        });
        
        const patientIdsToFetch = Array.from(new Set(gpConsultationsResponse.data.map(c => c.patient_id)));
        const consultationMap: Record<string, string> = {};
        gpConsultationsResponse.data.forEach(c => {
            if (!consultationMap[c.patient_id]) { 
                consultationMap[c.patient_id] = c.id;
            }
        });
        setGpOrientationConsultationMap(consultationMap);

        if (patientIdsToFetch.length > 0) {
          const patientDetailsResponse = await patientService.getPatients({
            patientIds: patientIdsToFetch,
            page: currentPage,
            limit: itemsPerPage,
            search: searchTerm,
          });
          const patientsWithOrientationDate = patientDetailsResponse.data.map(p => {
            const originalConsultation = gpConsultationsResponse.data.find(c => c.patient_id === p.id);
            return {
              ...p,
              updated_at: originalConsultation ? originalConsultation.created_at : p.updated_at 
            };
          });
          setOrientedPatientsForGP(patientsWithOrientationDate);
          setTotalItems(patientDetailsResponse.total);
        } else {
          setOrientedPatientsForGP([]);
          setTotalItems(0);
        }
      } catch (error) {
        console.error("Failed to fetch GP's oriented patients:", error);
        setOrientedPatientsForGP([]);
        setTotalItems(0);
      } finally {
        setIsLoading(false);
        setIsLoadingGpData(false);
      }
    } else { 
      try {
        const params: Parameters<typeof consultationService.getConsultations>[0] = {
          page: currentPage,
          limit: itemsPerPage,
          search: searchTerm,
        };

        if (currentUser!.role === UserRole.MEDECIN_SPECIALISTE && !isAdmin) {
          params.medecinId = currentUser!.id;
        }
        
        const result = await consultationService.getConsultations(params);
        setConsultations(result.data);
        setTotalItems(result.total);
        if (isSpecialist) {
            await fetchReferralSourcesForSpecialist(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch consultations:", error);
        setConsultations([]);
        setTotalItems(0);
      } finally {
        setIsLoading(false);
      }
    }
  }, [currentPage, itemsPerPage, searchTerm, currentUser, isAdmin, isGP, isAccueil, isSpecialist, fetchSupportingDataForGPModal, fetchReferralSourcesForSpecialist]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); 
  };

  const handleDeleteConsultation = async (id: string) => { 
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette consultation ?")) {
      try {
        await consultationService.deleteConsultation(id);
        fetchData(); 
      } catch (error) {
        console.error("Failed to delete consultation:", error);
      }
    }
  };

  const openEditOrientationModal = async (patientId: string) => {
    setEditOrientationError(null);
    const consultationId = gpOrientationConsultationMap[patientId];
    if (!consultationId) {
      console.error("Consultation ID not found for patient ID:", patientId);
      setEditOrientationError("Impossible de trouver la consultation d'origine pour ce patient.");
      return;
    }
    setIsLoadingEditingConsultation(true);
    try {
      const consultationData = await consultationService.getConsultationById(consultationId);
      if (consultationData) {
        setEditingConsultation(consultationData);
        setIsEditOrientationModalOpen(true);
      } else {
        setEditOrientationError("Détails de la consultation non trouvés.");
      }
    } catch (error) {
      console.error("Failed to fetch consultation for edit:", error);
      setEditOrientationError("Erreur lors du chargement des détails de la consultation.");
    } finally {
      setIsLoadingEditingConsultation(false);
    }
  };

  const handleUpdateOrientation = async (updatedData: Partial<ConsultationFormData>, consultationId: string) => {
    setEditOrientationError(null);
    setIsSubmittingOrientation(true);
    try {
      await consultationService.updateConsultation(consultationId, updatedData);
      setIsEditOrientationModalOpen(false);
      setEditingConsultation(null);
      fetchData(); 
    } catch (error) {
      console.error("Failed to update orientation:", error);
      setEditOrientationError("Erreur lors de la mise à jour de l'orientation. Veuillez réessayer.");
    } finally {
      setIsSubmittingOrientation(false);
    }
  };

  const handleExportExcel = async () => {
    if (!isSpecialist && !isAdmin) return;
    setIsExporting(true);
    setExportMessage({ type: 'info', text: 'Exportation en cours...' });
    try {
      const params: Parameters<typeof consultationService.getConsultations>[0] = {
        search: searchTerm,
        limit: Number.MAX_SAFE_INTEGER,
        page: 1,
      };
      if (isSpecialist && !isAdmin) {
        params.medecinId = currentUser!.id;
      }

      const result = await consultationService.getConsultations(params);
      if (result.data.length === 0) {
        setExportMessage({ type: 'info', text: 'Aucune consultation à exporter avec les filtres actuels.' });
        setIsExporting(false);
        return;
      }
      
      const allPatientIds = Array.from(new Set(result.data.map(c => c.patient_id)));
      let patientsMap = new Map<string, Patient>();
      if (allPatientIds.length > 0) {
          const allPatientsResponse = await patientService.getPatients({ patientIds: allPatientIds, limit: allPatientIds.length });
          patientsMap = new Map(allPatientsResponse.data.map(p => [p.id, p]));
      }

      const consultationsToExport = result.data.map(consult => {
        const patientDetails = patientsMap.get(consult.patient_id);
        return {
          // Consultation fields
          "ID Consultation": consult.id,
          "Date Création Consultation": formatDateTime(consult.created_at),
          "Médecin Nom": consult.medecin_nom || 'N/A',
          "Médecin ID": consult.medecin_id,
          "Type Consultation": consult.type_consultation,
          "Spécialité Consultation": consult.specialite || 'N/A',
          "Statut Consultation": consult.statut,
          "Caravane Nom": consult.caravane_nom || 'N/A',
          "Caravane ID": consult.caravane_id,
          "Notes Cliniques": consult.notes || '',
          "Diagnostic": consult.diagnostic || '',
          "Orientation (Texte)": consult.orientation || '',
          "Orienté vers Spécialités": consult.oriented_to_specialties?.join(', ') || '',
          "Orienté vers Médecin Nom": consult.oriented_to_medecin_nom || '', 
          "Orienté vers Médecin ID": consult.oriented_to_medecin_id || '',
          "Scanner Effectué": consult.scanner_effectue ? 'Oui' : 'Non',
          "Orientation CHU": consult.orientation_chu ? 'Oui' : 'Non',
          "Suivi Nécessaire": consult.suivi_necessaire ? 'Oui' : 'Non',
          "Date Prochain RDV": consult.date_prochain_rdv ? formatDate(consult.date_prochain_rdv) : '',
          "Hors Champ Spécialité Caravane": consult.hors_champ_specialite_caravane ? 'Oui' : 'Non',
          "Date RDV Consultation": consult.date_rdv ? formatDate(consult.date_rdv) : '',
          
          // Patient fields
          "Patient N° Unique": patientDetails?.numero_unique || '',
          "Patient Prénom": patientDetails?.prenom || '',
          "Patient Nom": patientDetails?.nom || '',
          "Patient CIN": patientDetails?.cin || '',
          "Patient Adresse": patientDetails?.adresse || '',
          "Patient Âge": patientDetails?.age || '',
          "Patient Sexe": patientDetails?.sexe === PatientSexe.MASCULIN ? 'Masculin' : (patientDetails?.sexe === PatientSexe.FEMININ ? 'Féminin' : ''),
          "Patient Téléphone": patientDetails?.telephone || '',
          "Patient Email": patientDetails?.email || '',
          "Patient Date de Naissance": patientDetails?.date_naissance ? formatDate(patientDetails.date_naissance) : '',
          "Patient Antécédents Médicaux": patientDetails?.antecedents_medicaux || '',
          "Patient Date Création Dossier": patientDetails ? formatDateTime(patientDetails.created_at) : '',
          "Patient Orienté Généraliste (par Accueil)": patientDetails?.est_oriente_generaliste ? 'Oui' : 'Non',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(consultationsToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Consultations_Patients");
      XLSX.writeFile(workbook, `consultations_patients_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      setExportMessage({ type: 'success', text: 'Exportation réussie!' });
    } catch (error) {
      console.error("Failed to export consultations:", error);
      setExportMessage({ type: 'error', text: 'Erreur lors de l\'exportation des consultations.' });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportMessage(null), 5000); 
    }
  };
  
  const handleFileChangeForImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImportFile(event.target.files[0]);
      setImportMessage(null); // Clear previous messages
    }
  };

  const handleImportExcel = async () => {
    if (!importFile || !currentUser) {
      setImportMessage({ type: 'error', text: 'Veuillez sélectionner un fichier.' });
      return;
    }
    if (!isSpecialist && !isAdmin) return;

    setIsImporting(true);
    setImportMessage({ type: 'info', text: 'Traitement du fichier Excel...' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json<any>(worksheet);

        let successCount = 0;
        let errorCount = 0;
        const errorDetails: string[] = [];

        for (const row of jsonRows) {
          try {
            const patientCIN = row["Patient CIN"]?.toString().trim();
            const caravaneNumUnique = row["Caravane Numero Unique"]?.toString().trim();

            if (!patientCIN) {
                errorCount++;
                errorDetails.push(`Ligne sautée: Patient CIN manquant.`);
                continue;
            }
             if (!caravaneNumUnique && (isSpecialist && !isAdmin)) { // Caravane is mandatory for specialist import context
                errorCount++;
                errorDetails.push(`Ligne sautée pour CIN ${patientCIN}: Caravane Numero Unique manquant.`);
                continue;
            }


            // Prepare Patient Data from Excel
            const patientFormDataFromExcel: PatientFormData = {
                prenom: row["Patient Prénom"]?.toString().trim(),
                nom: row["Patient Nom"]?.toString().trim(),
                adresse: row["Patient Adresse"]?.toString().trim() || '',
                age: row["Patient Âge"]?.toString(),
                sexe: row["Patient Sexe"]?.toString().toLowerCase().startsWith('m') ? PatientSexe.MASCULIN : PatientSexe.FEMININ,
                telephone: row["Patient Téléphone"]?.toString().trim() || undefined,
                email: row["Patient Email"]?.toString().trim() || undefined,
                date_naissance: row["Patient Date de Naissance"] ? (row["Patient Date de Naissance"] instanceof Date ? row["Patient Date de Naissance"].toISOString().split('T')[0] : row["Patient Date de Naissance"].toString()) : undefined,
                antecedents_medicaux: row["Patient Antécédents Médicaux"]?.toString().trim() || undefined,
                est_oriente_generaliste: row["Patient Orienté Généraliste (par Accueil)"]?.toString().toLowerCase() === 'oui' || false,
            };

            let patientIdForConsultation: string | null = null;
            const patientsByCinResponse = await patientService.getPatients({ search: patientCIN, limit: 1 });
            const existingPatient = patientsByCinResponse.data.length > 0 ? patientsByCinResponse.data[0] : null;

            if (existingPatient) {
                const patientValidationErrors = validatePatientForm(patientFormDataFromExcel);
                if (Object.keys(patientValidationErrors).length === 0) {
                    const updatedPatient = await patientService.updatePatient(existingPatient.id, patientFormDataFromExcel);
                    if (updatedPatient) patientIdForConsultation = updatedPatient.id;
                    else { errorDetails.push(`Erreur MàJ patient CIN ${patientCIN}.`); errorCount++; continue; }
                } else {
                    errorDetails.push(`Validation patient CIN ${patientCIN}: ${Object.values(patientValidationErrors).join(', ')}`); errorCount++; continue;
                }
            } else {
                const newPatientData = { ...patientFormDataFromExcel, cin: patientCIN };
                const patientValidationErrors = validatePatientForm(newPatientData);
                 if (Object.keys(patientValidationErrors).length === 0) {
                    const newPatient = await patientService.addPatient(newPatientData);
                    patientIdForConsultation = newPatient.id;
                } else {
                    errorDetails.push(`Validation nouveau patient CIN ${patientCIN}: ${Object.values(patientValidationErrors).join(', ')}`); errorCount++; continue;
                }
            }
            
            if (!patientIdForConsultation) { 
                errorDetails.push(`ID Patient non obtenu pour CIN ${patientCIN}.`); errorCount++; continue; 
            }

            let caravane: Caravane | null = null;
            if (caravaneNumUnique) {
                const caravanesByNum = await caravaneService.getCaravanes({ search: caravaneNumUnique, limit: 1 });
                caravane = caravanesByNum.data.length > 0 ? caravanesByNum.data[0] : null;
                if (!caravane) {
                    errorDetails.push(`Caravane N° ${caravaneNumUnique} non trouvée pour patient CIN ${patientCIN}.`); errorCount++; continue;
                }
            } else if (isAdmin && !row["Caravane ID"]) { // Admin might not provide num unique but ID
                 const adminCaravaneId = row["Caravane ID"]?.toString().trim();
                 if (adminCaravaneId) {
                    caravane = await caravaneService.getCaravaneById(adminCaravaneId);
                 }
                 if (!caravane) {
                     errorDetails.push(`Caravane ID ${adminCaravaneId || 'non fourni'} non trouvée pour patient CIN ${patientCIN}.`); errorCount++; continue;
                 }
            } else if (isAdmin && !caravaneNumUnique && !row["Caravane ID"]){
                 errorDetails.push(`Ni Caravane Numero Unique ni Caravane ID fournis (Admin) pour patient CIN ${patientCIN}.`); errorCount++; continue;
            }


            const consultationData: ConsultationFormData = {
                patient_id: patientIdForConsultation,
                caravane_id: caravane!.id, // caravane must be found by now for specialist, or handled for admin
                medecin_id: (isSpecialist && !isAdmin) ? currentUser.id : row["Médecin ID"]?.toString().trim() || currentUser.id,
                type_consultation: (isSpecialist && !isAdmin) ? ConsultationType.SPECIALISEE : (row["Type Consultation"] as ConsultationType || ConsultationType.GENERALE),
                specialite: (isSpecialist && !isAdmin) ? currentUser.specialite : (row["Spécialité Consultation"] as Specialite || undefined),
                notes: (isSpecialist && !isAdmin) ? "" : (row["Notes Cliniques"]?.toString() || ""), 
                diagnostic: row["Diagnostic"]?.toString().trim() || undefined,
                orientation: (isSpecialist && !isAdmin) ? undefined : (row["Orientation (Texte)"]?.toString().trim() || undefined),
                oriented_to_medecin_id: (isSpecialist && !isAdmin) ? undefined : (row["Orienté vers Médecin ID"]?.toString().trim() || undefined),
                oriented_to_specialties: (isSpecialist && !isAdmin) ? [] : (row["Orienté vers Spécialités"]?.toString().split(',').map((s:string) => s.trim()).filter(Boolean) as Specialite[] || []),
                hors_champ_specialite_caravane: (isSpecialist && !isAdmin) ? false : (row["Hors Champ Spécialité Caravane"]?.toString().toLowerCase() === 'oui'),
                scanner_effectue: row["Scanner Effectué"]?.toString().toLowerCase() === 'oui',
                orientation_chu: row["Orientation CHU"]?.toString().toLowerCase() === 'oui',
                suivi_necessaire: row["Suivi Nécessaire"]?.toString().toLowerCase() === 'oui',
                statut: (isSpecialist && !isAdmin) ? ConsultationStatut.EN_COURS : (row["Statut Consultation"] as ConsultationStatut || ConsultationStatut.EN_COURS),
                date_rdv: (isSpecialist && !isAdmin) ? new Date().toISOString().split('T')[0] : (row["Date RDV Consultation"] ? (row["Date RDV Consultation"] instanceof Date ? row["Date RDV Consultation"].toISOString().split('T')[0] : row["Date RDV Consultation"].toString()) : new Date().toISOString().split('T')[0]),
                date_prochain_rdv: row["Date Prochain RDV"] ? (row["Date Prochain RDV"] instanceof Date ? row["Date Prochain RDV"].toISOString().split('T')[0] : row["Date Prochain RDV"].toString()) : undefined,
            };
            
            const consultationValidationErrors = validateConsultationForm(consultationData, false, isSpecialist && !isAdmin);
            if (Object.keys(consultationValidationErrors).length === 0) {
                await consultationService.addConsultation(consultationData);
                successCount++;
            } else {
                errorCount++;
                errorDetails.push(`Validation consult. CIN ${patientCIN}: ${Object.values(consultationValidationErrors).join(', ')}`);
            }
          } catch (processRowError: any) {
            errorCount++;
            errorDetails.push(`Erreur ligne (CIN: ${row["Patient CIN"] || 'N/A'}): ${processRowError.message || 'Inconnue'}`);
          }
        }
        setImportMessage({
          type: successCount > 0 && errorCount === 0 ? 'success' : (errorCount > 0 ? 'error' : 'info'),
          text: `Importation terminée. ${successCount} consultations traitées. ${errorCount} erreurs.`,
          details: errorDetails.length > 0 ? errorDetails : undefined
        });
        fetchData(); 
      } catch (err) {
        console.error("Error processing Excel file:", err);
        setImportMessage({ type: 'error', text: 'Erreur lors du traitement du fichier Excel.' });
      } finally {
        setIsImporting(false);
        setImportFile(null);
      }
    };
    reader.readAsBinaryString(importFile);
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  let pageTitle = `Gestion des Consultations (${roleName})`;
  if (isGP) {
      pageTitle = "Mes Patients Orientés vers Spécialistes";
  } else if (isAccueil) {
      pageTitle = "Patients Orientés vers Généraliste par l'Accueil";
  } else if (isSpecialist) {
      pageTitle = `Mes Consultations (${currentUser?.specialite || 'Spécialiste'})`;
  }


  const overallLoading = isLoading || (isAccueil && isLoadingAccueilFilterData) || (isGP && isLoadingGpData) || (isSpecialist && isLoadingReferralSources);
  const noItemsFound = (isAccueil && referredPatientsList.length === 0) || 
                       (isGP && orientedPatientsForGP.length === 0) || 
                       (!isAccueil && !isGP && consultations.length === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-semibold text-gray-800">{pageTitle}</h2>
        <div className="flex gap-2 flex-wrap">
            {(isAdmin || isSpecialist) && (
              <>
                <button
                    onClick={() => setIsImportModalOpen(true)}
                    disabled={isImporting || isLoading}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg shadow-md hover:bg-teal-700 transition duration-150 ease-in-out flex items-center"
                >
                    <i className={`fas ${isImporting ? 'fa-spinner fa-spin' : 'fa-file-import'} mr-2`}></i> 
                    {isImporting ? 'Importation...' : 'Importer Excel'}
                </button>
                <button
                    onClick={handleExportExcel}
                    disabled={isExporting || isLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-150 ease-in-out flex items-center"
                >
                    <i className={`fas ${isExporting ? 'fa-spinner fa-spin' : 'fa-file-export'} mr-2`}></i> 
                    {isExporting ? 'Exportation...' : 'Exporter Excel'}
                </button>
              </>
            )}
            {canAddConsultationPermission && !isAccueil && !isGP && ( 
                <Link
                to="/consultations/new"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ease-in-out flex items-center"
                >
                <i className="fas fa-file-medical mr-2"></i> Nouvelle Consultation
                </Link>
            )}
        </div>
      </div>
      
      {exportMessage && !isImportModalOpen && ( 
            <div className={`p-3 my-2 rounded-md text-sm ${
                exportMessage.type === 'success' ? 'bg-green-100 text-green-700' :
                exportMessage.type === 'error' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
            }`}>
                {exportMessage.text}
            </div>
      )}
      {importMessage && !isImportModalOpen && ( 
            <div className={`p-3 my-2 rounded-md text-sm ${
                importMessage.type === 'success' ? 'bg-green-100 text-green-700' :
                importMessage.type === 'error' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
            }`}>
                {importMessage.text}
                {importMessage.details && importMessage.details.length > 0 && (
                    <ul className="list-disc list-inside mt-2 text-xs max-h-40 overflow-y-auto">
                        {importMessage.details.slice(0, 10).map((detail, index) => <li key={index}>{detail}</li>)}
                        {importMessage.details.length > 10 && <li>Et {importMessage.details.length - 10} autres erreurs...</li>}
                    </ul>
                )}
            </div>
      )}


      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
        <div className="mb-4">
            <input 
                type="text"
                placeholder={isAccueil || isGP ? "Rechercher par nom, CIN du patient..." : "Rechercher par patient, médecin, notes..."}
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full md:w-1/2 lg:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
        </div>
        {editOrientationError && (
            <div className="my-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm">
                {editOrientationError}
            </div>
        )}
        {overallLoading && noItemsFound ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner 
                message={isLoadingAccueilFilterData ? "Recherche des patients orientés..." : 
                         isLoadingGpData ? "Chargement des patients orientés..." : 
                         (isSpecialist && isLoadingReferralSources) ? "Chargement des consultations et références..." :
                         "Chargement..."} 
                size="lg" 
            />
          </div>
        ) : !isLoading && noItemsFound && searchTerm ? (
           <div className="text-center py-10">
            <i className="fas fa-search fa-3x text-gray-400 mb-4"></i>
            <p className="text-gray-600 text-lg">
              {(isAccueil || isGP) ? "Aucun patient trouvé pour " : "Aucune consultation trouvée pour "} "{searchTerm}".
            </p>
          </div>
        ) : !isLoading && noItemsFound ? (
          <div className="text-center py-10">
            <i className="fas fa-folder-open fa-3x text-gray-400 mb-4"></i>
            <p className="text-gray-600 text-lg">
              {isGP ? "Aucun patient orienté vers un spécialiste pour le moment." : 
               isAccueil ? "Aucun patient orienté vers un généraliste par l'accueil pour le moment." :
               isSpecialist ? "Aucune consultation enregistrée pour vous pour le moment." :
               "Aucune consultation enregistrée pour le moment."
              }
            </p>
            {canAddConsultationPermission && !isAccueil && !isGP && <p className="text-gray-500 text-sm">Cliquez sur "Nouvelle Consultation" pour commencer.</p>}
            {isAccueil && <p className="text-gray-500 text-sm">Les patients que vous orientez vers un généraliste apparaîtront ici.</p>}
             {isGP && <p className="text-gray-500 text-sm">Les patients que vous avez orientés vers des spécialistes apparaîtront ici.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {(isAccueil || isGP) ? ( 
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Unique</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom Complet</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CIN</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Âge</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sexe</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {isGP ? "Date Orientation (Consult.)" : "Date de Réf. (Accueil)"}
                    </th>
                    <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                ) : ( 
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Médecin</th>
                    {isSpecialist && (<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Référé par</th>)}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type / Spécialité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Caravane</th>
                    <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                )}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isAccueil ? (
                  referredPatientsList.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.numero_unique}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                         <Link to={`/patients/${patient.id}`} className="hover:text-indigo-600">{patient.prenom} {patient.nom}</Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.cin}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.age}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.sexe === PatientSexe.MASCULIN ? 'Masculin' : 'Féminin'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(patient.updated_at)}</td> 
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link to={`/patients/${patient.id}`} className="text-blue-600 hover:text-blue-800" title="Voir Détails Patient">
                          <i className="fas fa-eye"></i>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : isGP ? (
                    orientedPatientsForGP.map((patient) => (
                        <tr key={patient.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.numero_unique}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                             <Link to={`/patients/${patient.id}`} className="hover:text-indigo-600">{patient.prenom} {patient.nom}</Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.cin}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.age}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.sexe === PatientSexe.MASCULIN ? 'Masculin' : 'Féminin'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(patient.updated_at)}</td> 
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <Link to={`/patients/${patient.id}`} className="text-blue-600 hover:text-blue-800" title="Voir Détails Patient">
                              <i className="fas fa-eye"></i>
                            </Link>
                            {canEditConsultationPermission && gpOrientationConsultationMap[patient.id] && (
                                <button 
                                    onClick={() => openEditOrientationModal(patient.id)} 
                                    className="text-yellow-500 hover:text-yellow-700" 
                                    title="Modifier Orientation"
                                    disabled={isLoadingEditingConsultation}
                                >
                                    <i className="fas fa-edit"></i>
                                </button>
                            )}
                          </td>
                        </tr>
                    ))
                ) : ( 
                  consultations.map((consult) => (
                    <tr key={consult.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(consult.created_at)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <Link to={`/patients/${consult.patient_id}`} className="hover:text-indigo-600">{consult.patient_nom || 'N/A'}</Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{consult.medecin_nom || 'N/A'}</td>
                      {isSpecialist && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                           {isLoadingReferralSources ? <LoadingSpinner size="sm"/> : (referralSourceMap[consult.id] || 'N/A')}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {consult.type_consultation === ConsultationType.SPECIALISEE ? consult.specialite : consult.type_consultation.charAt(0).toUpperCase() + consult.type_consultation.slice(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                         <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            consult.statut === ConsultationStatut.TERMINEE ? 'bg-green-100 text-green-800' :
                            consult.statut === ConsultationStatut.EN_COURS ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                         }`}>
                          {consult.statut.charAt(0).toUpperCase() + consult.statut.slice(1).replace('_', ' ')}
                         </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{consult.caravane_nom || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <Link to={`/consultations/edit/${consult.id}`} className="text-blue-600 hover:text-blue-800" title="Voir/Modifier Détails Consultation">
                          <i className="fas fa-eye"></i>
                        </Link>
                        {(isAdmin || (currentUser!.role === UserRole.MEDECIN_SPECIALISTE && canEditConsultationPermission) || (currentUser!.role === UserRole.ACCUEIL && canEditConsultationPermission)) && (
                            <Link to={`/consultations/edit/${consult.id}`} className="text-yellow-500 hover:text-yellow-700" title="Modifier Consultation">
                                <i className="fas fa-edit"></i>
                            </Link>
                        )}
                        {isAdmin && ( 
                          <button onClick={() => handleDeleteConsultation(consult.id)} className="text-red-600 hover:text-red-800" title="Supprimer">
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
         {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {isEditOrientationModalOpen && editingConsultation && isGP && (
        <Modal
          isOpen={isEditOrientationModalOpen}
          onClose={() => {
            setIsEditOrientationModalOpen(false);
            setEditingConsultation(null);
            setEditOrientationError(null);
          }}
          title={`Modifier Orientation pour ${editingConsultation.patient_nom}`}
          size="lg"
        >
          <OrientationEditForm
            initialData={editingConsultation}
            onSubmit={handleUpdateOrientation}
            onCancel={() => {
              setIsEditOrientationModalOpen(false);
              setEditingConsultation(null);
              setEditOrientationError(null);
            }}
            isLoading={isSubmittingOrientation}
            specialistDoctors={specialistDoctors}
            specialistWorkload={specialistWorkload}
            orientationSpecialtiesForCheckboxes={orientationSpecialtiesForCheckboxes}
            errorMessage={editOrientationError}
          />
        </Modal>
      )}

      {(isAdmin || isSpecialist) && isImportModalOpen && (
        <Modal
            isOpen={isImportModalOpen}
            onClose={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
                setImportMessage(null);
            }}
            title="Importer des Consultations et Patients depuis Excel"
            size="xl" 
        >
            <div className="space-y-4">
                <p className="text-sm text-gray-600">
                    Sélectionnez un fichier Excel (.xlsx, .xls). Le fichier doit contenir les informations patient et consultation.
                    <strong className="block mt-1">Colonnes Patient (Obligatoire pour identifier/créer/mettre à jour le patient):</strong>
                    <ul className="list-disc list-inside ml-4 my-1 text-xs">
                        <li><code>Patient CIN</code> (Clé primaire)</li>
                        <li><code>Patient Prénom</code>, <code>Patient Nom</code>, <code>Patient Adresse</code>, <code>Patient Âge</code>, <code>Patient Sexe</code> (Masculin/Féminin)</li>
                        <li><code>Patient Téléphone</code>, <code>Patient Email</code>, <code>Patient Date de Naissance</code> (AAAA-MM-JJ)</li>
                        <li><code>Patient Antécédents Médicaux</code>, <code>Patient Orienté Généraliste (par Accueil)</code> (Oui/Non)</li>
                    </ul>
                    <strong className="block mt-1">Colonnes Consultation (Obligatoire pour créer la consultation):</strong>
                    <ul className="list-disc list-inside ml-4 my-1 text-xs">
                         <li><code>Caravane Numero Unique</code> (Pour lier à une caravane existante)</li>
                         {(isSpecialist && !isAdmin) ? (
                            <>
                                <li><code>Diagnostic</code></li>
                                <li><code>Scanner Effectue</code> (Oui/Non)</li>
                                <li><code>Orientation CHU</code> (Oui/Non)</li>
                                <li><code>Suivi Necessaire</code> (Oui/Non)</li>
                                <li><code>Date Prochain RDV</code> (Requis si Suivi Necessaire est Oui, format AAAA-MM-JJ)</li>
                                <li><code>Date RDV Consultation</code> (Optionnel, format AAAA-MM-JJ, défaut: aujourd'hui)</li>
                            </>
                         ) : (
                            <>
                                <li><code>Médecin ID</code> (Requis si Admin importe pour un autre médecin)</li>
                                <li><code>Type Consultation</code> (generale/specialisee)</li>
                                <li><code>Spécialité Consultation</code> (Si type specialisee)</li>
                                <li><code>Statut Consultation</code> (en_attente, en_cours, terminee)</li>
                                <li><code>Notes Cliniques</code>, <code>Diagnostic</code>, <code>Orientation (Texte)</code>, etc.</li>
                            </>
                         )}
                    </ul>
                     Les champs non fournis ou non applicables au contexte (Spécialiste vs Admin) utiliseront des valeurs par défaut ou seront ignorés.
                </p>
                <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChangeForImport}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {importFile && <p className="text-sm text-gray-500">Fichier sélectionné: {importFile.name}</p>}
                
                {importMessage && (
                    <div className={`p-3 rounded-md text-sm ${
                        importMessage.type === 'success' ? 'bg-green-100 text-green-700' :
                        importMessage.type === 'error' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                    }`}>
                        {importMessage.text}
                        {importMessage.details && importMessage.details.length > 0 && (
                            <ul className="list-disc list-inside mt-2 text-xs max-h-32 overflow-y-auto">
                                {importMessage.details.slice(0,10).map((detail, index) => <li key={index}>{detail}</li>)}
                                {importMessage.details.length > 10 && <li>Et {importMessage.details.length - 10} autres erreurs...</li>}
                            </ul>
                        )}
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-2">
                    <button
                        type="button"
                        onClick={() => {
                            setIsImportModalOpen(false);
                            setImportFile(null);
                            setImportMessage(null);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                        disabled={isImporting}
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleImportExcel}
                        disabled={!importFile || isImporting}
                        className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md shadow-sm hover:bg-teal-700 disabled:opacity-50 flex items-center"
                    >
                        {isImporting ? <LoadingSpinner size="sm" /> : <i className="fas fa-check mr-2"></i>}
                        Importer
                    </button>
                </div>
            </div>
        </Modal>
      )}

    </div>
  );
};

export default ConsultationsPage;
