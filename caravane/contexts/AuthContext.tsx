
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { CurrentUser, UserRole, Specialite } from '../types'; // Added Specialite import
import { USER_ROLES_CONFIG, MOCK_USERS } from '../constants'; 

interface AuthContextType {
  currentUser: CurrentUser | null;
  login: (username: string, passwordAttempt: string, navigateFn: (path: string) => void) => void;
  logout: (navigateFn: (path: string) => void) => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const login = (username: string, passwordAttempt: string, navigateFn: (path: string) => void) => {
    const userToLogin = MOCK_USERS.find(user => user.username === username);

    if (!userToLogin) {
      throw new Error('Nom d\'utilisateur incorrect.');
    }

    // Simulate password check
    // For "admine6", the stored hash is "admine6_hashed"
    const expectedPasswordHash = passwordAttempt + '_hashed'; 

    if (userToLogin.passwordHash !== expectedPasswordHash) {
      throw new Error('Mot de passe incorrect.');
    }

    setCurrentUser({
      id: userToLogin.id,
      username: userToLogin.username,
      role: userToLogin.role,
      nom: userToLogin.nom,
      prenom: userToLogin.prenom,
      specialite: userToLogin.specialite,
      permissions: USER_ROLES_CONFIG[userToLogin.role].permissions,
    });
    
    navigateFn('/'); // Navigate to dashboard after successful login
  };

  const logout = (navigateFn: (path: string) => void) => {
    setCurrentUser(null);
    navigateFn('/login'); // Navigate to login after logout
  };

  const hasPermission = (permission: string): boolean => {
    return currentUser?.permissions.includes(permission) || false;
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};