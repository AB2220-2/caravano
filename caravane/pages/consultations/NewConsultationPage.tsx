
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ConsultationFormData, ValidationErrors, UserRole, ConsultationType, ConsultationStatut, Specialite,
  Patient, Caravane, User,
  CaravaneStatut
} from '../../types';
import consultationService from '../../services/consultationService';
import patientService from '../../services/patientService';
import caravaneService from '../../services/caravaneService';
import userService from '../../services/userService';
import { validateConsultationForm } from '../../utils/validators';
import { useAuth } from '../../contexts/AuthContext';
import { SPECIALTIES_LIST, USER_ROLES_CONFIG, MOCK_USERS, MOCK_CARAVANES } from '../../constants';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const initialValidationCheckFormData: ConsultationFormData = {
    patient_id: '',
    caravane_id: '',
    medecin_id: '',
    type_consultation: ConsultationType.GENERALE,
    notes: '',
    statut: ConsultationStatut.EN_COURS,
    specialite: undefined,
    diagnostic: '',
    orientation: '',
    oriented_to_medecin_id: undefined,
    oriented_to_specialties: [],
    hors_champ_specialite_caravane: false,
    scanner_effectue: false,
    orientation_chu: false,
    suivi_necessaire: false,
    date_prochain_rdv: undefined, // Added for validation check consistency
};

const NewConsultationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, hasPermission } = useAuth();

  const [formData, setFormData] = useState<ConsultationFormData>({
    patient_id: '',
    caravane_id: '',
    medecin_id: '',
    type_consultation: ConsultationType.GENERALE,
    specialite: undefined,
    notes: '',
    diagnostic: '',
    orientation: '',
    oriented_to_medecin_id: undefined,
    oriented_to_specialties: [],
    hors_champ_specialite_caravane: false,
    scanner_effectue: false,
    orientation_chu: false,
    suivi_necessaire: false,
    statut: ConsultationStatut.EN_COURS,
    date_prochain_rdv: undefined,
  });

  const [patients, setPatients] = useState<Patient[]>([]);
  const [caravanes, setCaravanes] = useState<Caravane[]>([]);
  const [medecins, setMedecins] = useState<User[]>([]);
  const [specialistDoctors, setSpecialistDoctors] = useState<User[]>([]);
  const [displayPatientInfo, setDisplayPatientInfo] = useState<{ id: string, prenom: string, nom: string, cin: string } | null>(null); 
  const [specialistWorkload, setSpecialistWorkload] = useState<Record<string, number>>({}); 
  const [isLoadingWorkload, setIsLoadingWorkload] = useState(false); 


  const [errors, setErrors] = useState<ValidationErrors<ConsultationFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [submitMessage, setSubmitMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const canAddConsultation = hasPermission('add_consultations');
  const isGP = currentUser?.role === UserRole.MEDECIN_GENERALISTE;
  const isSpecialistUser = currentUser?.role === UserRole.MEDECIN_SPECIALISTE;
  const orientationSpecialtiesForCheckboxes: Specialite[] = [Specialite.NEUROLOGIE, Specialite.PSYCHIATRIE, Specialite.NEUROCHIRURGIE];


  useEffect(() => {
    if (!currentUser) return;

    let newFormUpdates: Partial<ConsultationFormData> = {
        oriented_to_specialties: [],
        hors_champ_specialite_caravane: false,
        scanner_effectue: false,
        orientation_chu: false,
        suivi_necessaire: false,
        date_prochain_rdv: undefined,
    };

    if (currentUser.role === UserRole.MEDECIN_GENERALISTE || currentUser.role === UserRole.MEDECIN_SPECIALISTE) {
        newFormUpdates.medecin_id = currentUser.id;
        const userProfile = MOCK_USERS.find(u => u.id === currentUser.id); 

        if (currentUser.role === UserRole.MEDECIN_SPECIALISTE) {
            newFormUpdates.type_consultation = ConsultationType.SPECIALISEE;
            newFormUpdates.specialite = currentUser.specialite || userProfile?.specialite;
            newFormUpdates.statut = ConsultationStatut.EN_COURS; // Default for specialist
        } else if (currentUser.role === UserRole.MEDECIN_GENERALISTE) {
            newFormUpdates.type_consultation = ConsultationType.GENERALE;
            newFormUpdates.specialite = Specialite.GENERALE;
            newFormUpdates.statut = ConsultationStatut.TERMINEE; // Default for GP orientation
        }
    }

    const routeState = location.state as { patientIdFromAccueilReferral?: string, patientIdFromSpecialistList?: string, patientNom?: string } | null;
    let patientIdFromState: string | undefined = undefined;

    if (isGP && routeState?.patientIdFromAccueilReferral) {
        patientIdFromState = routeState.patientIdFromAccueilReferral;
    } else if (isSpecialistUser && routeState?.patientIdFromSpecialistList) {
        patientIdFromState = routeState.patientIdFromSpecialistList;
    }
    
    if (patientIdFromState && routeState?.patientNom) {
        const patientName = routeState.patientNom;
        const nameParts = patientName.split(' ');
        const prenom = nameParts[0] || '';
        const nom = nameParts.slice(1).join(' ') || '';

        newFormUpdates.patient_id = patientIdFromState;
        setDisplayPatientInfo({ id: patientIdFromState, prenom, nom, cin: 'Chargement...' }); 

        
        navigate(location.pathname, { replace: true, state: {} });
    }


    if (Object.keys(newFormUpdates).length > 0) {
        setFormData(prev => ({ ...prev, ...newFormUpdates }));
    }

  }, [currentUser, location, navigate, isGP, isSpecialistUser]);

  const fetchSpecialistWorkload = useCallback(async () => {
    if (!isGP && !isSpecialistUser) return; 
    setIsLoadingWorkload(true);
    try {
      const allConsultationsResponse = await consultationService.getConsultations({ limit: 99999 });
      const workload: Record<string, number> = {};
      allConsultationsResponse.data.forEach(consult => {
        if (consult.oriented_to_medecin_id) {
          workload[consult.oriented_to_medecin_id] = (workload[consult.oriented_to_medecin_id] || 0) + 1;
        }
      });
      setSpecialistWorkload(workload);
    } catch (error) {
      console.error("Failed to fetch specialist workload:", error);
    } finally {
      setIsLoadingWorkload(false);
    }
  }, [isGP, isSpecialistUser]);

  const fetchDataForForm = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const [patientsRes, caravanesRes, usersRes] = await Promise.all([
        patientService.getPatients({ limit: 1000 }), 
        caravaneService.getCaravanes({ limit: 1000 }),
        userService.getUsers({ limit: 1000 })
      ]);
      setPatients(patientsRes.data);
      setCaravanes(caravanesRes.data.filter(c => c.statut === CaravaneStatut.EN_COURS || c.statut === CaravaneStatut.PLANIFIEE));

      const allDoctors = usersRes.data.filter(u => u.role === UserRole.MEDECIN_GENERALISTE || u.role === UserRole.MEDECIN_SPECIALISTE);
      setMedecins(allDoctors);
      setSpecialistDoctors(allDoctors.filter(u => u.role === UserRole.MEDECIN_SPECIALISTE));

      if ((isGP || isSpecialistUser) && formData.patient_id && displayPatientInfo?.cin === 'Chargement...') {
          const patientDetails = await patientService.getPatientById(formData.patient_id);
          if (patientDetails && displayPatientInfo) { 
              setDisplayPatientInfo({
                  ...displayPatientInfo, 
                  cin: patientDetails.cin
              });
          }
      }
      fetchSpecialistWorkload();

    } catch (error) {
      console.error("Failed to fetch data for consultation form:", error);
      setSubmitMessage({type: 'error', text: 'Erreur de chargement des données du formulaire.'});
    } finally {
      setIsDataLoading(false);
    }
  }, [isGP, isSpecialistUser, fetchSpecialistWorkload, formData.patient_id, displayPatientInfo]);

  useEffect(() => {
    if (canAddConsultation) {
      fetchDataForForm();
    }
  }, [canAddConsultation, fetchDataForForm]);


  if (!canAddConsultation && !isDataLoading) {
    return (
        <div className="text-center py-20 bg-white rounded-lg shadow-xl p-8">
            <i className="fas fa-exclamation-triangle fa-3x text-red-500 mb-4"></i>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">Accès Refusé</h2>
            <p className="text-gray-500">Vous n'avez pas les permissions nécessaires pour ajouter une consultation.</p>
            <Link to="/consultations" className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-150">
                Retour aux consultations
            </Link>
        </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (errors[name as keyof ConsultationFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }

    let newFormData = { ...formData };

    if (type === 'checkbox') {
        const targetCheckbox = e.target as HTMLInputElement;
        const checked = targetCheckbox.checked;

        if (name.startsWith('oriented_specialty_')) {
            const specialtyValue = value as Specialite;
            let updatedSpecialties = [...(newFormData.oriented_to_specialties || [])];
            if (checked) {
                if (!updatedSpecialties.includes(specialtyValue)) {
                    updatedSpecialties.push(specialtyValue);
                }
            } else {
                updatedSpecialties = updatedSpecialties.filter(s => s !== specialtyValue);
            }
            newFormData.oriented_to_specialties = updatedSpecialties;

            if (newFormData.oriented_to_medecin_id) {
                const med = specialistDoctors.find(d => d.id === newFormData.oriented_to_medecin_id);
                if (med && med.specialite && updatedSpecialties.length > 0 && !updatedSpecialties.includes(med.specialite)) {
                    newFormData.oriented_to_medecin_id = undefined;
                } else if (updatedSpecialties.length === 0) { 
                    newFormData.oriented_to_medecin_id = undefined;
                }
            }

        } else if (name === 'suivi_necessaire' && isSpecialistUser) {
            newFormData.suivi_necessaire = checked;
            if (!checked) {
                newFormData.date_prochain_rdv = undefined; // Clear date if checkbox is unchecked
                 if (errors.date_prochain_rdv) {
                    setErrors(prev => ({...prev, date_prochain_rdv: undefined}));
                }
            }
        }
        else {
            (newFormData as any)[name] = checked;
        }
    } else if (name === 'type_consultation') {
        const newType = value as ConsultationType;
        newFormData.type_consultation = newType;
        if (newType === ConsultationType.GENERALE) {
            newFormData.specialite = Specialite.GENERALE;
            if (!isGP) { 
                 newFormData.oriented_to_medecin_id = undefined;
                 newFormData.oriented_to_specialties = [];
            }
        } else { 
            const currentMedecin = medecins.find(m => m.id === newFormData.medecin_id);
            newFormData.specialite = (currentMedecin?.role === UserRole.MEDECIN_SPECIALISTE && currentMedecin.specialite)
                                 ? currentMedecin.specialite
                                 : (newFormData.specialite === Specialite.GENERALE ? undefined : newFormData.specialite);
        }
    } else if (name === 'medecin_id') {
        const medecinId = value;
        newFormData.medecin_id = medecinId; 

        if (medecinId === '') { 
            newFormData.type_consultation = ConsultationType.GENERALE;
            newFormData.specialite = Specialite.GENERALE;
        } else {
            const selectedMedecin = medecins.find(m => m.id === medecinId);
            if (selectedMedecin) {
                if (selectedMedecin.role === UserRole.MEDECIN_SPECIALISTE) {
                    newFormData.type_consultation = ConsultationType.SPECIALISEE;
                    newFormData.specialite = selectedMedecin.specialite;
                } else if (selectedMedecin.role === UserRole.MEDECIN_GENERALISTE) {
                    newFormData.type_consultation = ConsultationType.GENERALE;
                    newFormData.specialite = Specialite.GENERALE;
                }
            } else {
                newFormData.type_consultation = ConsultationType.GENERALE;
                newFormData.specialite = Specialite.GENERALE;
            }
        }
    } else if (name === 'specialite') {
        const newSpecialite = value === '' ? undefined : value as Specialite;
        newFormData.specialite = newSpecialite;
        if (newFormData.oriented_to_medecin_id) {
            const orientedDoc = specialistDoctors.find(doc => doc.id === newFormData.oriented_to_medecin_id);
            if (orientedDoc && orientedDoc.specialite !== newSpecialite) {
                newFormData.oriented_to_medecin_id = undefined;
            }
        }
    } else if (name === 'oriented_to_medecin_id'){
        newFormData.oriented_to_medecin_id = value === '' ? undefined : value;
    } else {
      if (name === 'statut') {
        (newFormData as ConsultationFormData).statut = value as ConsultationStatut;
      } else if (name === 'date_prochain_rdv') {
        newFormData.date_prochain_rdv = value === '' ? undefined : value;
      }
      else {
        (newFormData as any)[name] = value;
      }
    }
    setFormData(newFormData);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);

    let finalFormData = { ...formData };

    if (isGP) {
        finalFormData.type_consultation = ConsultationType.GENERALE;
        finalFormData.specialite = Specialite.GENERALE;
        if (!finalFormData.notes) finalFormData.notes = "Orientation par médecin généraliste.";
        finalFormData.statut = ConsultationStatut.TERMINEE;
    } else if (isSpecialistUser) {
        finalFormData.type_consultation = ConsultationType.SPECIALISEE;
        finalFormData.specialite = currentUser?.specialite; 
        if (!finalFormData.medecin_id) finalFormData.medecin_id = currentUser!.id;
        finalFormData.notes = ""; // Notes field is hidden for specialist, submit empty or default
        finalFormData.statut = ConsultationStatut.EN_COURS;
        if (!finalFormData.suivi_necessaire) { // If suivi not necessary, clear date
            finalFormData.date_prochain_rdv = undefined;
        }
    } else if (finalFormData.type_consultation === ConsultationType.GENERALE) {
        finalFormData.specialite = Specialite.GENERALE;
    }
    
    if (!finalFormData.caravane_id) { 
        const enCoursCaravane = caravanes.find(c => c.statut === CaravaneStatut.EN_COURS);
        if (enCoursCaravane) finalFormData.caravane_id = enCoursCaravane.id;
        else if (caravanes.length > 0) finalFormData.caravane_id = caravanes[0].id;
        else if (MOCK_CARAVANES.length > 0) finalFormData.caravane_id = MOCK_CARAVANES[0].id; 
    }


    const validationErrors = validateConsultationForm(finalFormData, isGP, isSpecialistUser);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      setIsLoading(true);
      try {
        await consultationService.addConsultation(finalFormData);
        setSubmitMessage({type: 'success', text: (isGP || isSpecialistUser) ? 'Enregistré avec succès!' : 'Consultation enregistrée avec succès!'});

        setTimeout(() => {
            navigate('/consultations');
        }, 1500);

        let resetSpecialite: Specialite | undefined = undefined;
        let resetTypeConsultation = ConsultationType.GENERALE;
        let resetMedecinId = '';
        let resetStatut = ConsultationStatut.EN_COURS;

        if (currentUser) {
            resetMedecinId = currentUser.id;
            if (currentUser.role === UserRole.MEDECIN_SPECIALISTE) {
                resetTypeConsultation = ConsultationType.SPECIALISEE;
                resetSpecialite = currentUser.specialite;
                resetStatut = ConsultationStatut.EN_COURS;
            } else if (currentUser.role === UserRole.MEDECIN_GENERALISTE) {
                resetTypeConsultation = ConsultationType.GENERALE;
                resetSpecialite = Specialite.GENERALE;
                resetStatut = ConsultationStatut.TERMINEE;
            } else { 
                 resetMedecinId = '';
            }
        }


        setFormData({
            patient_id: '', caravane_id: '',
            medecin_id: resetMedecinId,
            type_consultation: resetTypeConsultation,
            specialite: resetSpecialite,
            notes: '', diagnostic: '', orientation: '', oriented_to_medecin_id: undefined,
            oriented_to_specialties: [], hors_champ_specialite_caravane: false,
            scanner_effectue: false, orientation_chu: false, suivi_necessaire: false, statut: resetStatut,
            date_prochain_rdv: undefined,
        });
        setDisplayPatientInfo(null);
      } catch (error) {
        console.error("Failed to save consultation:", error);
        setSubmitMessage({type: 'error', text: 'Erreur lors de l\'enregistrement.'});
      } finally {
        setIsLoading(false);
      }
    }
  };

  const FormField: React.FC<{label: React.ReactNode, name: keyof ConsultationFormData, error?: string, children: React.ReactNode, isRequired?: boolean, isHidden?: boolean}> = ({label, name, error, children, isRequired, isHidden}) => {
    if (isHidden) return null;
    // For dynamic required, the asterisk will be part of the label prop if needed
    const isActuallyRequired = isRequired ?? !!(validateConsultationForm(initialValidationCheckFormData, isGP, isSpecialistUser)[name]);
    
    const labelContent = typeof label === 'string' && isActuallyRequired && !label.includes('*')
        ? <>{label} <span className="text-red-500">*</span></>
        : label;

    return (
        <div className="mb-4">
        <label htmlFor={name as string} className="block text-sm font-medium text-gray-700 mb-1">
            {labelContent}
        </label>
        {children}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    );
  };

  const getFilteredSpecialistDoctors = () => {
    if (isGP && formData.oriented_to_specialties && formData.oriented_to_specialties.length > 0) {
        return specialistDoctors.filter(doc => doc.specialite && formData.oriented_to_specialties?.includes(doc.specialite));
    }
    
    if (!isGP && formData.type_consultation === ConsultationType.SPECIALISEE && formData.specialite && formData.specialite !== Specialite.GENERALE) {
        return specialistDoctors.filter(doc => doc.specialite === formData.specialite);
    }
    return specialistDoctors;
  };

  if (isDataLoading && !displayPatientInfo) { 
    return <div className="flex justify-center items-center h-64"><LoadingSpinner message="Chargement des données du formulaire..." size="lg"/></div>;
  }

  const currentFormContextTitle = isGP ? "Orienter le Patient" : (isSpecialistUser ? "Saisir Consultation Spécialiste" : "Nouvelle Consultation");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold text-gray-800">{currentFormContextTitle}</h2>
        <Link to="/consultations" className="text-sm text-blue-600 hover:underline flex items-center">
          <i className="fas fa-arrow-left mr-2"></i> Retour à la liste
        </Link>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-2">
            {submitMessage && (
                <div className={`p-3 mb-4 rounded-md text-sm ${submitMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {submitMessage.text}
                </div>
            )}

            {(isGP || isSpecialistUser) && displayPatientInfo && (
                <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Patient Concerné</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                        <div><span className="text-gray-500">Prénom: </span><span className="font-medium text-gray-800">{displayPatientInfo.prenom}</span></div>
                        <div><span className="text-gray-500">Nom: </span><span className="font-medium text-gray-800">{displayPatientInfo.nom}</span></div>
                        <div><span className="text-gray-500">CIN: </span><span className="font-medium text-gray-800">{displayPatientInfo.cin}</span></div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <FormField label="Patient" name="patient_id" error={errors.patient_id} isHidden={isGP || isSpecialistUser}>
                    <select name="patient_id" id="patient_id" value={formData.patient_id} onChange={handleChange}
                        className={`w-full px-3 py-2 border ${errors.patient_id ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`}>
                        <option value="" disabled>-- Sélectionner Patient --</option>
                        {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.cin})</option>)}
                    </select>
                </FormField>
                <FormField label="Caravane" name="caravane_id" error={errors.caravane_id} isHidden={isGP || isSpecialistUser}>
                    <select name="caravane_id" id="caravane_id" value={formData.caravane_id} onChange={handleChange}
                        className={`w-full px-3 py-2 border ${errors.caravane_id ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`}>
                        <option value="" disabled>-- Sélectionner Caravane --</option>
                        {caravanes.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.lieu})</option>)}
                    </select>
                </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <FormField label="Médecin Traitant" name="medecin_id" error={errors.medecin_id} isHidden={isGP || isSpecialistUser}>
                    <select name="medecin_id" id="medecin_id" value={formData.medecin_id} onChange={handleChange}
                        className={`w-full px-3 py-2 border ${errors.medecin_id ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`}>
                        <option value="" disabled>-- Sélectionner Médecin --</option>
                        {medecins.map(m => <option key={m.id} value={m.id}>{m.prenom} {m.nom} ({USER_ROLES_CONFIG[m.role].name})</option>)}
                    </select>
                </FormField>
                 <FormField label="Type de Consultation" name="type_consultation" error={errors.type_consultation} isHidden={isGP || isSpecialistUser}>
                    <select name="type_consultation" id="type_consultation" value={formData.type_consultation} onChange={handleChange}
                        className={`w-full px-3 py-2 border ${errors.type_consultation ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`}>
                        {Object.values(ConsultationType).map(ct => <option key={ct} value={ct}>{ct.charAt(0).toUpperCase() + ct.slice(1)}</option>)}
                    </select>
                </FormField>
            </div>

            <FormField
                label="Spécialité Demandée"
                name="specialite"
                error={errors.specialite}
                isRequired={!isGP && !isSpecialistUser && formData.type_consultation === ConsultationType.SPECIALISEE}
                isHidden={isGP || isSpecialistUser || formData.type_consultation !== ConsultationType.SPECIALISEE}
            >
                <select name="specialite" id="specialite" value={formData.specialite || ''} onChange={handleChange}
                    className={`w-full px-3 py-2 border ${errors.specialite ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`}>
                    <option value="" disabled>-- Sélectionner Spécialité --</option>
                    {SPECIALTIES_LIST.filter(s => s !== Specialite.GENERALE).map(spec => <option key={spec} value={spec}>{spec}</option>)}
                </select>
            </FormField>

            {isGP && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Orienter vers Spécialité(s) :</label>
                    <div className="mt-2 space-y-2 sm:space-y-0 sm:flex sm:space-x-6">
                        {orientationSpecialtiesForCheckboxes.map(spec => (
                            <div key={spec} className="flex items-center">
                                <input
                                    id={`oriented_specialty_${spec}`}
                                    name={`oriented_specialty_${spec}`}
                                    type="checkbox"
                                    value={spec}
                                    checked={formData.oriented_to_specialties?.includes(spec) || false}
                                    onChange={handleChange}
                                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor={`oriented_specialty_${spec}`} className="ml-2 text-sm text-gray-700">
                                    {spec}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <FormField 
                label={isGP ? "Notes d'Orientation (Optionnel)" : "Observations / Notes Cliniques"} 
                name="notes" 
                error={errors.notes} 
                isRequired={!isGP && !isSpecialistUser} 
                isHidden={isSpecialistUser} 
            >
                <textarea name="notes" id="notes" value={formData.notes} onChange={handleChange} rows={isGP ? 2 : 4}
                    className={`w-full px-3 py-2 border ${errors.notes ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`}></textarea>
            </FormField>

            <FormField 
                label="Orienter vers Médecin Spécialiste (Optionnel)" 
                name="oriented_to_medecin_id" 
                error={errors.oriented_to_medecin_id} 
                isHidden={isSpecialistUser || (!isGP && !(formData.type_consultation === ConsultationType.SPECIALISEE || formData.orientation?.trim()))}
            >
                <select
                    name="oriented_to_medecin_id"
                    id="oriented_to_medecin_id"
                    value={formData.oriented_to_medecin_id || ''}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border ${errors.oriented_to_medecin_id ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`}
                >
                    <option value="">-- Aucun Médecin Spécifique --</option>
                    {getFilteredSpecialistDoctors().map(doc => (
                        <option key={doc.id} value={doc.id}>
                            Dr. {doc.prenom} {doc.nom} ({doc.specialite})
                             {(isLoadingWorkload && (isGP || isSpecialistUser)) ? ' (chargement...)' : (specialistWorkload[doc.id] !== undefined ? ` - ${specialistWorkload[doc.id]} patient(s)` : '')}
                        </option>
                    ))}
                </select>
            </FormField>

            {isGP && (
                 <FormField label="" name="hors_champ_specialite_caravane">
                    <div className="flex items-center">
                        <input type="checkbox" name="hors_champ_specialite_caravane" id="hors_champ_specialite_caravane" checked={formData.hors_champ_specialite_caravane || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                        <label htmlFor="hors_champ_specialite_caravane" className="ml-2 text-sm text-gray-700">Hors champ de spécialité de la caravane</label>
                    </div>
                </FormField>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                 <FormField label="Diagnostic (Optionnel)" name="diagnostic" error={errors.diagnostic} isHidden={isGP && !isSpecialistUser}>
                    <input type="text" name="diagnostic" id="diagnostic" value={formData.diagnostic || ''} onChange={handleChange}
                        className={`w-full px-3 py-2 border ${errors.diagnostic ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`} />
                </FormField>
                 <FormField label="Orientation (Notes Générales)" name="orientation" error={errors.orientation} isHidden={isSpecialistUser && !isGP}>
                     <input type="text" name="orientation" id="orientation" value={formData.orientation || ''} onChange={handleChange}
                        placeholder="Ex: Référer à Neurologie pour céphalées chroniques"
                        className={`w-full px-3 py-2 border ${errors.orientation ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`} />
                </FormField>
            </div>
            
            {(isSpecialistUser) && (
              <div className="pt-4 mt-4 border-t">
                <h3 className="text-md font-medium text-gray-700 mb-2">Actions et Suivi (Spécialiste)</h3>
                <div className="space-y-3">
                    <FormField label="" name="scanner_effectue" error={errors.scanner_effectue}>
                        <div className="flex items-center">
                            <input type="checkbox" name="scanner_effectue" id="scanner_effectue_spec" checked={formData.scanner_effectue} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor="scanner_effectue_spec" className="ml-2 text-sm text-gray-700">Bénéficier d’un scanner – dans Hôpital</label>
                        </div>
                    </FormField>
                    <FormField label="" name="orientation_chu" error={errors.orientation_chu}>
                        <div className="flex items-center">
                            <input type="checkbox" name="orientation_chu" id="orientation_chu_spec" checked={formData.orientation_chu} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor="orientation_chu_spec" className="ml-2 text-sm text-gray-700">Suivi CHU</label>
                        </div>
                    </FormField>
                    <FormField label="" name="suivi_necessaire" error={errors.suivi_necessaire}>
                        <div className="flex items-center">
                            <input type="checkbox" name="suivi_necessaire" id="suivi_necessaire_spec" checked={formData.suivi_necessaire} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor="suivi_necessaire_spec" className="ml-2 text-sm text-gray-700">Rendez-vous prochain</label>
                        </div>
                    </FormField>
                    {formData.suivi_necessaire && (
                         <FormField 
                            label={<>Date du prochain rendez-vous <span className="text-red-500">*</span></>} 
                            name="date_prochain_rdv" 
                            error={errors.date_prochain_rdv}
                         >
                            <input
                                type="date"
                                name="date_prochain_rdv"
                                id="date_prochain_rdv_spec"
                                value={formData.date_prochain_rdv || ''}
                                onChange={handleChange}
                                className={`mt-1 block w-full md:w-1/2 px-3 py-2 border ${errors.date_prochain_rdv ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                            />
                        </FormField>
                    )}
                </div>
              </div>
            )}
            
            <FormField label="Statut de la Consultation" name="statut" error={errors.statut} isHidden={isGP || isSpecialistUser}>
                <select name="statut" id="statut" value={formData.statut} onChange={handleChange}
                    className={`w-full md:w-1/2 px-3 py-2 border ${errors.statut ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`}>
                    {Object.values(ConsultationStatut).map(cs => <option key={cs} value={cs}>{cs.charAt(0).toUpperCase() + cs.slice(1).replace('_', ' ')}</option>)}
                </select>
            </FormField>

          <div className="flex justify-end pt-4 space-x-3">
             <button type="button" onClick={() => navigate('/consultations')}
                className="px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                disabled={isLoading}
             >
                Annuler
            </button>
            <button type="submit" disabled={isLoading || isDataLoading}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
              {isLoading ? (
                <><LoadingSpinner size="sm" /> Enregistrement...</>
              ) : ( <><i className="fas fa-plus-circle mr-2"></i>{currentFormContextTitle}</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewConsultationPage;
