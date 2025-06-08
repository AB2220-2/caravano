import React from 'react';
import { NavLink } from 'react-router-dom';
import { APP_NAME, NAV_ITEMS } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const { currentUser } = useAuth();

  // This check should ideally not be needed if sidebar is part of ProtectedRoute's layout
  // However, keeping it ensures sidebar doesn't try to render nav items if currentUser is briefly null during transition.
  if (!currentUser) { 
    return (
       <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gradient-to-b from-blue-700 to-blue-900 text-white flex flex-col transition-transform duration-300 ease-in-out transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 shadow-lg`}
      >
         <div className="p-6 flex items-center space-x-3 border-b border-blue-600">
          <i className="fas fa-clinic-medical fa-2x text-blue-300"></i>
          <span className="text-2xl font-bold tracking-tight" style={{fontFamily: "'Roboto Slab', serif"}}>{APP_NAME}</span>
        </div>
        <div className="p-6 mt-6 flex-1 text-center text-blue-200">
          <p>Veuillez vous connecter pour accéder aux fonctionnalités.</p>
           <i className="fas fa-sign-in-alt fa-3x my-4"></i>
        </div>
         <div className="p-6 mt-auto border-t border-blue-600">
          <p className="text-xs text-blue-300">&copy; {new Date().getFullYear()} {APP_NAME}.</p>
        </div>
      </aside>
    );
  }

  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (!item.requiredRoles) return true; // If no roles defined, item is public
    return item.requiredRoles.includes(currentUser.role);
  });


  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black opacity-50 lg:hidden" // z-index lower than sidebar
          onClick={toggleSidebar}
        ></div>
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gradient-to-b from-blue-700 to-blue-900 text-white flex flex-col transition-transform duration-300 ease-in-out transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 shadow-lg`} // z-index for sidebar itself
      >
        <div className="p-6 flex items-center space-x-3 border-b border-blue-600">
          <i className="fas fa-clinic-medical fa-2x text-blue-300"></i>
          <span className="text-2xl font-bold tracking-tight" style={{fontFamily: "'Roboto Slab', serif"}}>{APP_NAME}</span>
        </div>
        <nav className="mt-6 flex-1">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center py-3 px-6 text-gray-200 hover:bg-blue-600 hover:text-white transition-colors duration-200 ${
                  isActive ? 'bg-blue-800 border-l-4 border-blue-300 font-semibold' : 'border-l-4 border-transparent'
                }`
              }
              onClick={() => { if (window.innerWidth < 1024) toggleSidebar() } }
            >
              <i className={`${item.icon} w-6 h-6 mr-4 text-blue-300`}></i>
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-6 mt-auto border-t border-blue-600">
          <p className="text-xs text-blue-300">&copy; {new Date().getFullYear()} {APP_NAME}.</p>
          <p className="text-xs text-blue-300">Tous droits réservés.</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;