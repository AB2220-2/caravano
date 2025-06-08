
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, Consultation, Patient, Caravane, PatientSexe, Specialite, ConsultationType, ConsultationStatut, PatientFormData, User } from '../types';
import { USER_ROLES_CONFIG, SPECIALTIES_LIST } from '../constants';
import patientService from '../services/patientService';
import consultationService from '../services/consultationService';
import caravaneService from '../services/caravaneService';
import userService from '../services/userService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import { formatDate, formatDateTime } from '../utils/helpers';
import { validatePatientForm } from '../utils/validators';


interface DashboardCardProps {
  title: string;
  count: number | string;
  icon: string;
  linkTo: string;
  bgColorClass: string;
  textColorClass: string;
  isLoading: boolean;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, count, icon, linkTo, bgColorClass, textColorClass, isLoading }) => (
  <Link to={linkTo} className={`block p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 ${bgColorClass}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-sm font-medium ${textColorClass} opacity-80`}>{title}</p>
        {isLoading ? (
            <div className="mt-2"><LoadingSpinner size="sm" /></div>
        ) : (
            <p className={`text-3xl font-bold ${textColorClass}`}>{count}</p>
        )}
      </div>
      <div className={`p-3 rounded-full bg-white bg-opacity-30`}>
        <i className={`fas ${icon} fa-2x ${textColorClass}`}></i>
      </div>
    </div>
  </Link>
);


const DashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    totalPatients: 0,
    activeCaravanes: 0,
    pendingConsultations: 0,
    usersCount: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [upcomingCaravanes, setUpcomingCaravanes] = useState<Caravane[]>([]);
  
  const [beneficiairesParSpecialite, setBeneficiairesParSpecialite] = useState<Record<string, number>>({});
  const [patientsHorsChampCount, setPatientsHorsChampCount] = useState(0);
  const [beneficiairesParMedecinSpecialiste, setBeneficiairesParMedecinSpecialiste] = useState<Record<string, { nom: string, count: number, specialite?: Specialite }>>({});


  const [isImportPatientListModalOpen, setIsImportPatientListModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [isProcessingExport, setIsProcessingExport] = useState(false);
  const [processMessage, setProcessMessage] = useState<{ type: 'success' | 'error' | 'info', text: string, details?: string[] } | null>(null);


  const fetchDashboardData = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const patientRes = await patientService.getPatients({ limit: 5, page: 1 });
      const activeCaravanesRes = await caravaneService.getCaravanes({ limit: 1000 });
      // Consultations for pending count
      const consultationRes = await consultationService.getConsultations({ limit: 1000 }); 
      
      let usersResTotal = 0;
      if(currentUser?.role === UserRole.ADMIN) {
        usersResTotal = (await userService.getUsers({limit:1})).total;
      }

      setStats({
        totalPatients: (await patientService.getPatients({ limit: 1 })).total,
        activeCaravanes: activeCaravanesRes.data.filter(c => c.statut === 'en_cours' || c.statut === 'planifiee').length,
        pendingConsultations: consultationRes.data.filter(c => c.statut === 'en_attente').length,
        usersCount: usersResTotal,
      });
      setRecentPatients(patientRes.data);
      setUpcomingCaravanes(activeCaravanesRes.data.filter(c => c.statut === 'planifiee').sort((a,b) => new Date(a.date_caravane).getTime() - new Date(b.date_caravane).getTime()).slice(0,3));

      if (currentUser?.role === UserRole.ADMIN) {
        // Fetch all consultations for admin-specific stats
        const allConsultationsResponse = await consultationService.getConsultations({ limit: Number.MAX_SAFE_INTEGER });
        const allConsultationsData = allConsultationsResponse.data;

        // Bénéficiaires par spécialité
        const benefMap = new Map<string, Set<string>>();
        SPECIALTIES_LIST.forEach(spec => {
            benefMap.set(spec, new Set());
        });
        allConsultationsData.forEach(consult => {
          if (consult.specialite) {
            if (!benefMap.has(consult.specialite)) { 
              benefMap.set(consult.specialite, new Set());
            }
            benefMap.get(consult.specialite)!.add(consult.patient_id);
          }
        });
        const benefCounts: Record<string, number> = {};
        for (const [spec, idsSet] of benefMap) {
          benefCounts[spec] = idsSet.size;
        }
        setBeneficiairesParSpecialite(benefCounts);

        // Patients Hors Champ Count
        const horsChampConsultations = allConsultationsData.filter(c => c.hors_champ_specialite_caravane === true);
        const horsChampPatientIds = new Set<string>(horsChampConsultations.map(consult => consult.patient_id));
        setPatientsHorsChampCount(horsChampPatientIds.size);

        // Bénéficiaires par Médecin Spécialiste
        const allUsersResponse = await userService.getUsers({ limit: Number.MAX_SAFE_INTEGER });
        const specialistDoctorsList = allUsersResponse.data.filter(user => user.role === UserRole.MEDECIN_SPECIALISTE && user.actif);
        
        const countsBySpecialist: Record<string, { nom: string, count: number, specialite?: Specialite }> = {};
        specialistDoctorsList.forEach(doc => {
            countsBySpecialist[doc.id] = { 
                nom: `${doc.prenom} ${doc.nom}`, 
                count: 0, 
                specialite: doc.specialite 
            };
        });

        const patientSetsBySpecialist: Record<string, Set<string>> = {};
        const specialistConsultations = allConsultationsData.filter(
            c => c.type_consultation === ConsultationType.SPECIALISEE && c.medecin_id
        );

        specialistConsultations.forEach(consult => {
            if (consult.medecin_id) { // medecin_id is ensured by filter but good practice
                if (!patientSetsBySpecialist[consult.medecin_id]) {
                    patientSetsBySpecialist[consult.medecin_id] = new Set<string>();
                }
                patientSetsBySpecialist[consult.medecin_id].add(consult.patient_id);
            }
        });

        for (const medecinId in patientSetsBySpecialist) {
            if (countsBySpecialist[medecinId]) { 
                countsBySpecialist[medecinId].count = patientSetsBySpecialist[medecinId].size;
            }
        }
        setBeneficiairesParMedecinSpecialiste(countsBySpecialist);
      }

    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoadingStats(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleExportAllRegistered = async () => {
    if (currentUser?.role !== UserRole.ADMIN) return;
    setIsProcessingExport(true);
    setProcessMessage({ type: 'info', text: 'Exportation de tous les inscrits en cours...' });
    try {
      const response = await patientService.getPatients({ limit: Number.MAX_SAFE_INTEGER });
      const patientsToExport = response.data.map(p => ({
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
        "Date Création Dossier": formatDateTime(p.created_at),
        "Orienté Généraliste (par Accueil)": p.est_oriente_generaliste ? 'Oui' : 'Non',
      }));

      if (patientsToExport.length === 0) {
        setProcessMessage({ type: 'info', text: "Aucun patient à exporter." });
        setIsProcessingExport(false);
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(patientsToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "TousLesInscrits");
      XLSX.writeFile(workbook, `tous_les_inscrits_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      setProcessMessage({ type: 'success', text: "Exportation de tous les inscrits réussie." });
    } catch (error) {
      console.error("Error exporting all registered patients:", error);
      setProcessMessage({ type: 'error', text: "Erreur lors de l'exportation de tous les inscrits." });
    } finally {
      setIsProcessingExport(false);
    }
  };

  const handleExportSpecialistDiagnoses = async () => {
    if (currentUser?.role !== UserRole.ADMIN) return;
    setIsProcessingExport(true);
    setProcessMessage({ type: 'info', text: 'Exportation des diagnostics spécialistes en cours...' });
    try {
      const specialistConsultationsResponse = await consultationService.getConsultations({
        limit: Number.MAX_SAFE_INTEGER,
      });
      
      let specialistConsultations = specialistConsultationsResponse.data;
      specialistConsultations = specialistConsultations.filter(c => c.type_consultation === ConsultationType.SPECIALISEE);

      if (specialistConsultations.length === 0) {
        setProcessMessage({ type: 'info', text: "Aucun diagnostic spécialiste à exporter." });
        setIsProcessingExport(false);
        return;
      }

      const patientIds = Array.from(new Set(specialistConsultations.map(c => c.patient_id)));
      const patientsResponse = await patientService.getPatients({ patientIds, limit: Number.MAX_SAFE_INTEGER });
      const patientsMap = new Map(patientsResponse.data.map(p => [p.id, p]));

      const dataToExport = specialistConsultations.map(consult => {
        const patient = patientsMap.get(consult.patient_id);
        return {
          "Patient N° Unique": patient?.numero_unique || '',
          "Patient Prénom": patient?.prenom || '',
          "Patient Nom": patient?.nom || '',
          "Patient CIN": patient?.cin || '',
          "Patient Adresse": patient?.adresse || '',
          "Patient Âge": patient?.age || '',
          "Patient Sexe": patient?.sexe === PatientSexe.MASCULIN ? 'Masculin' : (patient?.sexe === PatientSexe.FEMININ ? 'Féminin' : ''),
          "Patient Téléphone": patient?.telephone || '',
          "Patient Email": patient?.email || '',
          "Patient Date de Naissance": patient?.date_naissance ? formatDate(patient.date_naissance) : '',
          "Patient Antécédents Médicaux": patient?.antecedents_medicaux || '',
          "Patient Date Création Dossier": patient ? formatDateTime(patient.created_at) : '',
          "Patient Orienté Généraliste (par Accueil)": patient?.est_oriente_generaliste ? 'Oui' : 'Non',
          "ID Consultation": consult.id,
          "Date Consultation": formatDateTime(consult.created_at),
          "Nom Médecin Spécialiste": consult.medecin_nom || '',
          "ID Médecin Spécialiste": consult.medecin_id,
          "Spécialité Médecin": consult.specialite || '',
          "Diagnostic (Spécialiste)": consult.diagnostic || '',
          "Remarques Spécialiste": consult.notes || '',
          "Nom Caravane": consult.caravane_nom || '',
          "ID Caravane": consult.caravane_id,
          "Scanner Effectué": consult.scanner_effectue ? 'Oui' : 'Non',
          "Orientation CHU": consult.orientation_chu ? 'Oui' : 'Non',
          "Suivi Nécessaire": consult.suivi_necessaire ? 'Oui' : 'Non',
          "Date Prochain RDV": consult.date_prochain_rdv ? formatDate(consult.date_prochain_rdv) : '',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "DiagnosticsSpecialistes");
      XLSX.writeFile(workbook, `diagnostics_specialistes_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      setProcessMessage({ type: 'success', text: "Exportation des diagnostics spécialistes réussie." });
    } catch (error) {
      console.error("Error exporting specialist diagnoses:", error);
      setProcessMessage({ type: 'error', text: "Erreur lors de l'exportation des diagnostics spécialistes." });
    } finally {
      setIsProcessingExport(false);
    }
  };

  const handleFileChangeForImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImportFile(event.target.files[0]);
      setProcessMessage(null); 
    }
  };

  const handleImportPatientList = async () => {
    if (!importFile || currentUser?.role !== UserRole.ADMIN) {
      setProcessMessage({ type: 'error', text: 'Veuillez sélectionner un fichier.' });
      return;
    }
    setIsProcessingImport(true);
    setProcessMessage({ type: 'info', text: 'Importation de la liste des inscrits en cours...' });

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
            const patientCIN = row["CIN"]?.toString().trim();
            if (!patientCIN) { 
              errorDetails.push("Ligne ignorée: CIN Patient manquant."); 
              errorCount++; 
              continue; 
            }
            
            const patientFormData: PatientFormData = {
              prenom: row["Prénom"]?.toString().trim(),
              nom: row["Nom"]?.toString().trim(),
              cin: patientCIN,
              adresse: row["Adresse"]?.toString().trim(),
              age: row["Âge"]?.toString(),
              sexe: row["Sexe"]?.toString().toLowerCase().startsWith('m') ? PatientSexe.MASCULIN : PatientSexe.FEMININ,
              telephone: row["Téléphone"]?.toString().trim() || undefined,
              email: row["Email"]?.toString().trim() || undefined,
              date_naissance: row["Date de Naissance"] ? (row["Date de Naissance"] instanceof Date ? row["Date de Naissance"].toISOString().split('T')[0] : row["Date de Naissance"].toString()) : undefined,
              antecedents_medicaux: row["Antécédents Médicaux"]?.toString().trim() || undefined,
              est_oriente_generaliste: row["Orienté Généraliste (par Accueil)"]?.toString().toLowerCase() === 'oui' || false,
            };
            
            const patientValidationErrors = validatePatientForm(patientFormData);
            if (Object.keys(patientValidationErrors).length > 0) {
              errorDetails.push(`CIN ${patientCIN}: Validation Patient échouée - ${Object.values(patientValidationErrors).join(', ')}`); 
              errorCount++; 
              continue;
            }

            // Check if patient exists by CIN
            const existingPatients = await patientService.getPatients({ search: patientCIN, limit: 1 });
            let patientToProcess: Patient | null = null;
            if (existingPatients.data.length > 0 && existingPatients.data[0].cin === patientCIN) {
              patientToProcess = await patientService.updatePatient(existingPatients.data[0].id, patientFormData);
            } else {
              patientToProcess = await patientService.addPatient(patientFormData);
            }

            if (!patientToProcess) { 
              errorDetails.push(`CIN ${patientCIN}: Erreur création/MàJ patient.`); 
              errorCount++; 
              continue; 
            }
            successCount++;
          } catch (rowError: any) {
            errorDetails.push(`CIN ${row["CIN"] || 'N/A'}: ${rowError.message || 'Erreur inconnue.'}`);
            errorCount++;
          }
        }

        setProcessMessage({
          type: successCount > 0 && errorCount === 0 ? 'success' : (errorCount > 0 ? 'error' : 'info'),
          text: `Importation terminée. ${successCount} patients traités. ${errorCount} erreurs.`,
          details: errorDetails,
        });
        if (successCount > 0) fetchDashboardData(); 

      } catch (fileError: any) {
        console.error("Error processing Excel file for patient list import:", fileError);
        setProcessMessage({ type: 'error', text: 'Erreur lors du traitement du fichier Excel.' });
      } finally {
        setIsProcessingImport(false);
        setImportFile(null); 
      }
    };
    reader.readAsBinaryString(importFile);
  };


  if (!currentUser) {
    return <LoadingSpinner message="Chargement..." />;
  }
  const roleName = USER_ROLES_CONFIG[currentUser.role]?.name || 'Utilisateur';
  const welcomeName = currentUser.prenom && currentUser.nom ? `${currentUser.prenom} ${currentUser.nom}` : currentUser.username;


  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-xl shadow-2xl text-white">
        <h1 className="text-4xl font-bold mb-2">Bienvenue, {welcomeName}!</h1>
        <p className="text-lg text-blue-200">Vous êtes connecté en tant que {roleName}. Voici un aperçu de l'activité.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard title="Total Patients" count={stats.totalPatients} icon="fa-users" linkTo="/patients" bgColorClass="bg-blue-500" textColorClass="text-white" isLoading={isLoadingStats}/>
        <DashboardCard title="Caravanes Actives/Planifiées" count={stats.activeCaravanes} icon="fa-truck-medical" linkTo="/caravanes" bgColorClass="bg-green-500" textColorClass="text-white" isLoading={isLoadingStats}/>
        <DashboardCard title="Consultations en Attente" count={stats.pendingConsultations} icon="fa-stethoscope" linkTo="/consultations" bgColorClass="bg-yellow-500" textColorClass="text-white" isLoading={isLoadingStats}/>
        {currentUser.role === UserRole.ADMIN && (
            <>
             <DashboardCard title="Utilisateurs Actifs" count={stats.usersCount} icon="fa-user-shield" linkTo="/admin" bgColorClass="bg-purple-500" textColorClass="text-white" isLoading={isLoadingStats} />
             <DashboardCard title="Patients Hors Champ" count={patientsHorsChampCount} icon="fa-user-tag" linkTo="/patients-hors-champ" bgColorClass="bg-orange-500" textColorClass="text-white" isLoading={isLoadingStats}/>
            </>
        )}
      </div>

      {currentUser.role === UserRole.ADMIN && (
        <div className="bg-white p-6 rounded-xl shadow-lg mt-8">
            <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-3">Exports & Imports (Admin)</h3>
            {processMessage && !isImportPatientListModalOpen && (
                 <div className={`p-3 my-4 rounded-md text-sm ${
                    processMessage.type === 'success' ? 'bg-green-100 text-green-700' :
                    processMessage.type === 'error' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                }`}>
                    <p className="font-medium">{processMessage.text}</p>
                    {processMessage.details && processMessage.details.length > 0 && (
                        <ul className="list-disc list-inside mt-2 text-xs max-h-40 overflow-y-auto">
                            {processMessage.details.slice(0, 10).map((detail, index) => <li key={index}>{detail}</li>)}
                            {processMessage.details.length > 10 && <li>Et {processMessage.details.length - 10} autres erreurs...</li>}
                        </ul>
                    )}
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                    onClick={handleExportAllRegistered}
                    disabled={isProcessingExport || isProcessingImport}
                    className="w-full px-4 py-3 bg-sky-600 text-white rounded-lg shadow-md hover:bg-sky-700 transition duration-150 ease-in-out flex items-center justify-center text-sm font-medium disabled:opacity-60"
                >
                    <i className={`fas ${isProcessingExport && !isProcessingImport ? 'fa-spinner fa-spin' : 'fa-download'} mr-2`}></i> Exporter Tous les Inscrits
                </button>
                <button
                    onClick={handleExportSpecialistDiagnoses}
                    disabled={isProcessingExport || isProcessingImport}
                    className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg shadow-md hover:bg-teal-700 transition duration-150 ease-in-out flex items-center justify-center text-sm font-medium disabled:opacity-60"
                >
                    <i className={`fas ${isProcessingExport && !isProcessingImport ? 'fa-spinner fa-spin' : 'fa-file-medical-alt'} mr-2`}></i> Exporter Diagnostics Spécialistes
                </button>
                 <button
                    onClick={() => { setIsImportPatientListModalOpen(true); setProcessMessage(null); }}
                    disabled={isProcessingExport || isProcessingImport}
                    className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700 transition duration-150 ease-in-out flex items-center justify-center text-sm font-medium disabled:opacity-60"
                >
                    <i className={`fas ${isProcessingImport ? 'fa-spinner fa-spin' : 'fa-file-upload'} mr-2`}></i> Importer la liste des inscrits
                </button>
            </div>
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Patients Récemment Ajoutés</h3>
          {isLoadingStats && recentPatients.length === 0 ? <LoadingSpinner message="Chargement..." /> : 
           recentPatients.length > 0 ? (
            <ul className="space-y-3">
              {recentPatients.map(patient => (
                <li key={patient.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div>
                    <Link to={`/patients/${patient.id}`} className="font-medium text-blue-600 hover:underline">{patient.prenom} {patient.nom}</Link>
                    <p className="text-xs text-gray-500">CIN: {patient.cin} - Ajouté le: {formatDate(patient.created_at)}</p>
                  </div>
                  <Link to={`/patients/${patient.id}`} className="text-sm text-blue-500 hover:text-blue-700" title="Voir détails">
                    <i className="fas fa-eye"></i>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">Aucun patient récent.</p>
          )}
           <Link to="/patients" className="mt-4 inline-block text-sm text-blue-600 hover:underline">Voir tous les patients <i className="fas fa-arrow-right fa-xs ml-1"></i></Link>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Caravanes à Venir (Planifiées)</h3>
          {isLoadingStats && upcomingCaravanes.length === 0 ? <LoadingSpinner message="Chargement..." /> : 
           upcomingCaravanes.length > 0 ? (
            <ul className="space-y-3">
              {upcomingCaravanes.map(caravane => (
                <li key={caravane.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <Link to={`/caravanes/${caravane.id}`} className="font-medium text-green-600 hover:underline">{caravane.nom}</Link>
                  <p className="text-xs text-gray-500">Date: {formatDate(caravane.date_caravane)} - Lieu: {caravane.lieu}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">Aucune caravane planifiée à venir.</p>
          )}
          <Link to="/caravanes" className="mt-4 inline-block text-sm text-green-600 hover:underline">Voir toutes les caravanes <i className="fas fa-arrow-right fa-xs ml-1"></i></Link>
        </div>
      </div>
      
      {currentUser.role === UserRole.ADMIN && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-lg mt-8">
              <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Bénéficiaires par Spécialité</h3>
              {isLoadingStats && Object.keys(beneficiairesParSpecialite).length === 0 ? (
                  <LoadingSpinner message="Chargement des données..." />
              ) : Object.keys(beneficiairesParSpecialite).length > 0 || SPECIALTIES_LIST.some(spec => (beneficiairesParSpecialite[spec] || 0) > 0) ? (
                  <ul className="space-y-2 divide-y divide-gray-100">
                  {SPECIALTIES_LIST.map((specialite) => ( 
                      <li key={specialite} className="flex justify-between items-center py-2.5">
                      <span className="text-sm text-gray-800">{specialite}</span>
                      <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {(beneficiairesParSpecialite[specialite] || 0)} patient{(beneficiairesParSpecialite[specialite] || 0) !== 1 ? 's' : ''}
                      </span>
                      </li>
                  ))}
                  </ul>
              ) : (
                  <p className="text-gray-500 italic">Aucune donnée de bénéficiaire par spécialité disponible.</p>
              )}
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg mt-8">
            <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Bénéficiaires par les Médecins Spécialistes</h3>
            {isLoadingStats && Object.keys(beneficiairesParMedecinSpecialiste).length === 0 ? (
                <LoadingSpinner message="Chargement des données..." />
            ) : Object.keys(beneficiairesParMedecinSpecialiste).length > 0 ? (
                <ul className="space-y-2 divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {Object.entries(beneficiairesParMedecinSpecialiste)
                    .sort(([, a], [, b]) => b.count - a.count) // Sort by count descending
                    .map(([medecinId, data]) => (
                    <li key={medecinId} className="flex justify-between items-center py-2.5">
                        <span className="text-sm text-gray-800">
                            Dr. {data.nom} 
                            {data.specialite && <span className="text-xs text-gray-500 ml-1">({data.specialite})</span>}
                        </span>
                        <span className="text-sm font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                            {data.count} patient{data.count !== 1 ? 's' : ''}
                        </span>
                    </li>
                ))}
                </ul>
            ) : (
                <p className="text-gray-500 italic">Aucun patient pris en charge par des spécialistes pour le moment ou aucun médecin spécialiste actif.</p>
            )}
          </div>
        </>
      )}


       <div className="bg-white p-6 rounded-xl shadow-lg mt-8">
            <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">Accès Rapides</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <Link to="/patients" className="flex flex-col items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-blue-700">
                    <i className="fas fa-users fa-2x mb-2"></i>
                    <span className="text-sm font-medium text-center">Gestion Patients</span>
                </Link>
                { currentUser.role === UserRole.ADMIN &&
                    <Link to="/caravanes/plan" className="flex flex-col items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition text-green-700">
                        <i className="fas fa-truck-medical fa-2x mb-2"></i>
                        <span className="text-sm font-medium text-center">Planifier Caravane</span>
                    </Link>
                }
                 {(currentUser.role === UserRole.MEDECIN_GENERALISTE || currentUser.role === UserRole.MEDECIN_SPECIALISTE || currentUser.role === UserRole.ADMIN) &&
                    <Link to="/consultations/new" className="flex flex-col items-center p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition text-indigo-700">
                        <i className="fas fa-file-medical fa-2x mb-2"></i>
                        <span className="text-sm font-medium text-center">Nouv. Consultation</span>
                    </Link>
                 }
                <Link to="/consultations" className="flex flex-col items-center p-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition text-yellow-700">
                    <i className="fas fa-notes-medical fa-2x mb-2"></i>
                    <span className="text-sm font-medium text-center">Voir Consultations</span>
                </Link>
                { currentUser.role === UserRole.ADMIN &&
                     <Link to="/admin" className="flex flex-col items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition text-purple-700">
                        <i className="fas fa-user-shield fa-2x mb-2"></i>
                        <span className="text-sm font-medium text-center">Administration</span>
                    </Link>
                }
            </div>
        </div>
        
        {currentUser.role === UserRole.ADMIN && isImportPatientListModalOpen && (
            <Modal
                isOpen={isImportPatientListModalOpen}
                onClose={() => { setIsImportPatientListModalOpen(false); setImportFile(null); setProcessMessage(null); }}
                title="Importer la liste des inscrits"
                size="lg"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Sélectionnez un fichier Excel (.xlsx, .xls) pour importer une liste de patients.
                        Les patients existants (basé sur le CIN) seront mis à jour, les nouveaux seront créés.
                    </p>
                    <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-md border">
                        <strong className="block text-gray-700 mb-1">Colonnes attendues (Patient):</strong>
                        <ul className="list-disc list-inside pl-4 space-y-0.5">
                            <li><strong className="text-red-600">CIN</strong> (Clé pour identifier/créer, obligatoire)</li>
                            <li><strong className="text-red-600">Prénom</strong> (Obligatoire)</li>
                            <li><strong className="text-red-600">Nom</strong> (Obligatoire)</li>
                            <li><strong className="text-red-600">Adresse</strong> (Obligatoire)</li>
                            <li><strong className="text-red-600">Âge</strong> (Obligatoire, nombre)</li>
                            <li><strong className="text-red-600">Sexe</strong> (M ou Masculin / F ou Féminin, obligatoire)</li>
                            <li>Téléphone (Optionnel)</li>
                            <li>Email (Optionnel, format email)</li>
                            <li>Date de Naissance (Optionnel, format AAAA-MM-JJ)</li>
                            <li>Antécédents Médicaux (Optionnel)</li>
                            <li>Orienté Généraliste (par Accueil) (Optionnel, Oui/Non, défaut: Non)</li>
                        </ul>
                    </div>
                    
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleFileChangeForImport}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    {importFile && <p className="text-sm text-gray-500">Fichier sélectionné: {importFile.name}</p>}
                    
                    {processMessage && (
                        <div className={`p-3 rounded-md text-sm ${
                            processMessage.type === 'success' ? 'bg-green-100 text-green-700' :
                            processMessage.type === 'error' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                        }`}>
                            <p className="font-medium">{processMessage.text}</p>
                            {processMessage.details && processMessage.details.length > 0 && (
                                <ul className="list-disc list-inside mt-2 text-xs max-h-32 overflow-y-auto">
                                    {processMessage.details.slice(0,10).map((detail, index) => <li key={index}>{detail}</li>)}
                                    {processMessage.details.length > 10 && <li>Et {processMessage.details.length - 10} autres erreurs...</li>}
                                </ul>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={() => { setIsImportPatientListModalOpen(false); setImportFile(null); setProcessMessage(null); }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                            disabled={isProcessingImport}
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleImportPatientList}
                            disabled={!importFile || isProcessingImport}
                            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md shadow-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center"
                        >
                            {isProcessingImport ? <LoadingSpinner size="sm" /> : <i className="fas fa-check mr-2"></i>}
                            Importer le Fichier
                        </button>
                    </div>
                </div>
            </Modal>
        )}

    </div>
  );
};

export default DashboardPage;
