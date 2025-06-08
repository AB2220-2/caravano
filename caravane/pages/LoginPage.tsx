
import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { APP_NAME, USER_ROLES_CONFIG } from '../constants';
import LoadingSpinner from '../components/common/LoadingSpinner';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  if (auth.currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim()) {
        setError('Le nom d\'utilisateur est requis.');
        return;
    }
    if (!password.trim()) {
        setError('Le mot de passe est requis.');
        return;
    }

    setIsLoading(true);
    
    try {
      // Simulate API call before calling auth.login
      await new Promise(resolve => setTimeout(resolve, 1000));
      auth.login(username, password, navigate); 
      // Navigation is handled by auth.login on success
    } catch (err: any) { // Catch specific error from auth.login
      setError(err.message || 'Erreur de connexion. Vérifiez vos identifiants ou réessayez.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <i className="fas fa-clinic-medical fa-4x text-white mb-4"></i>
            <h1 className="text-4xl font-bold text-white tracking-tight" style={{fontFamily: "'Roboto Slab', serif"}}>{APP_NAME}</h1>
            <p className="text-blue-200 mt-2">Gestion des Caravanes Médicales</p>
        </div>

        <div className="bg-white shadow-2xl rounded-xl p-8 md:p-10">
          <h2 className="text-2xl font-semibold text-gray-700 text-center mb-6">Accéder à votre compte</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Nom d'utilisateur
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Entrez votre nom d'utilisateur"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="••••••••"
              />
            </div>
            
            {/* Role selection dropdown removed */}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <><i className="fas fa-sign-in-alt mr-2"></i>Se Connecter</>
                )}
              </button>
            </div>
          </form>
          <p className="mt-6 text-center text-xs text-gray-500">
            Utilisez vos identifiants fournis pour accéder à l'application.
          </p>
        </div>
         <p className="mt-8 text-center text-sm text-blue-200">
            &copy; {new Date().getFullYear()} {APP_NAME}. Tous droits réservés.
          </p>
      </div>
    </div>
  );
};

export default LoginPage;