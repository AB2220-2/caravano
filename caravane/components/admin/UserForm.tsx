
import React, { useState, useEffect } from 'react';
import { User, UserFormData, UserRole, Specialite, ValidationErrors } from '../../types';
import { validateUserForm } from '../../utils/validators';
import { USER_ROLES_CONFIG, SPECIALTIES_LIST } from '../../constants';

interface UserFormProps {
  onSubmit: (userData: UserFormData, id?: string) => Promise<void>; 
  initialData?: User | null;
  isLoading: boolean;
  onCancel: () => void; // Added onCancel prop
}

const UserForm: React.FC<UserFormProps> = ({ onSubmit, initialData, isLoading, onCancel }) => {
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    nom: '',
    prenom: '',
    role: UserRole.ACCUEIL, 
    specialite: undefined,
    actif: true,
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<ValidationErrors<UserFormData>>({});

  const isNewUser = !initialData;

  useEffect(() => {
    if (initialData) {
      setFormData({
        username: initialData.username,
        email: initialData.email, // Email is pre-filled for editing
        nom: initialData.nom,
        prenom: initialData.prenom,
        role: initialData.role,
        specialite: initialData.specialite || undefined, 
        actif: initialData.actif !== undefined ? initialData.actif : true,
        password: '', // Passwords are not pre-filled for editing
        confirmPassword: '',
      });
    } else {
      setFormData({ // For new user, email is not part of initial form state
        username: '',
        // email: '', // Removed from default state for new user
        nom: '',
        prenom: '',
        role: UserRole.ACCUEIL,
        specialite: undefined,
        actif: true,
        password: '',
        confirmPassword: '',
      });
    }
    setErrors({}); 
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let processedValue: string | boolean | UserRole | Specialite | undefined = value;

    if (type === 'checkbox') {
        processedValue = (e.target as HTMLInputElement).checked;
    } else if (name === 'role') {
        processedValue = value as UserRole;
        if (processedValue !== UserRole.MEDECIN_SPECIALISTE) {
            setFormData(prev => ({ ...prev, specialite: undefined }));
        }
    } else if (name === 'specialite' && value === '') { // Handle "Sélectionner" option if it has value ""
        processedValue = undefined;
    } else if (name === 'specialite') {
        processedValue = value as Specialite;
    }


    setFormData(prev => ({ ...prev, [name]: processedValue }));

    if (errors[name as keyof UserFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateUserForm(formData, isNewUser);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      // Prepare data for submission, removing confirmPassword
      const dataToSubmit: UserFormData = { ...formData };
      if (!isNewUser) { 
        // For existing users, password fields are only sent if filled (for password change)
        // This logic might need adjustment based on how password changes are handled
        if (!dataToSubmit.password) delete dataToSubmit.password;
        if (!dataToSubmit.confirmPassword) delete dataToSubmit.confirmPassword;

      } else if (dataToSubmit.password === '') { 
        delete dataToSubmit.password;
        delete dataToSubmit.confirmPassword;
      }
      // Email field is not present in formData for new users if not entered.
      // If it's not in formData, it won't be in dataToSubmit.
      // The backend (userService) will handle generating a default email.

      await onSubmit(dataToSubmit, initialData?.id); 
    }
  };

  const FormField: React.FC<{label: string, name: keyof UserFormData, error?: string, children: React.ReactNode}> = ({label, name, error, children}) => (
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
        <FormField label="Nom d'utilisateur" name="username" error={errors.username}>
          <input type="text" name="username" id="username" value={formData.username} onChange={handleChange}
            className={`mt-1 block w-full px-3 py-2 border ${errors.username ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm`} />
        </FormField>
        {!isNewUser && ( // Only show email field for editing, not for new user creation
          <FormField label="Email" name="email" error={errors.email}>
            <input type="email" name="email" id="email" value={formData.email || ''} onChange={handleChange}
              className={`mt-1 block w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm`} />
          </FormField>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Prénom" name="prenom" error={errors.prenom}>
          <input type="text" name="prenom" id="prenom" value={formData.prenom} onChange={handleChange}
            className={`mt-1 block w-full px-3 py-2 border ${errors.prenom ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm`} />
        </FormField>
        <FormField label="Nom" name="nom" error={errors.nom}>
          <input type="text" name="nom" id="nom" value={formData.nom} onChange={handleChange}
            className={`mt-1 block w-full px-3 py-2 border ${errors.nom ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm`} />
        </FormField>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Rôle" name="role" error={errors.role}>
          <select name="role" id="role" value={formData.role} onChange={handleChange}
            className={`mt-1 block w-full px-3 py-2 border ${errors.role ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm`}>
            {Object.values(UserRole).map(roleKey => (
              <option key={roleKey} value={roleKey}>{USER_ROLES_CONFIG[roleKey]?.name || roleKey}</option>
            ))}
          </select>
        </FormField>
        {formData.role === UserRole.MEDECIN_SPECIALISTE && (
          <FormField label="Spécialité" name="specialite" error={errors.specialite}>
            <select name="specialite" id="specialite" value={formData.specialite || ''} onChange={handleChange}
              className={`mt-1 block w-full px-3 py-2 border ${errors.specialite ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm`}>
              <option value="" disabled>-- Sélectionner --</option>
              {SPECIALTIES_LIST.filter(s => s !== Specialite.GENERALE).map(spec => ( 
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          </FormField>
        )}
      </div>

      {isNewUser && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Mot de passe" name="password" error={errors.password}>
            <input type="password" name="password" id="password" value={formData.password} onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 border ${errors.password ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm`} />
            </FormField>
            <FormField label="Confirmer le mot de passe" name="confirmPassword" error={errors.confirmPassword}>
            <input type="password" name="confirmPassword" id="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm`} />
            </FormField>
        </div>
      )}

      <FormField label="" name="actif" error={errors.actif}>
        <div className="flex items-center">
          <input type="checkbox" name="actif" id="actif" checked={formData.actif} onChange={handleChange}
            className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
          <label htmlFor="actif" className="ml-2 block text-sm text-gray-900">Utilisateur Actif</label>
        </div>
      </FormField>
      
      <div className="flex justify-end pt-4">
        <button type="button" onClick={onCancel} 
            className="mr-3 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
            Annuler
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Enregistrement...
            </>
          ) : (initialData ? 'Mettre à jour' : 'Ajouter Utilisateur')}
        </button>
      </div>
    </form>
  );
};

export default UserForm;