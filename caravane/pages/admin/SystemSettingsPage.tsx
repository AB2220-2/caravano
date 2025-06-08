
import React from 'react';
import { Link } from 'react-router-dom';

const SystemSettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold text-gray-800">Paramètres Système</h2>
      <div className="bg-white p-8 rounded-xl shadow-lg text-center">
        <i className="fas fa-cogs fa-4x text-teal-500 mb-6"></i>
        <h3 className="text-2xl font-semibold text-gray-700 mb-3">Module des Paramètres Système</h3>
        <p className="text-gray-500 mb-6">
          Cette section est en cours de développement. Elle permettra de configurer les aspects globaux de l'application.
        </p>
        <Link 
          to="/admin" 
          className="mt-8 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition duration-150"
        >
          <i className="fas fa-arrow-left mr-2"></i> Retour au Panneau d'Administration
        </Link>
      </div>
    </div>
  );
};

export default SystemSettingsPage;
