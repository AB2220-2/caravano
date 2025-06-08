
import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <i className="fas fa-map-signs fa-5x text-blue-500 mb-8"></i>
      <h1 className="text-5xl font-bold text-gray-800 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-700 mb-3">Page Non Trouvée</h2>
      <p className="text-gray-500 mb-8 max-w-md">
        Désolé, la page que vous recherchez semble avoir pris des vacances.
        Vérifiez l'URL ou retournez à l'accueil.
      </p>
      <Link
        to="/"
        className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-150 ease-in-out"
      >
        <i className="fas fa-home mr-2"></i> Retour à l'Accueil
      </Link>
    </div>
  );
};

export default NotFoundPage;
