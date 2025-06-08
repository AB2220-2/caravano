
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CaravaneFormData, CaravaneStatut, Specialite, ValidationErrors, UserRole, User } from '../../types';
import { SPECIALTIES_LIST } from '../../constants';
import caravaneService from '../../services/caravaneService';
import userService from '../../services/userService'; 
import { validateCaravaneForm } from '../../utils/validators';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Interface for FormField props for clarity
interface FormFieldProps {
  label: React.ReactNode; // Changed to React.ReactNode to allow dynamic content like counts
  name: keyof CaravaneFormData;
  error?: string;
  children: React.ReactElement<{ className?: string; [key: string]: any }>; // Type children more specifically
  isMultiSelect?: boolean;
  selectHeight?: string;
  infoText?: React.ReactNode; // New prop for informational text
}

const FormField: React.FC<FormFieldProps> = ({ label, name, error, children, isMultiSelect, selectHeight = 'h-32', infoText }) => {
  let elementToRender = children;

  if (isMultiSelect) {
    const originalElementProps = children.props; 
    const currentClassName = originalElementProps.className || '';
    const newClassName = `${currentClassName} ${selectHeight}`.trim();
    
    elementToRender = React.cloneElement(children, { 
      ...originalElementProps, // Spread original props to preserve them
      className: newClassName  // Override className
    });
  }

  return (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {elementToRender}
      {infoText && <div className="mt-1 text-xs text-gray-500">{infoText}</div>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};


const PlanCaravanePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState<CaravaneFormData>({
    nom: '',
    date_caravane: '',
    lieu: '',
    specialites_couvertes: [],
    statut: CaravaneStatut.PLANIFIEE,
    selectedGPIds: [],
    selectedSpecialistIds: [],
    selectedAccueilIds: [],
  });
  const [errors, setErrors] = useState<ValidationErrors<CaravaneFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [submitMessage, setSubmitMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [availableGPs, setAvailableGPs] = useState<User[]>([]);
  const [availableSpecialists, setAvailableSpecialists] = useState<User[]>([]);
  const [availableAccueilStaff, setAvailableAccueilStaff] = useState<User[]>([]);

  useEffect(() => {
    const fetchStaff = async () => {
      setIsDataLoading(true);
      try {
        const usersResponse = await userService.getUsers({ limit: 1000 }); // Fetch all users
        const activeUsers = usersResponse.data.filter(u => u.actif);
        
        setAvailableGPs(activeUsers.filter(u => u.role === UserRole.MEDECIN_GENERALISTE));
        setAvailableSpecialists(activeUsers.filter(u => u.role === UserRole.MEDECIN_SPECIALISTE));
        setAvailableAccueilStaff(activeUsers.filter(u => u.role === UserRole.ACCUEIL));
      } catch (error) {
        console.error("Failed to fetch staff for caravane planning:", error);
        setSubmitMessage({type: 'error', text: 'Erreur lors du chargement du personnel médical.'});
      } finally {
        setIsDataLoading(false);
      }
    };

    if (currentUser?.role === UserRole.ADMIN) {
      fetchStaff();
    } else {
      setIsDataLoading(false); // No data to load if not admin
    }
  }, [currentUser]);


  if (currentUser?.role !== UserRole.ADMIN) {
    return (
        <div className="text-center py-20 bg-white rounded-lg shadow-xl p-8">
            <i className="fas fa-exclamation-triangle fa-3x text-red-500 mb-4"></i>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">Accès Refusé</h2>
            <p className="text-gray-500">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
            <Link to="/caravanes" className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-150">
                Retour aux caravanes
            </Link>
        </div>
    );
  }


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof CaravaneFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>, fieldName: keyof CaravaneFormData) => {
    const { options } = e.target;
    const selectedValues = Array.from(options)
      .filter(option => option.selected)
      .map(option => option.value as string); 

    if (fieldName === 'specialites_couvertes') {
         setFormData(prev => ({ ...prev, [fieldName]: selectedValues as Specialite[] }));
    } else {
         setFormData(prev => ({ ...prev, [fieldName]: selectedValues }));
    }

     if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);
    const validationErrors = validateCaravaneForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      setIsLoading(true);
      try {
        await caravaneService.addCaravane(formData);
        setSubmitMessage({type: 'success', text: 'Caravane planifiée avec succès!'});
        
        setTimeout(() => {
            navigate('/caravanes');
        }, 1500);
        setFormData({ 
            nom: '', date_caravane: '', lieu: '', specialites_couvertes: [], statut: CaravaneStatut.PLANIFIEE,
            selectedGPIds: [], selectedSpecialistIds: [], selectedAccueilIds: [],
        });
      } catch (error) {
        console.error("Failed to plan caravane:", error);
        setSubmitMessage({type: 'error', text: 'Erreur lors de la planification de la caravane.'});
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  if (isDataLoading) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner message="Chargement du personnel..." /></div>;
  }

  const renderSelectionCount = (count: number) => {
    if (count > 0) {
      return <span className="text-xs text-gray-500 ml-1">({count} sélectionné{count > 1 ? 's' : ''})</span>;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold text-gray-800">Planifier une Nouvelle Caravane</h2>
        <Link 
          to="/caravanes" 
          className="text-sm text-blue-600 hover:underline flex items-center"
        >
          <i className="fas fa-arrow-left mr-2"></i> Retour à la liste des caravanes
        </Link>
      </div>
      
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-2">
            {submitMessage && (
                <div className={`p-3 mb-4 rounded-md text-sm ${submitMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {submitMessage.text}
                </div>
            )}
          <FormField label="Nom de la Caravane" name="nom" error={errors.nom}>
            <input
              type="text"
              name="nom"
              id="nom"
              value={formData.nom}
              onChange={handleChange}
              className={`mt-1 block w-full px-3 py-2 border ${errors.nom ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6"> 
            <FormField label="Date de la Caravane" name="date_caravane" error={errors.date_caravane}>
              <input
                type="date"
                name="date_caravane"
                id="date_caravane"
                value={formData.date_caravane}
                onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 border ${errors.date_caravane ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
              />
            </FormField>
            <FormField label="Lieu" name="lieu" error={errors.lieu}>
              <input
                type="text"
                name="lieu"
                id="lieu"
                value={formData.lieu}
                onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 border ${errors.lieu ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
              />
            </FormField>
          </div>

          <FormField 
            label={<>Spécialités Couvertes (maintenez Ctrl/Cmd pour sélectionner plusieurs) {renderSelectionCount(formData.specialites_couvertes.length)}</>}
            name="specialites_couvertes" 
            error={errors.specialites_couvertes} 
            isMultiSelect
          >
            <select
              multiple
              name="specialites_couvertes"
              id="specialites_couvertes"
              value={formData.specialites_couvertes}
              onChange={(e) => handleMultiSelectChange(e, 'specialites_couvertes')}
              className={`mt-1 block w-full px-3 py-2 border ${errors.specialites_couvertes ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            >
              {SPECIALTIES_LIST.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Statut" name="statut" error={errors.statut}>
            <select
              name="statut"
              id="statut"
              value={formData.statut}
              onChange={handleChange}
              className={`mt-1 block w-full px-3 py-2 border ${errors.statut ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            >
              {Object.values(CaravaneStatut).map(stat => (
                <option key={stat} value={stat}>
                  {stat.charAt(0).toUpperCase() + stat.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </FormField>

          <h3 className="text-lg font-medium text-gray-900 pt-4 border-t mt-6 mb-2">Assigner l'Équipe Médicale</h3>
            
          <FormField 
            label={<>Médecins Généralistes (maintenez Ctrl/Cmd pour sélectionner plusieurs) {renderSelectionCount(formData.selectedGPIds?.length || 0)}</>}
            name="selectedGPIds" 
            error={errors.selectedGPIds} 
            isMultiSelect 
            selectHeight="h-24"
            infoText={availableGPs.length === 0 && !errors.selectedGPIds ? "Aucun médecin généraliste actif disponible." : undefined}
          >
            <select
              multiple
              name="selectedGPIds"
              id="selectedGPIds"
              value={formData.selectedGPIds}
              onChange={(e) => handleMultiSelectChange(e, 'selectedGPIds')}
              className={`mt-1 block w-full px-3 py-2 border ${errors.selectedGPIds ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            >
              {availableGPs.map(gp => <option key={gp.id} value={gp.id}>{gp.prenom} {gp.nom}</option>)}
            </select>
          </FormField>

          <FormField 
            label={<>Médecins Spécialistes (maintenez Ctrl/Cmd pour sélectionner plusieurs) {renderSelectionCount(formData.selectedSpecialistIds?.length || 0)}</>}
            name="selectedSpecialistIds" 
            error={errors.selectedSpecialistIds} 
            isMultiSelect 
            selectHeight="h-24"
            infoText={availableSpecialists.length === 0 && !errors.selectedSpecialistIds ? "Aucun médecin spécialiste actif disponible." : undefined}
          >
            <select
              multiple
              name="selectedSpecialistIds"
              id="selectedSpecialistIds"
              value={formData.selectedSpecialistIds}
              onChange={(e) => handleMultiSelectChange(e, 'selectedSpecialistIds')}
              className={`mt-1 block w-full px-3 py-2 border ${errors.selectedSpecialistIds ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            >
              {availableSpecialists.map(sp => <option key={sp.id} value={sp.id}>{sp.prenom} {sp.nom} ({sp.specialite})</option>)}
            </select>
          </FormField>

          <FormField 
            label={<>Personnel d'Accueil (maintenez Ctrl/Cmd pour sélectionner plusieurs) {renderSelectionCount(formData.selectedAccueilIds?.length || 0)}</>}
            name="selectedAccueilIds" 
            error={errors.selectedAccueilIds} 
            isMultiSelect 
            selectHeight="h-24"
            infoText={availableAccueilStaff.length === 0 && !errors.selectedAccueilIds ? "Aucun personnel d'accueil actif disponible." : undefined}
          >
            <select
              multiple
              name="selectedAccueilIds"
              id="selectedAccueilIds"
              value={formData.selectedAccueilIds}
              onChange={(e) => handleMultiSelectChange(e, 'selectedAccueilIds')}
              className={`mt-1 block w-full px-3 py-2 border ${errors.selectedAccueilIds ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
            >
              {availableAccueilStaff.map(as => <option key={as.id} value={as.id}>{as.prenom} {as.nom}</option>)}
            </select>
          </FormField>


          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isLoading || isDataLoading}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Planification...
                </>
              ) : (
                <><i className="fas fa-calendar-plus mr-2"></i>Planifier la Caravane</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanCaravanePage;
