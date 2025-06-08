
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Consultation, ConsultationFormData, ValidationErrors, Specialite, User, ConsultationStatut
} from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
// Note: No direct validation import from utils/validators as this form has specific, limited scope.
// Validation logic will be inline or simplified.

interface OrientationEditFormProps {
  initialData: Consultation;
  onSubmit: (updatedData: Partial<ConsultationFormData>, consultationId: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  specialistDoctors: User[];
  specialistWorkload: Record<string, number>;
  orientationSpecialtiesForCheckboxes: Specialite[];
  errorMessage?: string | null;
}

const OrientationEditForm: React.FC<OrientationEditFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  specialistDoctors,
  specialistWorkload,
  orientationSpecialtiesForCheckboxes,
  errorMessage
}) => {
  const [formData, setFormData] = useState<Partial<ConsultationFormData>>({
    oriented_to_specialties: [],
    oriented_to_medecin_id: undefined,
    hors_champ_specialite_caravane: false,
    orientation: '',
    notes: '', 
  });
  const [errors, setErrors] = useState<Partial<ValidationErrors<ConsultationFormData>>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        oriented_to_specialties: initialData.oriented_to_specialties || [],
        oriented_to_medecin_id: initialData.oriented_to_medecin_id || undefined,
        hors_champ_specialite_caravane: initialData.hors_champ_specialite_caravane || false,
        orientation: initialData.orientation || '',
        notes: initialData.notes || '', 
      });
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: Partial<ValidationErrors<ConsultationFormData>> = {};
    // Example: If at least one orientation method is required
    if (
      (!formData.oriented_to_specialties || formData.oriented_to_specialties.length === 0) &&
      !formData.oriented_to_medecin_id &&
      !formData.hors_champ_specialite_caravane &&
      !formData.orientation?.trim() // If general orientation text is also empty
    ) {
      // This error is a bit broad; specific error messages per field might be better if needed.
      // For now, let's put a general one on a relevant field or a global message.
      // newErrors.oriented_to_specialties = "Veuillez sélectionner une spécialité, un médecin, marquer comme hors champ, ou fournir une note d'orientation.";
    }
    if (!formData.notes?.trim()) {
        newErrors.notes = "Les notes cliniques sont requises pour justifier l'orientation.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let newFormState = { ...formData };

    if (type === 'checkbox') {
      const targetCheckbox = e.target as HTMLInputElement;
      const checked = targetCheckbox.checked;

      if (name.startsWith('oriented_specialty_')) {
        const specialtyValue = value as Specialite;
        let updatedSpecialties = [...(newFormState.oriented_to_specialties || [])];
        if (checked) {
          if (!updatedSpecialties.includes(specialtyValue)) {
            updatedSpecialties.push(specialtyValue);
          }
        } else {
          updatedSpecialties = updatedSpecialties.filter(s => s !== specialtyValue);
        }
        newFormState.oriented_to_specialties = updatedSpecialties;

        // If a specialist doctor was selected, and their specialty is no longer in the list, clear the doctor.
        if (newFormState.oriented_to_medecin_id) {
          const med = specialistDoctors.find(d => d.id === newFormState.oriented_to_medecin_id);
          if (med && med.specialite && updatedSpecialties.length > 0 && !updatedSpecialties.includes(med.specialite)) {
            newFormState.oriented_to_medecin_id = undefined;
          } else if (updatedSpecialties.length === 0) { // If no specialties selected, clear doctor
            newFormState.oriented_to_medecin_id = undefined;
          }
        }

      } else { // For hors_champ_specialite_caravane
        // @ts-ignore
        newFormState[name] = checked;
      }
    } else if (name === 'oriented_to_medecin_id') {
        newFormState.oriented_to_medecin_id = value === '' ? undefined : value;
    } else {
      // @ts-ignore
      newFormState[name] = value;
    }
    setFormData(newFormState);
    if (errors[name as keyof ConsultationFormData]) {
        setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    // Construct the payload for update, only including fields managed by this form.
    const updatePayload: Partial<ConsultationFormData> = {
      oriented_to_specialties: formData.oriented_to_specialties,
      oriented_to_medecin_id: formData.oriented_to_medecin_id,
      hors_champ_specialite_caravane: formData.hors_champ_specialite_caravane,
      orientation: formData.orientation,
      notes: formData.notes,
      // Ensure statut is set to TERMINEE when GP modifies orientation, if not already.
      statut: initialData.statut === ConsultationStatut.EN_ATTENTE || initialData.statut === ConsultationStatut.EN_COURS ? ConsultationStatut.TERMINEE : initialData.statut,
    };
    await onSubmit(updatePayload, initialData.id);
  };

  const getFilteredSpecialistDoctorsForForm = () => {
    if (formData.oriented_to_specialties && formData.oriented_to_specialties.length > 0) {
        return specialistDoctors.filter(doc => doc.specialite && formData.oriented_to_specialties?.includes(doc.specialite));
    }
    return specialistDoctors; 
  };
  
  const FormField: React.FC<{label: string, name: keyof Partial<ConsultationFormData>, error?: string, children: React.ReactNode, isRequired?: boolean}> = 
  ({label, name, error, children, isRequired}) => (
    <div className="mb-4">
      <label htmlFor={name as string} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {isRequired && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="p-3 mb-4 rounded-md text-sm bg-red-100 text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Orienter vers Spécialité(s) :</label>
          <div className="mt-2 space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
              {orientationSpecialtiesForCheckboxes.map(spec => (
                  <div key={spec} className="flex items-center">
                      <input
                          id={`oriented_specialty_${spec}_modal`}
                          name={`oriented_specialty_${spec}`} 
                          type="checkbox"
                          value={spec}
                          checked={formData.oriented_to_specialties?.includes(spec) || false}
                          onChange={handleChange}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor={`oriented_specialty_${spec}_modal`} className="ml-2 text-sm text-gray-700">
                          {spec}
                      </label>
                  </div>
              ))}
          </div>
          {errors.oriented_to_specialties && <p className="mt-1 text-xs text-red-500">{errors.oriented_to_specialties}</p>}
      </div>

      <FormField label="Orienter vers Médecin Spécialiste (Optionnel)" name="oriented_to_medecin_id" error={errors.oriented_to_medecin_id}>
          <select 
              name="oriented_to_medecin_id" 
              id="oriented_to_medecin_id_modal" 
              value={formData.oriented_to_medecin_id || ''} 
              onChange={handleChange}
              className={`w-full px-3 py-2 border ${errors.oriented_to_medecin_id ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
          >
              <option value="">-- Aucun Médecin Spécifique --</option>
              {getFilteredSpecialistDoctorsForForm().map(doc => (
                  <option key={doc.id} value={doc.id}>
                      Dr. {doc.prenom} {doc.nom} ({doc.specialite})
                       {(specialistWorkload[doc.id] !== undefined ? ` - ${specialistWorkload[doc.id]} patient(s)` : '')}
                  </option>
              ))}
          </select>
      </FormField>

      <FormField label="" name="hors_champ_specialite_caravane">
          <div className="flex items-center">
              <input type="checkbox" name="hors_champ_specialite_caravane" id="hors_champ_specialite_caravane_modal" checked={formData.hors_champ_specialite_caravane || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
              <label htmlFor="hors_champ_specialite_caravane_modal" className="ml-2 text-sm text-gray-700">Hors champ de spécialité de la caravane</label>
          </div>
      </FormField>
      
      <FormField label="Orientation (Notes Générales)" name="orientation" error={errors.orientation}>
           <input type="text" name="orientation" id="orientation_modal" value={formData.orientation || ''} onChange={handleChange}
              placeholder="Ex: Référer à Neurologie pour céphalées chroniques"
              className={`w-full px-3 py-2 border ${errors.orientation ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`} />
      </FormField>

      <FormField label="Notes Cliniques (Justification)" name="notes" error={errors.notes} isRequired={true}>
          <textarea name="notes" id="notes_modal" value={formData.notes} onChange={handleChange} rows={3}
              className={`w-full px-3 py-2 border ${errors.notes ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}></textarea>
      </FormField>

      <div className="flex justify-end pt-4 space-x-3">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          disabled={isLoading}
        >
          Annuler
        </button>
        <button type="submit" disabled={isLoading}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isLoading ? (
            <><LoadingSpinner size="sm" /> Enregistrement...</>
          ) : ( <><i className="fas fa-save mr-2"></i>Mettre à Jour Orientation</>)}
        </button>
      </div>
    </form>
  );
};

export default OrientationEditForm;
