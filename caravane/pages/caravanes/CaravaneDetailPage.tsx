
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Caravane, UserRole, Patient, CaravaneStatut, User } from '../../types';
import caravaneService from '../../services/caravaneService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatDate, formatDateTime } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';
import { USER_ROLES_CONFIG } from '../../constants';

const DetailItem: React.FC<{ label: string; value?: string | React.ReactNode; icon?: string; fullWidthValue?: boolean }> = ({ label, value, icon, fullWidthValue }) => (
  <div className={`py-3 sm:grid ${fullWidthValue ? 'sm:grid-cols-1' : 'sm:grid-cols-3'} sm:gap-4 border-b border-gray-100 last:border-b-0`}>
    <dt className="text-sm font-medium text-gray-500 flex items-center">
      {icon && <i className={`fas ${icon} mr-2 text-blue-500 w-5 text-center`}></i>}
      {label}
    </dt>
    <dd className={`mt-1 text-sm text-gray-800 ${fullWidthValue ? '' : 'sm:mt-0 sm:col-span-2'}`}>{value || 'N/A'}</dd>
  </div>
);

const TeamMemberItem: React.FC<{ member: User }> = ({ member }) => (
  <li className="py-2 px-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
    <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{member.prenom} {member.nom}</span>
        <span className="text-xs text-gray-500">
            {USER_ROLES_CONFIG[member.role]?.name || member.role}
            {member.role === UserRole.MEDECIN_SPECIALISTE && member.specialite && ` (${member.specialite})`}
        </span>
    </div>
  </li>
);

const CaravaneDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [caravane, setCaravane] = useState<Caravane | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      setError(null);
      caravaneService.getCaravaneById(id)
        .then(data => {
          if (data) {
            setCaravane(data);
          } else {
            setError("Caravane non trouvée.");
          }
        })
        .catch(err => {
          console.error("Failed to fetch caravane details:", err);
          setError("Erreur lors du chargement des détails de la caravane.");
        })
        .finally(() => setIsLoading(false));
    } else {
      setError("Aucun ID de caravane fourni.");
      setIsLoading(false);
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <LoadingSpinner message="Chargement des détails de la caravane..." size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 bg-white shadow-lg rounded-lg p-6">
        <i className="fas fa-exclamation-triangle fa-3x text-red-500 mb-4"></i>
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">{error}</h2>
        <Link to="/caravanes" className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Retour à la liste des caravanes
        </Link>
      </div>
    );
  }

  if (!caravane) {
    return (
        <div className="text-center py-10 bg-white shadow-lg rounded-lg p-6">
        <i className="fas fa-question-circle fa-3x text-gray-400 mb-4"></i>
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Caravane non disponible</h2>
        <Link to="/caravanes" className="mt-6 inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Retour à la liste des caravanes
        </Link>
      </div>
    );
  }
  
  const getStatusBadgeColor = (status: CaravaneStatut) => {
    switch (status) {
      case CaravaneStatut.PLANIFIEE: return 'bg-yellow-100 text-yellow-800 border-yellow-500';
      case CaravaneStatut.EN_COURS: return 'bg-blue-100 text-blue-800 border-blue-500';
      case CaravaneStatut.TERMINEE: return 'bg-green-100 text-green-800 border-green-500';
      default: return 'bg-gray-100 text-gray-800 border-gray-500';
    }
  };
  
  const statusText = caravane.statut.charAt(0).toUpperCase() + caravane.statut.slice(1).replace('_', ' ');

  return (
    <div className="space-y-8">
      <div className="bg-white shadow-xl rounded-xl overflow-hidden">
        <div className={`p-6 md:p-8 border-t-8 ${getStatusBadgeColor(caravane.statut).split(' ')[2]}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">{caravane.nom}</h2>
                    <p className="text-sm text-gray-500">ID: {caravane.numero_unique}</p>
                </div>
                <span className={`px-4 py-1.5 text-sm font-semibold rounded-full self-start sm:self-center ${getStatusBadgeColor(caravane.statut)}`}>
                    {statusText}
                </span>
            </div>
             <div className="mt-6 flex flex-wrap gap-3">
                {isAdmin && (
                    <Link
                        to={`/caravanes/edit/${caravane.id}`}
                        className="px-5 py-2.5 bg-yellow-500 text-white rounded-md shadow-md hover:bg-yellow-600 transition duration-150 text-sm font-medium flex items-center"
                    >
                        <i className="fas fa-edit mr-2"></i> Modifier cette Caravane
                    </Link>
                )}
                <button
                    onClick={() => navigate('/caravanes')}
                    className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-md shadow-md hover:bg-gray-300 transition duration-150 text-sm font-medium flex items-center"
                >
                    <i className="fas fa-arrow-left mr-2"></i> Retour à la liste
                </button>
            </div>
        </div>

        <div className="p-6 md:p-8">
            <section className="mb-8">
                <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2 flex items-center">
                    <i className="fas fa-info-circle mr-3 text-blue-500"></i>Informations Générales
                </h3>
                <dl className="divide-y divide-gray-100">
                    <DetailItem label="Date de la Caravane" value={formatDate(caravane.date_caravane)} icon="fa-calendar-alt" />
                    <DetailItem label="Lieu" value={caravane.lieu} icon="fa-map-marker-alt" />
                    <DetailItem label="Dernière Mise à Jour" value={formatDateTime(caravane.updated_at)} icon="fa-sync-alt" />
                    <DetailItem label="Spécialités Couvertes" icon="fa-tags" fullWidthValue
                        value={
                            caravane.specialites_couvertes.length > 0 ? (
                                <div className="flex flex-wrap gap-2 mt-1">
                                {caravane.specialites_couvertes.map(spec => (
                                    <span key={spec} className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{spec}</span>
                                ))}
                                </div>
                            ) : "Aucune spécialité spécifique."
                        }
                    />
                </dl>
            </section>

            <section className="mb-8">
                <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2 flex items-center">
                    <i className="fas fa-users-cog mr-3 text-green-500"></i>Équipe Médicale Assignée
                </h3>
                {(!caravane.equipe_medicale || caravane.equipe_medicale.length === 0) ? (
                    <p className="text-gray-500 italic">Aucune équipe médicale assignée à cette caravane.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <h4 className="text-md font-semibold text-gray-600 mb-2 flex items-center"><i className="fas fa-user-md mr-2 text-green-500"></i>Médecins Généralistes</h4>
                            <ul className="space-y-1.5">
                                {caravane.equipe_medicale.filter(m => m.role === UserRole.MEDECIN_GENERALISTE).length > 0 ? 
                                 caravane.equipe_medicale.filter(m => m.role === UserRole.MEDECIN_GENERALISTE).map(member => <TeamMemberItem key={member.id} member={member} />) :
                                 <p className="text-xs text-gray-400 italic">Aucun médecin généraliste.</p> }
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-md font-semibold text-gray-600 mb-2 flex items-center"><i className="fas fa-brain mr-2 text-purple-500"></i>Médecins Spécialistes</h4>
                             <ul className="space-y-1.5">
                                {caravane.equipe_medicale.filter(m => m.role === UserRole.MEDECIN_SPECIALISTE).length > 0 ? 
                                 caravane.equipe_medicale.filter(m => m.role === UserRole.MEDECIN_SPECIALISTE).map(member => <TeamMemberItem key={member.id} member={member} />) :
                                 <p className="text-xs text-gray-400 italic">Aucun médecin spécialiste.</p> }
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-md font-semibold text-gray-600 mb-2 flex items-center"><i className="fas fa-concierge-bell mr-2 text-yellow-500"></i>Personnel d'Accueil</h4>
                             <ul className="space-y-1.5">
                                {caravane.equipe_medicale.filter(m => m.role === UserRole.ACCUEIL).length > 0 ? 
                                 caravane.equipe_medicale.filter(m => m.role === UserRole.ACCUEIL).map(member => <TeamMemberItem key={member.id} member={member} />) :
                                 <p className="text-xs text-gray-400 italic">Aucun personnel d'accueil.</p> }
                            </ul>
                        </div>
                    </div>
                )}
            </section>

            <section>
                <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2 flex items-center">
                    <i className="fas fa-street-view mr-3 text-red-500"></i>Participants Inscrits ({caravane.participants?.length || 0})
                </h3>
                {(!caravane.participants || caravane.participants.length === 0) ? (
                    <p className="text-gray-500 italic">Aucun participant inscrit à cette caravane pour le moment.</p>
                ) : (
                    <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Unique</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom Complet</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CIN</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Âge</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sexe</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {caravane.participants.map(patient => (
                                <tr key={patient.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{patient.numero_unique}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800">{patient.prenom} {patient.nom}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{patient.cin}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{patient.age}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{patient.sexe}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        <Link 
                                            to={`/patients/${patient.id}`} 
                                            className="text-blue-600 hover:text-blue-800 hover:underline"
                                            title="Voir Profil Patient"
                                        >
                                            Voir Profil <i className="fas fa-arrow-right fa-xs ml-1"></i>
                                        </Link>
                                    </td>
                                </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
      </div>
    </div>
  );
};

export default CaravaneDetailPage;
      