
import React, 'react'; // Removed useState, useEffect as they are not used in the final version of this diff. Re-evaluating.
// Corrected: useState, useEffect are indeed used.

import { useState, useEffect } from 'react';
import { Patient, PatientFormData, PatientSexe, ValidationErrors, UserRole } from '../../types';
import { validatePatientForm } from '../../utils/validators';

interface PatientFormProps {
  onSubmit: (patientData: PatientFormData, id?: string) => void;
  initialData?: Patient | null;
  isLoading: boolean;
  currentUserRole?: UserRole; // Added to control visibility of "Orienter vers généraliste"
}

const PatientForm: React.FC<PatientFormProps> = ({ onSubmit, initialData, isLoading, currentUserRole }) => {
  const [formData, setFormData] = useState<PatientFormData>({
    prenom: '',
    nom: '',
    cin: '',
    adresse: '',
    age: '',
    sexe: PatientSexe.MASCULIN,
    telephone: '',
    antecedents_medicaux: '',
    email: '',
    date_naissance: '',
    est_oriente_generaliste: false, // Initialize
  });
  const [errors, setErrors] = useState<ValidationErrors<PatientFormData>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        prenom: initialData.prenom || '',
        nom: initialData.nom || '',
        cin: initialData.cin || '',
        adresse: initialData.adresse || '',
        age: initialData.age ? initialData.age.toString() : '',
        sexe: initialData.sexe || PatientSexe.MASCULIN,
        telephone: initialData.telephone || '',
        antecedents_medicaux: initialData.antecedents_medicaux || '',
        email: initialData.email || '',
        date_naissance: initialData.date_naissance ? initialData.date_naissance.substring(0,10) : '',
        est_oriente_generaliste: initialData.est_oriente_generaliste || false,
      });
    } else {
       setFormData({
        prenom: '',
        nom: '',
        cin: '',
        adresse: '',
        age: '',
        sexe: PatientSexe.MASCULIN,
        telephone: '',
        antecedents_medicaux: '',
        email: '',
        date_naissance: '',
        est_oriente_generaliste: false,
      });
    }
    setErrors({});
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (errors[name as keyof PatientFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validatePatientForm(formData);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      onSubmit(formData, initialData?.id);
    }
  };
  
  const FormField: React.FC<{label: string, name: keyof PatientFormData, error?: string, children: React.ReactNode}> = ({label, name, error, children}) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Prénom" name="prenom" error={errors.prenom}>
          <input
            type="text"
            name="prenom"
            id="prenom"
            value={formData.prenom}
            onChange={handleChange}
            className={`mt-1 block w-full px-3 py-2 border ${errors.prenom ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
          />
        </FormField>
        <FormField label="Nom" name="nom" error={errors.nom}>
          <input
            type="text"
            name="nom"
            id="nom"
            value={formData.nom}
            onChange={handleChange}
            className={`mt-1 block w-full px-3 py-2 border ${errors.nom ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="CIN" name="cin" error={errors.cin}>
          <input
            type="text"
            name="cin"
            id="cin"
            value={formData.cin}
            onChange={handleChange}
            className={`mt-1 block w-full px-3 py-2 border ${errors.cin ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
          />
        </FormField>
         <FormField label="Date de Naissance" name="date_naissance" error={errors.date_naissance}>
          <input
            type="date"
            name="date_naissance"
            id="date_naissance"
            value={formData.date_naissance}
            onChange={handleChange}
            className={`mt-1 block w-full px-3 py-2 border ${errors.date_naissance ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
          />
        </FormField>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Âge" name="age" error={errors.age}>
          <input
            type="number"
            name="age"
            id="age"
            value={formData.age}
            onChange={handleChange}
            className={`mt-1 block w-full px-3 py-2 border ${errors.age ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
          />
        </FormField>
        <FormField label="Sexe" name="sexe" error={errors.sexe}>
          <select
            name="sexe"
            id="sexe"
            value={formData.sexe}
            onChange={handleChange}
            className={`mt-1 block w-full px-3 py-2 border ${errors.sexe ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
          >
            <option value={PatientSexe.MASCULIN}>Masculin</option>
            <option value={PatientSexe.FEMININ}>Féminin</option>
          </select>
        </FormField>
      </div>

       <FormField label="Adresse" name="adresse" error={errors.adresse}>
        <textarea
          name="adresse"
          id="adresse"
          rows={3}
          value={formData.adresse}
          onChange={handleChange}
          className={`mt-1 block w-full px-3 py-2 border ${errors.adresse ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Téléphone (Optionnel)" name="telephone" error={errors.telephone}>
          <input
            type="tel"
            name="telephone"
            id="telephone"
            value={formData.telephone}
            onChange={handleChange}
            className={`mt-1 block w-full px-3 py-2 border ${errors.telephone ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
          />
        </FormField>
        <FormField label="Email (Optionnel)" name="email" error={errors.email}>
          <input
            type="email"
            name="email"
            id="email"
            value={formData.email}
            onChange={handleChange}
            className={`mt-1 block w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
          />
        </FormField>
      </div>

      <FormField label="Antécédents Médicaux (Optionnel)" name="antecedents_medicaux" error={errors.antecedents_medicaux}>
        <textarea
          name="antecedents_medicaux"
          id="antecedents_medicaux"
          rows={3}
          value={formData.antecedents_medicaux}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </FormField>

      {currentUserRole === UserRole.ACCUEIL && (
        <FormField label="" name="est_oriente_generaliste">
            <div className="flex items-center">
                <input
                    type="checkbox"
                    name="est_oriente_generaliste"
                    id="est_oriente_generaliste"
                    checked={formData.est_oriente_generaliste || false}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="est_oriente_generaliste" className="ml-2 block text-sm text-gray-900">
                    Orienter vers le médecin généraliste
                </label>
            </div>
        </FormField>
      )}


      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Enregistrement...
            </>
          ) : (initialData ? 'Mettre à jour' : 'Ajouter Patient')}
        </button>
      </div>
    </form>
  );
};

export default PatientForm;