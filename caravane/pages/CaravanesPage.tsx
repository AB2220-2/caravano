
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Caravane, CaravaneStatut, Specialite, UserRole, User } from '../types';
import { USER_ROLES_CONFIG, DEFAULT_ITEMS_PER_PAGE } from '../constants';
import caravaneService from '../services/caravaneService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Pagination from '../components/common/Pagination';
import { formatDate } from '../utils/helpers';

const CaravaneCard: React.FC<{ caravane: Caravane, isAdmin: boolean, onDeleteCaravane: (id: string, nom: string) => void }> = ({ caravane, isAdmin, onDeleteCaravane }) => {
  const renderTeamMembers = (team?: User[]) => {
    if (!team || team.length === 0) {
      return <p className="text-xs text-gray-500 italic">Aucune équipe assignée.</p>;
    }
    
    const getRoleNameShort = (role: UserRole) => {
        if (role === UserRole.MEDECIN_GENERALISTE) return "MG";
        if (role === UserRole.MEDECIN_SPECIALISTE) return "MS";
        if (role === UserRole.ACCUEIL) return "Accueil";
        return "N/A";
    }

    return (
      <ul className="space-y-0.5">
        {team.slice(0, 3).map(member => ( // Show first 3 members
          <li key={member.id} className="text-xs text-gray-600">
            {member.prenom} {member.nom} 
            <span className="text-gray-400 text-xxs ml-1">({getRoleNameShort(member.role)}{member.specialite && member.role === UserRole.MEDECIN_SPECIALISTE ? ` - ${member.specialite.substring(0,4)}.` : ''})</span>
          </li>
        ))}
        {team.length > 3 && <li className="text-xs text-gray-500 italic">et {team.length - 3} autres...</li>}
      </ul>
    );
  };
  
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-shadow duration-300 flex flex-col">
      <div className={`p-5 border-l-4 ${
          caravane.statut === CaravaneStatut.PLANIFIEE ? 'border-yellow-500' :
          caravane.statut === CaravaneStatut.EN_COURS ? 'border-blue-500' :
          'border-green-500'
        } flex-grow`}>
        <div className="flex justify-between items-start">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">{caravane.nom}</h3>
          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
            caravane.statut === CaravaneStatut.PLANIFIEE ? 'bg-yellow-100 text-yellow-800' :
            caravane.statut === CaravaneStatut.EN_COURS ? 'bg-blue-100 text-blue-800' :
            'bg-green-100 text-green-800'
          }`}>
            {caravane.statut.charAt(0).toUpperCase() + caravane.statut.slice(1).replace('_', ' ')}
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-1"><i className="fas fa-calendar-alt mr-2 text-gray-400 w-4 text-center"></i>Date: {formatDate(caravane.date_caravane)}</p>
        <p className="text-sm text-gray-500 mb-3"><i className="fas fa-map-marker-alt mr-2 text-gray-400 w-4 text-center"></i>Lieu: {caravane.lieu}</p>
        
        <div className="mb-3">
          <p className="text-xs text-gray-600 font-medium mb-1 flex items-center">
            <i className="fas fa-tags mr-2 text-gray-400 w-4 text-center"></i>Spécialités:
          </p>
          <div className="flex flex-wrap gap-1 pl-6">
            {caravane.specialites_couvertes.map(spec => (
              <span key={spec} className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">{spec}</span>
            ))}
             {caravane.specialites_couvertes.length === 0 && <span className="text-xs text-gray-500 italic">Aucune spécialité définie.</span>}
          </div>
        </div>

        <div className="mb-1">
          <p className="text-xs text-gray-600 font-medium mb-1 flex items-center">
            <i className="fas fa-users-cog mr-2 text-gray-400 w-4 text-center"></i>Équipe Médicale:
          </p>
          <div className="pl-6">
            {renderTeamMembers(caravane.equipe_medicale)}
          </div>
        </div>
        <p className="text-xxs text-gray-400 mt-2 pl-6">ID: {caravane.numero_unique}</p>
      </div>
      <div className="bg-gray-50 p-3 flex justify-end space-x-2 border-t">
        <Link 
            to={`/caravanes/${caravane.id}`} 
            className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
            title="Voir Détails"
        >
          <i className="fas fa-eye mr-1"></i>Voir Détails
        </Link>
        {isAdmin && (
          <>
            <Link 
                to={`/caravanes/edit/${caravane.id}`} 
                className="text-xs px-3 py-1.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition"
                title="Modifier"
            >
              <i className="fas fa-edit mr-1"></i>Modifier
            </Link>
            <button 
                onClick={() => onDeleteCaravane(caravane.id, caravane.nom)} 
                className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition"
                title="Supprimer"
            >
              <i className="fas fa-trash mr-1"></i>Supprimer
            </button>
          </>
        )}
      </div>
    </div>
  );
};


const CaravanesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [caravanes, setCaravanes] = useState<Caravane[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCaravanes, setTotalCaravanes] = useState(0);
  const [actionMessage, setActionMessage] = useState<{type: 'success'|'error', text:string} | null>(null);

  const itemsPerPage = 6;

  const roleName = USER_ROLES_CONFIG[currentUser!.role].name;
  const isAdmin = currentUser!.role === UserRole.ADMIN;

  const fetchCaravanes = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await caravaneService.getCaravanes({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
      });
      setCaravanes(result.data);
      setTotalCaravanes(result.total);
    } catch (error) {
      console.error("Failed to fetch caravanes:", error);
      setActionMessage({type: 'error', text: 'Erreur lors du chargement des caravanes.'});
      setCaravanes([]);
      setTotalCaravanes(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm]);

  useEffect(() => {
    fetchCaravanes();
  }, [fetchCaravanes]);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); 
    setActionMessage(null); 
  };
  
 const handleDeleteCaravane = async (id: string, nom: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la caravane "${nom}" ? Cette action est irréversible.`)) {
      return;
    }

    setIsDeleting(true);
    setActionMessage(null);

    try {
      await caravaneService.deleteCaravane(id);
      setActionMessage({ type: 'success', text: `Caravane "${nom}" supprimée avec succès.` });

      // After deletion, check if the current page needs adjustment
      const currentItemCountOnPage = caravanes.filter(c => c.id !== id).length; // Items remaining on current page if this was the current list
      
      if (currentItemCountOnPage === 0 && currentPage > 1) {
        // If the page became empty and it wasn't the first page, go to the previous page.
        // The useEffect for fetchCaravanes will handle fetching data for the new page.
        setCurrentPage(prevPage => Math.max(1, prevPage - 1));
      } else {
        // If items remain on the page, or it's the first page,
        // just re-fetch the current page data.
        // (This also handles the case where totalCaravanes becomes 0 on page 1)
        fetchCaravanes();
      }

    } catch (error: any) {
      console.error("Failed to delete caravane:", error);
      setActionMessage({ type: 'error', text: error.message || `Erreur lors de la suppression de la caravane "${nom}".` });
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.ceil(totalCaravanes / itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-semibold text-gray-800">Gestion des Caravanes <span className="text-xl text-green-600">({roleName})</span></h2>
         {isAdmin && (
          <Link
            to="/caravanes/plan"
            className="px-6 py-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-150 ease-in-out flex items-center"
          >
            <i className="fas fa-plus mr-2"></i> Planifier une Caravane
          </Link>
         )}
      </div>
      
      {actionMessage && (
          <div className={`p-3 my-2 rounded-md text-sm ${actionMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {actionMessage.text}
          </div>
      )}

      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
         <div className="mb-6">
            <input 
                type="text"
                placeholder="Rechercher par nom, lieu, ID..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full md:w-1/2 lg:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                disabled={isDeleting || isLoading}
            />
        </div>

        {(isLoading && caravanes.length === 0 && !isDeleting) ? (
           <div className="flex justify-center items-center h-64">
            <LoadingSpinner message="Chargement des caravanes..." size="lg" />
          </div>
        ) : !isLoading && caravanes.length === 0 && searchTerm && !isDeleting ? (
           <div className="text-center py-10">
            <i className="fas fa-search fa-3x text-gray-400 mb-4"></i>
            <p className="text-gray-600 text-lg">Aucune caravane trouvée pour "{searchTerm}".</p>
          </div>
        ) : !isLoading && caravanes.length === 0 && !isDeleting ? (
          <div className="text-center py-16">
            <i className="fas fa-truck-medical fa-4x text-gray-300 mb-6"></i>
            <h3 className="text-2xl font-semibold text-gray-700 mb-3">Aucune caravane enregistrée</h3>
            <p className="text-gray-500 mb-6">
              {isAdmin ? "Planifiez votre première caravane pour commencer." : "Aucune caravane n'est actuellement disponible."}
            </p>
            {isAdmin && (
              <Link
                to="/caravanes/plan"
                className="px-6 py-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-150 ease-in-out flex items-center justify-center w-max mx-auto"
              >
                <i className="fas fa-plus mr-2"></i> Planifier une Caravane
              </Link>
            )}
          </div>
        ) : (
          <>
            {isDeleting && <div className="absolute inset-0 bg-white bg-opacity-75 flex justify-center items-center z-10"><LoadingSpinner message="Suppression en cours..." /></div>}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>
                {caravanes.map((caravane) => (
                <CaravaneCard key={caravane.id} caravane={caravane} isAdmin={isAdmin} onDeleteCaravane={handleDeleteCaravane} />
                ))}
            </div>
          </>
        )}
        
        {totalPages > 1 && !isDeleting && caravanes.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => { setCurrentPage(page); setActionMessage(null); }}
          />
        )}
      </div>
    </div>
  );
};

export default CaravanesPage;
