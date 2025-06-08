
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Consultation, Patient, PatientSexe, UserRole } from '../types';
import consultationService from '../services/consultationService';
import patientService from '../services/patientService';
import { USER_ROLES_CONFIG, DEFAULT_ITEMS_PER_PAGE } from '../constants';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';
import { formatDate, formatDateTime } from '../utils/helpers';

interface PatientHorsChampData extends Patient {
  originatingConsultationId: string;
  originatingConsultationDate: string;
}

const HorsChampPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const [horsChampPatientsData, setHorsChampPatientsData] = useState<PatientHorsChampData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const itemsPerPage = DEFAULT_ITEMS_PER_PAGE;
  const roleName = USER_ROLES_CONFIG[currentUser!.role].name;
  const isAdmin = currentUser!.role === UserRole.ADMIN;
  // Permission to edit the consultation that marked the patient as "hors champ"
  // GPs use 'add_consultations' for their orientation forms, Admin has full edit, Accueil might have specific edit rights
  const canEditOriginatingConsultation = 
    isAdmin || 
    hasPermission('edit_consultations_accueil') || 
    (currentUser!.role === UserRole.MEDECIN_GENERALISTE && hasPermission('add_consultations'));


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all consultations marked as "hors champ"
      const horsChampConsultationsResponse = await consultationService.getConsultations({
        fetchHorsChamp: true,
        limit: 99999, // Get all such consultations to identify all patients
      });
      const horsChampConsultations = horsChampConsultationsResponse.data;

      if (horsChampConsultations.length === 0) {
        setHorsChampPatientsData([]);
        setTotalItems(0);
        setIsLoading(false);
        return;
      }

      const patientIdToConsultationDetailsMap = new Map<string, { consultationId: string; date: string }>();
      horsChampConsultations.forEach(consult => {
        // Keep the latest consultation if a patient is marked "hors champ" multiple times (though unlikely for this specific flag)
        // For simplicity, taking the first one encountered, or could sort by date if necessary.
        if (!patientIdToConsultationDetailsMap.has(consult.patient_id)) {
            patientIdToConsultationDetailsMap.set(consult.patient_id, {
            consultationId: consult.id,
            date: consult.created_at,
          });
        }
      });
      
      const uniquePatientIds = Array.from(patientIdToConsultationDetailsMap.keys());

      // 2. Fetch details of these patients with pagination and search
      const patientDetailsResponse = await patientService.getPatients({
        patientIds: uniquePatientIds,
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
      });

      // 3. Merge patient details with their "hors champ" consultation info
      const mergedData: PatientHorsChampData[] = patientDetailsResponse.data.map(patient => {
        const consultDetails = patientIdToConsultationDetailsMap.get(patient.id)!; // Should always exist
        return {
          ...patient,
          originatingConsultationId: consultDetails.consultationId,
          originatingConsultationDate: consultDetails.date,
        };
      });
      
      // Sort by originatingConsultationDate descending before setting state
      mergedData.sort((a, b) => new Date(b.originatingConsultationDate).getTime() - new Date(a.originatingConsultationDate).getTime());

      setHorsChampPatientsData(mergedData);
      setTotalItems(patientDetailsResponse.total); // This total comes from patientService, reflecting paginated search results on the relevant patient IDs

    } catch (error) {
      console.error("Failed to fetch patients hors champ:", error);
      setHorsChampPatientsData([]);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); 
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const pageTitle = `Patients Hors Champ de Spécialité Caravane`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-semibold text-gray-800">{pageTitle} <span className="text-lg text-orange-600">({roleName})</span></h2>
        {/* No "Add" button as this list is populated via consultations */}
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
        <div className="mb-4">
            <input 
                type="text"
                placeholder="Rechercher par nom, CIN du patient..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full md:w-1/2 lg:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
            />
        </div>
        {isLoading && horsChampPatientsData.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner message="Chargement des patients hors champ..." size="lg" />
          </div>
        ) : !isLoading && horsChampPatientsData.length === 0 && searchTerm ? (
           <div className="text-center py-10">
            <i className="fas fa-search fa-3x text-gray-400 mb-4"></i>
            <p className="text-gray-600 text-lg">Aucun patient hors champ trouvé pour "{searchTerm}".</p>
          </div>
        ) : !isLoading && horsChampPatientsData.length === 0 ? (
          <div className="text-center py-10">
            <i className="fas fa-user-tag fa-3x text-gray-400 mb-4"></i>
            <p className="text-gray-600 text-lg">Aucun patient marqué comme "Hors champ de spécialité" pour le moment.</p>
            <p className="text-gray-500 text-sm">Cette liste se remplit lorsque la case correspondante est cochée lors d'une consultation.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Unique Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom Complet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CIN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Âge</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sexe</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Constat "Hors Champ"</th>
                  <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {horsChampPatientsData.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.numero_unique}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                       <Link to={`/patients/${patient.id}`} className="hover:text-orange-600">{patient.prenom} {patient.nom}</Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.cin}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.age}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.sexe === PatientSexe.MASCULIN ? 'Masculin' : 'Féminin'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDateTime(patient.originatingConsultationDate)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <Link 
                        to={`/patients/${patient.id}`} 
                        className="text-blue-600 hover:text-blue-800" 
                        title="Voir Détails Patient"
                      >
                        <i className="fas fa-eye"></i>
                      </Link>
                      {canEditOriginatingConsultation && (
                        <Link 
                          to={`/consultations/edit/${patient.originatingConsultationId}`} 
                          className="text-yellow-500 hover:text-yellow-700" 
                          title="Voir/Modifier Consultation d'Origine"
                        >
                          <i className="fas fa-file-medical-alt"></i>
                        </Link>
                      )}
                    </td>
                  </tr>
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
    </div>
  );
};

export default HorsChampPage;
