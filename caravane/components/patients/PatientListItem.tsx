

import React from 'react';
import { Link } from 'react-router-dom';
import { Patient, PatientSexe } from '../../types';
import { formatDate } from '../../utils/helpers';

interface PatientListItemProps {
  patient: Patient; 
  onDeletePatient: (id: string) => void;
  onEditPatientDemographics: (patient: Patient) => void; 
  
  canEditPatientDemographics: boolean; 
  canDeletePatient: boolean;
  canViewPatientDetails: boolean;
  
  isGPContext?: boolean;
  gpCanStartConsultationPermission?: boolean; 

  isSpecialistContext?: boolean;
  specialistCanStartOrEditConsultationPermission?: boolean;
  existingConsultationIdBySpecialist?: string; // This will be undefined for specialists on PatientsPage due to new filtering
}

const PatientListItem: React.FC<PatientListItemProps> = ({ 
  patient, 
  onDeletePatient, 
  onEditPatientDemographics,
  canEditPatientDemographics,
  canDeletePatient,
  canViewPatientDetails,
  isGPContext,
  gpCanStartConsultationPermission,
  isSpecialistContext,
  specialistCanStartOrEditConsultationPermission,
  existingConsultationIdBySpecialist, 
}) => {

  return (
    <tr className="bg-white border-b hover:bg-gray-50 transition duration-150 ease-in-out">
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{patient.numero_unique}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.prenom} {patient.nom}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.cin}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.age}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
        {patient.sexe === PatientSexe.MASCULIN ? 'Masculin' : 'Féminin'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{patient.telephone || 'N/A'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(patient.created_at)}</td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
        {canViewPatientDetails && (
          <Link
            to={`/patients/${patient.id}`}
            className="text-blue-600 hover:text-blue-800 transition-colors duration-150"
            title="Voir Détails Patient"
          >
            <i className="fas fa-eye"></i>
          </Link>
        )}

        {isGPContext && patient.est_oriente_generaliste && gpCanStartConsultationPermission && (
          <Link
            to={`/consultations/new`}
            state={{ patientIdFromAccueilReferral: patient.id, patientNom: `${patient.prenom} ${patient.nom}` }}
            className="text-green-500 hover:text-green-700 transition-colors duration-150"
            title="Démarrer Consultation et Orientation"
          >
            <i className="fas fa-stethoscope"></i>
          </Link>
        )}
        
        {isSpecialistContext && specialistCanStartOrEditConsultationPermission && (
          // On the PatientsPage for a specialist, `existingConsultationIdBySpecialist` will be undefined
          // because already consulted patients are filtered out. Thus, "Démarrer Consultation" is shown.
          // If this component were reused on a page where a specialist *can* see patients they've already
          // consulted, then `existingConsultationIdBySpecialist` would be relevant there.
          existingConsultationIdBySpecialist ? (
            <Link
              to={`/consultations/edit/${existingConsultationIdBySpecialist}`}
              className="text-purple-500 hover:text-purple-700 transition-colors duration-150"
              title="Voir/Modifier Consultation"
            >
              <i className="fas fa-file-medical-alt"></i>
            </Link>
          ) : (
            <Link
              to={`/consultations/new`}
              state={{ patientIdFromSpecialistList: patient.id, patientNom: `${patient.prenom} ${patient.nom}` }}
              className="text-green-500 hover:text-green-700 transition-colors duration-150"
              title="Démarrer Consultation"
            >
              <i className="fas fa-stethoscope"></i>
            </Link>
          )
        )}
        
        {!isGPContext && !isSpecialistContext && canEditPatientDemographics && (
            <button
              onClick={() => onEditPatientDemographics(patient)}
              className="text-yellow-500 hover:text-yellow-700 transition-colors duration-150"
              title="Modifier Fiche Patient"
            >
              <i className="fas fa-user-edit"></i>
            </button>
        )}

        {canDeletePatient && (
          <button
            onClick={() => onDeletePatient(patient.id)}
            className="text-red-600 hover:text-red-800 transition-colors duration-150"
            title="Supprimer Patient"
          >
            <i className="fas fa-trash"></i>
          </button>
        )}
      </td>
    </tr>
  );
};

export default PatientListItem;
