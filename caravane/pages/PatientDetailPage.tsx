
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Patient, PatientSexe, UserRole } from '../types';
import patientService from '../services/patientService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext'; 

const DetailItem: React.FC<{ label: string; value?: string | number | null; icon?: string }> = ({ label, value, icon }) => (
  <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
    <dt className="text-sm font-medium text-gray-500 flex items-center">
      {icon && <i className={`fas ${icon} mr-2 text-blue-500 w-5`}></i>}
      {label}
    </dt>
    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value || 'N/A'}</dd>
  </div>
);

const PatientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth(); 
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // currentUser is guaranteed by ProtectedRoute
  const canEditPatient = currentUser!.role === UserRole.ADMIN || currentUser!.role === UserRole.ACCUEIL;
  const isDoctor = currentUser!.role === UserRole.MEDECIN_GENERALISTE || currentUser!.role === UserRole.MEDECIN_SPECIALISTE;
  const isAccueil = currentUser!.role === UserRole.ACCUEIL;
  const isSpecialistUser = currentUser!.role === UserRole.MEDECIN_SPECIALISTE; // Added for specific state key

  useEffect(() => {
    if (id) { 
      setIsLoading(true);
      patientService.getPatientById(id)
        .then(data => {
          setPatient(data);
        })
        .catch(error => {
          console.error("Failed to fetch patient details:", error);
          setPatient(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
      setPatient(null); 
    }
  }, [id]); 

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <LoadingSpinner message="Chargement des détails du patient..." size="lg" />
      </div>
    );
  }
  
  if (!patient) {
    return (
      <div className="text-center py-10">
        <i className="fas fa-exclamation-triangle fa-3x text-red-500 mb-4"></i>
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Patient non trouvé</h2>
        <p className="text-gray-500">Désolé, nous n'avons pas pu trouver les informations pour ce patient (ID: {id}).</p>
        <Link to="/patients" className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Retour à la liste des patients
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:justify-between">
            <div className="flex items-center space-x-4">
                 <div className="bg-white p-1 rounded-full">
                    <img 
                        className="h-20 w-20 rounded-full object-cover border-4 border-blue-300" 
                        src={`https://source.unsplash.com/random/200x200/?person,face&sig=${patient.id}`} 
                        alt={`${patient.prenom} ${patient.nom}`} 
                    />
                 </div>
                <div>
                    <h2 className="text-3xl font-bold text-white">{patient.prenom} {patient.nom}</h2>
                    <p className="text-blue-200 text-sm">Patient N°: {patient.numero_unique}</p>
                </div>
            </div>
            {canEditPatient && (
              <div className="mt-4 sm:mt-0">
                  <Link 
                      to={`/patients`} 
                      state={{ action: 'edit', patientId: patient.id }}
                      className="px-4 py-2 bg-white text-blue-700 rounded-md shadow hover:bg-gray-100 transition duration-150 text-sm font-medium"
                  >
                      <i className="fas fa-pencil-alt mr-2"></i> Modifier Fiche
                  </Link>
              </div>
            )}
        </div>
      </div>

      <div className="p-6 md:p-8">
        <div className="mb-6 flex flex-wrap gap-3">
            {isDoctor && (
                 <Link
                    to="/consultations/new"
                    state={
                        isSpecialistUser ? 
                        { patientIdFromSpecialistList: patient.id, patientNom: `${patient.prenom} ${patient.nom}` } :
                        { patientIdFromAccueilReferral: patient.id, patientNom: `${patient.prenom} ${patient.nom}` }
                    }
                    className="px-4 py-2 bg-green-500 text-white rounded-md shadow hover:bg-green-600 transition flex items-center"
                  >
                    <i className="fas fa-stethoscope mr-2"></i> Démarrer Consultation
                  </Link>
            )}
            {isAccueil && (
                 <button className="px-4 py-2 bg-yellow-500 text-white rounded-md shadow hover:bg-yellow-600 transition flex items-center">
                    <i className="fas fa-file-alt mr-2"></i> Compléter Dossier
                </button>
            )}
             <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md shadow hover:bg-gray-300 transition flex items-center">
                <i className="fas fa-print mr-2"></i> Imprimer Fiche
            </button>
        </div>


        <h3 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-3">Informations Personnelles</h3>
        <dl className="divide-y divide-gray-200">
          <DetailItem label="CIN" value={patient.cin} icon="fa-id-card" />
          <DetailItem label="Date de Naissance" value={patient.date_naissance ? formatDate(patient.date_naissance) : 'N/A'} icon="fa-calendar-day" />
          <DetailItem label="Âge" value={`${patient.age} ans`} icon="fa-birthday-cake" />
          <DetailItem label="Sexe" value={patient.sexe === PatientSexe.MASCULIN ? 'Masculin' : 'Féminin'} icon={patient.sexe === PatientSexe.MASCULIN ? 'fa-mars' : 'fa-venus'} />
          <DetailItem label="Adresse" value={patient.adresse} icon="fa-map-marker-alt" />
          <DetailItem label="Téléphone" value={patient.telephone} icon="fa-phone" />
          <DetailItem label="Email" value={patient.email} icon="fa-envelope" />
        </dl>

        <h3 className="text-xl font-semibold text-gray-800 mt-10 mb-6 border-b pb-3">Informations Médicales</h3>
        <dl className="divide-y divide-gray-200">
          <DetailItem label="Antécédents Médicaux" value={patient.antecedents_medicaux || "Aucun antécédent rapporté."} icon="fa-notes-medical" />
        </dl>
        
        {isDoctor && (
             <div className="mt-10 p-4 border border-green-200 rounded-lg bg-green-50">
                <h3 className="text-lg font-semibold text-green-700 mb-3"><i className="fas fa-file-medical-alt mr-2"></i>Espace Consultation (Médecin)</h3>
                <textarea className="w-full p-2 border border-green-300 rounded-md" rows={4} placeholder="Saisir notes, diagnostic, orientation..."></textarea>
                <div className="mt-3 text-right">
                    <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Enregistrer Notes</button>
                </div>
            </div>
        )}


        <h3 className="text-xl font-semibold text-gray-800 mt-10 mb-6 border-b pb-3">Historique Administratif</h3>
        <dl className="divide-y divide-gray-200">
          <DetailItem label="Date de création du dossier" value={formatDate(patient.created_at)} icon="fa-calendar-plus" />
          <DetailItem label="Dernière mise à jour" value={formatDate(patient.updated_at)} icon="fa-calendar-check" />
        </dl>

        <div className="mt-10">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Historique des Consultations (Prochainement)</h3>
            <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                <i className="fas fa-folder-open fa-2x mb-2"></i>
                <p>L'historique des consultations pour ce patient sera bientôt disponible ici.</p>
            </div>
        </div>

        <div className="mt-10 pt-6 border-t">
            <Link to="/patients" className="text-blue-600 hover:text-blue-800 font-medium">
                <i className="fas fa-arrow-left mr-2"></i> Retour à la liste des patients
            </Link>
        </div>
      </div>
    </div>
  );
};

export default PatientDetailPage;
