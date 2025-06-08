
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { User, UserFormData, UserRole, Specialite } from '../../types';
import userService from '../../services/userService'; // To be created
import Modal from '../../components/common/Modal';
import UserForm from '../../components/admin/UserForm'; // To be created
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Pagination from '../../components/common/Pagination';
import { DEFAULT_ITEMS_PER_PAGE, USER_ROLES_CONFIG } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/helpers';

const UserManagementPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [actionMessage, setActionMessage] = useState<{type: 'success'|'error', text:string} | null>(null);

  const itemsPerPage = DEFAULT_ITEMS_PER_PAGE;

  const canManageUsers = hasPermission('manage_users');

  const fetchUsers = useCallback(async () => {
    if (!canManageUsers) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setActionMessage(null);
    try {
      const result = await userService.getUsers({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
      });
      setUsers(result.data);
      setTotalUsers(result.total);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setActionMessage({type: 'error', text: 'Erreur lors du chargement des utilisateurs.'});
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, canManageUsers]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleFormSubmit = async (userData: UserFormData, id?: string) => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      if (id) {
        await userService.updateUser(id, userData);
        setActionMessage({type: 'success', text: 'Utilisateur mis à jour avec succès !'});
      } else {
        await userService.addUser(userData);
        setActionMessage({type: 'success', text: 'Utilisateur ajouté avec succès !'});
      }
      setIsModalOpen(false);
      setEditingUser(null);
      fetchUsers(); // Refresh list
    } catch (error: any) {
      console.error("Failed to save user:", error);
      setActionMessage({type: 'error', text: error.message || 'Erreur lors de l\'enregistrement de l\'utilisateur.'});
      // Keep modal open if error by not setting setIsModalOpen(false) here explicitly for error
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${username} ? Cette action est irréversible.`)) {
      if (currentUser?.id === id) {
         setActionMessage({type: 'error', text: 'Vous ne pouvez pas supprimer votre propre compte.'});
         // window.alert('Vous ne pouvez pas supprimer votre propre compte.'); // alert is blocking, prefer actionMessage
         return;
      }
      setIsLoading(true);
      setActionMessage(null);
      try {
        await userService.deleteUser(id);
        setActionMessage({type: 'success', text: `Utilisateur ${username} supprimé avec succès !`});
        fetchUsers(); // Refresh list
      } catch (error: any) {
        console.error("Failed to delete user:", error);
        setActionMessage({type: 'error', text: error.message || 'Erreur lors de la suppression de l\'utilisateur.'});
      } finally {
        setIsLoading(false);
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setActionMessage(null);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
    setActionMessage(null);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
    setActionMessage(null);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalUsers / itemsPerPage);

  if (!canManageUsers) {
    return (
      <div className="text-center py-20 bg-white rounded-lg shadow-xl p-8">
        <i className="fas fa-exclamation-triangle fa-3x text-red-500 mb-4"></i>
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Accès Refusé</h2>
        <p className="text-gray-500">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
        <Link to="/" className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-150">
          Retour à l'accueil
        </Link>
      </div>
    );
  }
  
  const AdminSectionLink: React.FC<{ to: string; icon: string; title: string; description: string; color: string }> = ({ to, icon, title, description, color }) => (
    <Link to={to} className={`block bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-l-4 border-${color}-500`}>
      <div className={`flex items-center text-${color}-600 mb-3`}>
        <i className={`fas ${icon} fa-2x mr-4 w-8 text-center`}></i>
        <h3 className={`text-xl font-semibold text-gray-800`}>{title}</h3>
      </div>
      <p className="text-gray-600 text-sm">{description}</p>
    </Link>
  );


  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-semibold text-gray-800">Panneau d'Administration Central</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          <AdminSectionLink 
            to="/admin/user-management" 
            icon="fa-users-cog" 
            title="Gestion des Utilisateurs" 
            description="Gérer les comptes, rôles et permissions."
            color="purple"
          />
          <AdminSectionLink 
            to="/admin/system-settings" 
            icon="fa-cogs" 
            title="Paramètres Système" 
            description="Configurer les options globales de l'application."
            color="teal"
          />
           <AdminSectionLink 
            to="/caravanes" 
            icon="fa-truck-medical" 
            title="Gestion des Caravanes" 
            description="Planifier et superviser les caravanes médicales."
            color="green"
          />
      </div>


      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h3 className="text-2xl font-semibold text-gray-700">Liste des Utilisateurs</h3>
        <button
          onClick={openAddModal}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition duration-150 ease-in-out flex items-center"
        >
          <i className="fas fa-user-plus mr-2"></i> Ajouter un Utilisateur
        </button>
      </div>

      {actionMessage && (
          <div className={`p-4 my-4 rounded-md text-sm ${actionMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {actionMessage.text}
          </div>
      )}

      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Rechercher par nom, email, rôle..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full md:w-1/2 lg:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        {isLoading && users.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner message="Chargement des utilisateurs..." size="lg" />
          </div>
        ) : !isLoading && users.length === 0 && searchTerm ? (
          <div className="text-center py-10">
            <i className="fas fa-search fa-3x text-gray-400 mb-4"></i>
            <p className="text-gray-600 text-lg">Aucun utilisateur trouvé pour "{searchTerm}".</p>
          </div>
        ) : !isLoading && users.length === 0 ? (
          <div className="text-center py-10">
            <i className="fas fa-users-slash fa-3x text-gray-400 mb-4"></i>
            <p className="text-gray-600 text-lg">Aucun utilisateur enregistré.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom Complet</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spécialité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actif</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Créé le</th>
                  <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.prenom} {user.nom}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-800' :
                            user.role === UserRole.MEDECIN_SPECIALISTE ? 'bg-blue-100 text-blue-800' :
                            user.role === UserRole.MEDECIN_GENERALISTE ? 'bg-green-100 text-green-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                            {USER_ROLES_CONFIG[user.role]?.name || user.role}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.specialite || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {user.actif ? 
                        <span className="text-green-600"><i className="fas fa-check-circle mr-1"></i>Oui</span> : 
                        <span className="text-red-600"><i className="fas fa-times-circle mr-1"></i>Non</span>
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(user.created_at)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-yellow-500 hover:text-yellow-700 transition-colors duration-150"
                        title="Modifier"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        className="text-red-600 hover:text-red-800 transition-colors duration-150"
                        title="Supprimer"
                        disabled={currentUser?.id === user.id} // Disable deleting self
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={editingUser ? "Modifier l'Utilisateur" : "Ajouter un Nouvel Utilisateur"}
          size="lg"
        >
          <UserForm
            onSubmit={handleFormSubmit}
            initialData={editingUser}
            isLoading={isLoading}
            key={editingUser ? editingUser.id : 'new-user'} // Ensure form re-initializes
            onCancel={closeModal} // Pass the cancel handler
          />
           {actionMessage && actionMessage.type === 'error' && isModalOpen && ( 
              <div className={`p-3 mt-4 rounded-md text-sm bg-red-100 text-red-700`}>
                  {actionMessage.text}
              </div>
            )}
        </Modal>
      )}
    </div>
  );
};

export default UserManagementPage;