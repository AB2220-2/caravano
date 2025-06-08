
import React, { useState } from 'react';
import { APP_NAME, USER_ROLES_CONFIG } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
// Fix: Import useNavigate
import { NavLink, useNavigate } from 'react-router-dom';

interface HeaderProps {
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, isSidebarOpen }) => {
  const { currentUser, logout } = useAuth();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  // Fix: Initialize useNavigate
  const navigate = useNavigate();

  const getAvatarInitials = (prenom?: string, nom?: string, username?: string, role?: UserRole) => {
    if (prenom && nom && prenom.length > 0 && nom.length > 0) {
      return prenom[0].toUpperCase() + nom[0].toUpperCase();
    }
    if (username && username.length > 0) {
      const parts = username.split(/[.\s]/); // Split by dot or space
      if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
        return parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
      }
      return username.substring(0, 2).toUpperCase();
    }
    if (role) { // Fallback to role name initials
        const roleNameFallback = USER_ROLES_CONFIG[role]?.name || '';
        const parts = roleNameFallback.split(' ');
         if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
            return parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
        }
        return roleNameFallback.substring(0,2).toUpperCase();
    }
    return '?';
  };
  
  const userRoleDisplay = currentUser ? USER_ROLES_CONFIG[currentUser.role]?.name : 'Utilisateur';
  const userFullNameDisplay = currentUser && currentUser.prenom && currentUser.nom ? `${currentUser.prenom} ${currentUser.nom}` : currentUser?.username;
  const avatarInitials = currentUser ? getAvatarInitials(currentUser.prenom, currentUser.nom, currentUser.username, currentUser.role) : '?';


  return (
    <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-40">
      <div className="flex items-center">
        {currentUser && ( // Only show toggle if logged in and sidebar is part of layout
            <button
            onClick={toggleSidebar}
            className="text-gray-600 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1 mr-4"
            aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
            <i className={`fas ${isSidebarOpen ? 'fa-times' : 'fa-bars'} fa-lg`}></i>
            </button>
        )}
        <h1 className="text-2xl font-semibold text-blue-700 tracking-tight" style={{fontFamily: "'Roboto Slab', serif"}}>{APP_NAME}</h1>
      </div>
      <div className="flex items-center space-x-4">
        {currentUser ? (
          <>
            <button className="relative text-gray-600 hover:text-blue-600 focus:outline-none">
              <i className="fas fa-bell fa-lg"></i>
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 focus:outline-none"
              >
                <div className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
                  {avatarInitials}
                </div>
                <span className="hidden md:inline text-sm">{userRoleDisplay}</span>
                <i className={`fas fa-chevron-down text-xs transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`}></i>
              </button>
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-xl z-50 py-1"> {/* Increased width for longer names */}
                  <div className="px-4 py-2 text-xs text-gray-500">Connecté en tant que:</div>
                  <div className="px-4 py-1 font-medium text-sm text-gray-800 truncate" title={userFullNameDisplay && userFullNameDisplay !== userRoleDisplay ? `${userFullNameDisplay} (${userRoleDisplay})` : userRoleDisplay}>
                    {userFullNameDisplay && userFullNameDisplay !== userRoleDisplay ? `${userFullNameDisplay} (${userRoleDisplay})` : userRoleDisplay}
                  </div>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    // Fix: Pass navigate function to logout
                    onClick={() => { logout(navigate); setIsProfileDropdownOpen(false); }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-blue-600"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i>Se Déconnecter
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <NavLink 
            to="/login"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none"
          >
            Se Connecter
          </NavLink>
        )}
      </div>
    </header>
  );
};

export default Header;
