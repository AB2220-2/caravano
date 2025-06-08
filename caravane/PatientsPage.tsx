
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import PatientListItem from '../components/patients/PatientListItem';
import PatientForm from '../components/patients/PatientForm';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Patient, PatientFormData, UserRole, Consultation, PatientSexe, Specialite } from '../types';
import patientService from '../services/patientService';
import consultationService from '../services/consultationService';
import { DEFAULT_ITEMS_PER_PAGE } from '../constants';
import Pagination from '../components/common/Pagination';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/helpers';
import { validatePatientForm } from '../utils/validators';


const PatientsPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPatients, setTotalPatients] = useState(0);

  const [patientIdsToExcludeForAccueil, setPatientIdsToExcludeForAccueil] = useState<string[] | undefined>(undefined);
  const [isLoadingAccueilExclusionData, setIsLoadingAccueilExclusionData] = useState(false);

  // For GP: list of patient IDs for whom this GP has ALREADY created a consultation.
  // These patients should NOT appear in the "Patients Référés (Accueil)" list for this GP.
  const [gpConsultedPatientIdsToExclude, setGpConsultedPatientIdsToExclude] = useState<string[] | undefined>(undefined);
  const [isLoadingGpData, setIsLoadingGpData] = useState(false);
  
  const [specialistRelevantPatientIds, setSpecialistRelevantPatientIds] = useState<string[] | undefined>(undefined);
  const [isLoadingSpecialistData, setIsLoadingSpecialistData] = useState(false);

  // Excel Import/Export State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error' | 'info', text: string, details?: string[] } | null>(null);


  const itemsPerPage = DEFAULT_ITEMS_PER_PAGE;
  const isAdmin = currentUser!.role === UserRole.ADMIN;
  const isGP = currentUser!.role === UserRole.MEDECIN_GENERALISTE;
  const isAccueil = currentUser!.role === UserRole.ACCUEIL;
  const isSpecialist = currentUser!.role === UserRole.MEDECIN_SPECIALISTE;

  const canAddPatientByRole = (isAdmin && hasPermission('add_patients')) ||
                        (isAccueil && hasPermission('add_patients'));

  const canEditPatientDemographicsByRole =
    (isAdmin && hasPermission('manage_patients_full')) ||
    (isAccueil && hasPermission('manage_patients_accueil'));

  // const gpCanEditOrientationPermission = isGP && hasPermission('edit_patients_gp'); // This permission checked on ConsultationsPage for editing
  const gpCanStartConsultationPermission = isGP && hasPermission('add_consultations');


  const canDeletePatientByRole = isAdmin && hasPermission('manage_patients_full');
  const canViewPatientDetailsByRole = true;

  const fetchInitialDataForFilters = useCallback(async () => {
    if (isAccueil) {
      setIsLoadingAccueilExclusionData(true);
      try {
        const allConsultationsResponse = await consultationService.getConsultations({ limit: 100000 });
        const idsToExclude = Array.from(new Set(allConsultationsResponse.data.map(c => c.patient_id)));
        setPatientIdsToExcludeForAccueil(idsToExclude);
      } catch (error) {
        console.error("Failed to fetch consultation patient IDs for Accueil exclusion:", error);
        setPatientIdsToExcludeForAccueil([]);
      } finally {
        setIsLoadingAccueilExclusionData(false);
      }
    } else if (isGP && currentUser) {
      setIsLoadingGpData(true);
      try {
        // Fetch ALL consultations by this GP to exclude patients they've already started working on.
        const gpConsultationsResponse = await consultationService.getConsultations({
            medecinId: currentUser.id,
            limit: 100000 
        });
        const consultedPatientIds = Array.from(new Set(
          gpConsultationsResponse.data.map(c => c.patient_id)
        ));
        setGpConsultedPatientIdsToExclude(consultedPatientIds);

      } catch (error) {
        console.error("Failed to fetch GP's consulted patient data for exclusion:", error);
        setGpConsultedPatientIdsToExclude([]);
      } finally {
        setIsLoadingGpData(false);
      }
    } else if (isSpecialist && currentUser && currentUser.specialite) {
      setIsLoadingSpecialistData(true);
      try {
        const allConsultationsResponse = await consultationService.getConsultations({ limit: 100000 });
        const specialistSpecialty = currentUser.specialite as Specialite;
        
        const relevantConsultations = allConsultationsResponse.data.filter(c => {
            const isDirectlyAssigned = c.oriented_to_medecin_id === currentUser.id;
            const isAssignedToSpecialtyGenerally = 
                c.oriented_to_specialties && 
                c.oriented_to_specialties.includes(specialistSpecialty) && 
                !c.oriented_to_medecin_id;
            return isDirectlyAssigned || isAssignedToSpecialtyGenerally;
        });
        const ids = Array.from(new Set(relevantConsultations.map(c => c.patient_id)));
        setSpecialistRelevantPatientIds(ids);

      } catch (error) {
        console.error("Failed to fetch specialist relevant patient IDs:", error);
        setSpecialistRelevantPatientIds([]);
      } finally {
        setIsLoadingSpecialistData(false);
      }
    }
  }, [isAccueil, isGP, isSpecialist, currentUser]);

  useEffect(() => {
    fetchInitialDataForFilters();
  }, [fetchInitialDataForFilters]);

  const fetchPatients = useCallback(async () => {
    if (isAccueil && patientIdsToExcludeForAccueil === undefined && !isLoadingAccueilExclusionData) return;
    if (isGP && gpConsultedPatientIdsToExclude === undefined && !isLoadingGpData) return;
    if (isSpecialist && specialistRelevantPatientIds === undefined && !isLoadingSpecialistData) return;

    setIsLoading(true);

    try {
      const params: Parameters<typeof patientService.getPatients>[0] = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
      };

      if (isGP) {
        params.fetchReferredByAccueil = true;
        // Pass the list of patient IDs for whom this GP has ALREADY created a consultation.
        // patientService will filter these out from the `est_oriente_generaliste=true` list.
        params.excludePatientIds = gpConsultedPatientIdsToExclude;
      } else if (isAccueil) {
        params.excludePatientIds = patientIdsToExcludeForAccueil;
        params.forAccueilPatientList = true;
      } else if (isSpecialist) {
        if (specialistRelevantPatientIds && specialistRelevantPatientIds.length === 0) {
          // If specialistRelevantPatientIds is an empty array, it means no patients are relevant.
          // Fetching with an empty patientIds array might return all patients, so we handle it here.
          setPatients([]);
          setTotalPatients(0);
          setIsLoading(false);
          return;
        }
        params.patientIds = specialistRelevantPatientIds;
      }

      const result = await patientService.getPatients(params);
      
      setPatients(result.data);
      setTotalPatients(result.total);
    } catch (error) {
      console.error("Failed to fetch patients:", error);
      setPatients([]);
      setTotalPatients(0);
    } finally {
      setIsLoading(false);
    }
  }, [
      currentPage, itemsPerPage, searchTerm, 
      isGP, isAccueil, isSpecialist,
      patientIdsToExcludeForAccueil, isLoadingAccueilExclusionData, 
      gpConsultedPatientIdsToExclude, isLoadingGpData,
      specialistRelevantPatientIds, isLoadingSpecialistData,
      isSubmitting // ensure re-fetch after submission if it affects filters
    ]);

  useEffect(() => {
    // Trigger fetchPatients if the necessary exclusion/inclusion lists are loaded or if not applicable
    if ((isAccueil && patientIdsToExcludeForAccueil !== undefined) ||
        (isGP && gpConsultedPatientIdsToExclude !== undefined) || 
        (isSpecialist && specialistRelevantPatientIds !== undefined) ||
        (!isAccueil && !isGP && !isSpecialist)) { // For Admin or if no specific role context applies
      fetchPatients();
    }
  }, [
      currentPage, searchTerm, 
      isAccueil, patientIdsToExcludeForAccueil, 
      isGP, gpConsultedPatientIdsToExclude, 
      isSpecialist, specialistRelevantPatientIds,
      fetchPatients // fetchPatients itself has dependencies, this ensures it's called when its inputs are ready
    ]);

  const openEditModal = useCallback((patient: Patient) => {
    if (!canEditPatientDemographicsByRole) return;
    setEditingPatient(patient);
    setIsModalOpen(true);
  }, [canEditPatientDemographicsByRole]);

  useEffect(() => {
    const routeState = location.state as { action?: string, patientId?: string } | null;
    if (routeState?.action === 'edit' && routeState?.patientId && canEditPatientDemographicsByRole) {
      setIsLoading(true);
      patientService.getPatientById(routeState.patientId)
        .then(patientToEdit => {
          if (patientToEdit) {
            openEditModal(patientToEdit);
          } else {
            console.error("Patient to edit not found:", routeState.patientId);
          }
        })
        .catch(error => {
          console.error("Error fetching patient for edit:", error);
        })
        .finally(() => {
          setIsLoading(false);
          navigate(location.pathname, { replace: true, state: null });
        });
    }
  }, [location.state, navigate, openEditModal, canEditPatientDemographicsByRole]);


  const handleFormSubmit = async (patientData: PatientFormData, id?: string) => {
    setIsSubmitting(true);
    try {
      if (id) {
        await patientService.updatePatient(id, patientData);
      } else {
        await patientService.addPatient(patientData);
      }
      setIsModalOpen(false);
      setEditingPatient(null);
      await fetchInitialDataForFilters(); // Re-fetch filter data first
      // fetchPatients will be triggered by state changes from fetchInitialDataForFilters
    } catch (error) {
      console.error("Failed to save patient:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePatient = async (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce patient ?")) {
      setIsSubmitting(true); // Use isSubmitting to prevent concurrent fetches
      try {
        await patientService.deletePatient(id);
        await fetchInitialDataForFilters(); // Re-fetch filter data first
         // fetchPatients will be triggered by state changes from fetchInitialDataForFilters
      } catch (error) {
        console.error("Failed to delete patient:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const openAddModal = () => {
    setEditingPatient(null);
    setIsModalOpen(true);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleExportExcel = async () => {
    setIsLoading(true);
    try {
      // Fetch all patients matching the current search term for export
      const result = await patientService.getPatients({ search: searchTerm, limit: Number.MAX_SAFE_INTEGER, page: 1 });
      const patientsToExport = result.data.map(p => ({
        "N° Unique": p.numero_unique,
        "Prénom": p.prenom,
        "Nom": p.nom,
        "CIN": p.cin,
        "Adresse": p.adresse,
        "Âge": p.age,
        "Sexe": p.sexe === PatientSexe.MASCULIN ? 'Masculin' : 'Féminin',
        "Téléphone": p.telephone || '',
        "Email": p.email || '',
        "Date de Naissance": p.date_naissance ? formatDate(p.date_naissance) : '',
        "Antécédents Médicaux": p.antecedents_medicaux || '',
        "Date Création": formatDate(p.created_at),
        "Orienté Généraliste": p.est_oriente_generaliste ? 'Oui' : 'Non',
      }));

      const worksheet = XLSX.utils.json_to_sheet(patientsToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Patients");
      XLSX.writeFile(workbook, "patients_export.xlsx");
      setImportMessage({ type: 'success', text: 'Exportation réussie!' });
    } catch (error) {
      console.error("Failed to export patients:", error);
      setImportMessage({ type: 'error', text: 'Erreur lors de l\'exportation des patients.' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setImportMessage(null), 3000);
    }
  };

  const handleFileChangeForImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImportFile(event.target.files[0]);
      setImportMessage(null);
    }
  };

  const handleImportExcel = async () => {
    if (!importFile) {
      setImportMessage({ type: 'error', text: 'Veuillez sélectionner un fichier.' });
      return;
    }
    setIsImporting(true);
    setImportMessage({ type: 'info', text: 'Importation en cours...' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonPatients = XLSX.utils.sheet_to_json<any>(worksheet);

        let successCount = 0;
        let errorCount = 0;
        const errorDetails: string[] = [];

        for (const row of jsonPatients) {
          const patientData: PatientFormData = {
            prenom: row["Prénom"]?.toString().trim(),
            nom: row["Nom"]?.toString().trim(),
            cin: row["CIN"]?.toString().trim(),
            adresse: row["Adresse"]?.toString().trim(),
            age: row["Âge"]?.toString(),
            sexe: row["Sexe"]?.toString().toLowerCase() === 'masculin' || row["Sexe"]?.toString().toLowerCase() === 'm' ? PatientSexe.MASCULIN : PatientSexe.FEMININ,
            telephone: row["Téléphone"]?.toString().trim() || undefined,
            email: row["Email"]?.toString().trim() || undefined,
            date_naissance: row["Date de Naissance"] ? (row["Date de Naissance"] instanceof Date ? row["Date de Naissance"].toISOString().split('T')[0] : row["Date de Naissance"].toString()) : undefined,
            antecedents_medicaux: row["Antécédents Médicaux"]?.toString().trim() || undefined,
            est_oriente_generaliste: row["Orienté Généraliste"]?.toString().toLowerCase() === 'oui' || row["Orienté Généraliste"] === true,
          };
          
          const validationErrors = validatePatientForm(patientData);
          if (Object.keys(validationErrors).length === 0) {
            try {
              await patientService.addPatient(patientData);
              successCount++;
            } catch (addError: any) {
              errorCount++;
              errorDetails.push(`Erreur pour ${patientData.prenom} ${patientData.nom}: ${addError.message || 'Inconnue'}`);
            }
          } else {
            errorCount++;
            const errorsString = Object.values(validationErrors).join(', ');
            errorDetails.push(`Validation échouée pour ${patientData.prenom || 'N/A'} ${patientData.nom || 'N/A'}: ${errorsString}`);
          }
        }
        setImportMessage({
          type: successCount > 0 && errorCount === 0 ? 'success' : (errorCount > 0 ? 'error' : 'info'),
          text: `Importation terminée. ${successCount} patients ajoutés. ${errorCount} erreurs.`,
          details: errorDetails.length > 0 ? errorDetails : undefined
        });
        await fetchInitialDataForFilters(); // Refresh list after import
        // fetchPatients(); // This will be triggered by state changes

      } catch (err) {
        console.error("Error processing Excel file:", err);
        setImportMessage({ type: 'error', text: 'Erreur lors du traitement du fichier Excel.' });
      } finally {
        setIsImporting(false);
        setImportFile(null); 
        // Do not close modal immediately, let user see the message
      }
    };
    reader.readAsBinaryString(importFile);
  };


  const totalPages = Math.ceil(totalPatients / itemsPerPage);

  let pageTitle = "Gestion des Patients";
  let pageDescription = "Liste de tous les patients enregistrés.";
  if (isGP) {
    pageTitle = "Patients Référés (Accueil)";
    pageDescription = "Liste des patients référés par l'accueil pour une première consultation générale. Démarrez une consultation pour les orienter.";
  } else if (isAccueil) {
    pageTitle = "Patients en Attente (Nouveaux)";
    pageDescription = "Nouveaux patients, non orientés vers un généraliste et sans consultation existante.";
  } else if (isSpecialist) {
    pageTitle = `Mes Patients (${currentUser?.specialite || 'Spécialiste'})`;
    pageDescription = "Liste des patients qui vous ont été directement orientés ou orientés vers votre spécialité.";
  }


  const overallPageLoading = isLoading ||
                             (isAccueil && isLoadingAccueilExclusionData) ||
                             (isGP && isLoadingGpData) ||
                             (isSpecialist && isLoadingSpecialistData);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-semibold text-gray-800">
          {pageTitle}
        </h2>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                disabled={isLoading || isImporting}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg shadow-md hover:bg-teal-700 transition duration-150 ease-in-out flex items-center"
              >
                <i className="fas fa-file-import mr-2"></i> Importer Excel
              </button>
              <button
                onClick={handleExportExcel}
                disabled={isLoading || isImporting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-150 ease-in-out flex items-center"
              >
                <i className="fas fa-file-export mr-2"></i> Exporter Excel
              </button>
            </>
          )}
          {canAddPatientByRole && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-150 ease-in-out flex items-center"
            >
              <i className="fas fa-plus mr-2"></i> Ajouter Patient
            </button>
          )}
        </div>
      </div>
      {importMessage && !isImportModalOpen && ( // Show general import/export messages if import modal is closed
            <div className={`p-3 my-2 rounded-md text-sm ${
                importMessage.type === 'success' ? 'bg-green-100 text-green-700' :
                importMessage.type === 'error' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
            }`}>
                {importMessage.text}
                 {importMessage.details && importMessage.details.length > 0 && (
                    <ul className="list-disc list-inside mt-2 text-xs">
                        {importMessage.details.slice(0, 5).map((detail, index) => <li key={index}>{detail}</li>)}
                        {importMessage.details.length > 5 && <li>Et {importMessage.details.length - 5} autres erreurs...</li>}
                    </ul>
                )}
            </div>
      )}


      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
        <div className="mb-4">
            <input
                type="text"
                placeholder="Rechercher par nom, prénom, CIN..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full md:w-1/2 lg:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
        </div>
        {overallPageLoading && patients.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner
                message={
                    (isAccueil && isLoadingAccueilExclusionData) ? "Vérification des filtres Accueil..." :
                    (isGP && isLoadingGpData) ? "Vérification des filtres Généraliste..." :
                    (isSpecialist && isLoadingSpecialistData) ? "Recherche des patients pour Spécialiste..." :
                    "Chargement des patients..."
                }
                size="lg"
            />
          </div>
        ) : !isLoading && patients.length === 0 && searchTerm ? (
           <div className="text-center py-10">
            <i className="fas fa-search fa-3x text-gray-400 mb-4"></i>
            <p className="text-gray-600 text-lg">Aucun patient trouvé pour "{searchTerm}".</p>
            <p className="text-gray-500 text-sm">Essayez de modifier vos termes de recherche.</p>
          </div>
        ) : !isLoading && patients.length === 0 ? (
          <div className="text-center py-10">
            <i className={`fas ${isGP ? 'fa-user-md' : (isAccueil ? 'fa-user-clock' : (isSpecialist ? 'fa-user-nurse' : 'fa-users-slash'))} fa-3x text-gray-400 mb-4`}></i>
            <p className="text-gray-600 text-lg">
              {isGP ? "Aucun patient référé par l'accueil pour le moment." :
               isAccueil ? "Aucun patient en attente de traitement." :
               isSpecialist ? `Aucun patient ne vous a été orienté ou assigné à votre spécialité (${currentUser?.specialite || 'N/A'}).` :
               "Aucun patient enregistré pour le moment."
              }
            </p>
            <p className="text-gray-500 text-sm mt-1">{pageDescription}</p>
            {canAddPatientByRole && !isGP && !isSpecialist && <p className="text-gray-500 text-sm mt-2">Cliquez sur "Ajouter un Patient" pour commencer.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Unique</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom Complet</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CIN</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Âge</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sexe</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Créé le</th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {patients.map((patient) => (
                  <PatientListItem
                    key={patient.id}
                    patient={patient}
                    onDeletePatient={handleDeletePatient}
                    onEditPatientDemographics={openEditModal}
                    canEditPatientDemographics={canEditPatientDemographicsByRole && !isGP && !isSpecialist}
                    canDeletePatient={canDeletePatientByRole}
                    canViewPatientDetails={canViewPatientDetailsByRole}
                    isGPContext={isGP}
                    gpCanStartConsultationPermission={gpCanStartConsultationPermission}
                  />
                ))}
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

      {isModalOpen && (canEditPatientDemographicsByRole || canAddPatientByRole) && (
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={editingPatient ? "Modifier le Patient" : "Ajouter un Nouveau Patient"}
            size="xl"
          >
            <PatientForm
              onSubmit={handleFormSubmit}
              initialData={editingPatient}
              isLoading={isSubmitting}
              currentUserRole={currentUser!.role}
            />
          </Modal>
        )}
      
      {isAdmin && isImportModalOpen && (
        <Modal
            isOpen={isImportModalOpen}
            onClose={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
                setImportMessage(null);
            }}
            title="Importer des Patients depuis Excel"
            size="lg"
        >
            <div className="space-y-4">
                <p className="text-sm text-gray-600">
                    Sélectionnez un fichier Excel (.xlsx, .xls) respectant le format d'exportation.
                    Les colonnes attendues sont: <code className="text-xs bg-gray-100 p-1 rounded">N° Unique</code> (sera ignoré si présent, car auto-généré),
                    <code className="text-xs bg-gray-100 p-1 rounded">Prénom</code>, <code className="text-xs bg-gray-100 p-1 rounded">Nom</code>,
                    <code className="text-xs bg-gray-100 p-1 rounded">CIN</code>, <code className="text-xs bg-gray-100 p-1 rounded">Adresse</code>,
                    <code className="text-xs bg-gray-100 p-1 rounded">Âge</code>, <code className="text-xs bg-gray-100 p-1 rounded">Sexe</code> (Masculin/Féminin ou M/F),
                    <code className="text-xs bg-gray-100 p-1 rounded">Téléphone</code>, <code className="text-xs bg-gray-100 p-1 rounded">Email</code>,
                    <code className="text-xs bg-gray-100 p-1 rounded">Date de Naissance</code> (AAAA-MM-JJ),
                    <code className="text-xs bg-gray-100 p-1 rounded">Antécédents Médicaux</code>,
                    <code className="text-xs bg-gray-100 p-1 rounded">Orienté Généraliste</code> (Oui/Non).
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
                                {importMessage.details.length > 10 && <li>Et {importMessage.details.length - 10} autres erreurs... (vérifiez la console pour plus de détails)</li>}
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

export default PatientsPage;
