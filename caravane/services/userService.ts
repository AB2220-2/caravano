
// Fix: Import PaginatedResponse from types.ts
import { User, UserFormData, UserRole, Specialite, PaginatedResponse } from '../types';
import { MOCK_USERS } from '../constants'; 
import { generateUniqueId } from '../utils/helpers';

// Simulate a database for users
let mockUsers: User[] = [...MOCK_USERS]; // Use a mutable copy

// Removed local PaginatedResponse interface definition as it's imported from types.ts

const userService = {
  getUsers: async (params: { page?: number; limit?: number; search?: string } = {}): Promise<PaginatedResponse<User>> => {
    const { page = 1, limit = 10, search = '' } = params;
    await new Promise(resolve => setTimeout(resolve, 300));

    let filteredUsers = mockUsers;
    if (search) {
      const searchTermLower = search.toLowerCase();
      filteredUsers = mockUsers.filter(u =>
        u.nom.toLowerCase().includes(searchTermLower) ||
        u.prenom.toLowerCase().includes(searchTermLower) ||
        u.email.toLowerCase().includes(searchTermLower) ||
        u.username.toLowerCase().includes(searchTermLower) ||
        u.role.toLowerCase().includes(searchTermLower)
      );
    }
    
    filteredUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedData = filteredUsers.slice((page - 1) * limit, page * limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
      totalPages
    };
  },

  getUserById: async (id: string): Promise<User | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockUsers.find(u => u.id === id);
  },

  addUser: async (userData: UserFormData): Promise<User> => {
    await new Promise(resolve => setTimeout(resolve, 400));

    // Check for unique username
    if (mockUsers.some(u => u.username === userData.username)) {
      throw new Error(`Le nom d'utilisateur "${userData.username}" est déjà pris.`);
    }

    let emailToUse = userData.email;
    if (!emailToUse) { // If email wasn't provided by the form (new user creation by admin)
        if (!userData.username) { // Should be caught by validation, but defensive check
            throw new Error("Le nom d'utilisateur est requis pour générer un email par défaut.");
        }
        // Generate a default email based on username
        emailToUse = `${userData.username.toLowerCase().replace(/\s+/g, '.')}@caravanemedicale.app`;
    }

    // Check for unique email (either provided for edit, or generated for new user)
    if (mockUsers.some(u => u.email === emailToUse)) {
      throw new Error(`L'email "${emailToUse}" est déjà utilisé ou a été généré pour un autre utilisateur.`);
    }

    let passwordHash: string | undefined = undefined;
    if (userData.password) {
      // Simulate hashing
      passwordHash = `${userData.password}_hashed_simulated_${Date.now()}`;
    }
    
    // Create a new object for newUser, excluding plain password fields
    const { password, confirmPassword, ...restOfUserData } = userData;

    const newUser: User = {
      id: generateUniqueId(),
      username: restOfUserData.username!, // username is validated as required
      email: emailToUse!, // emailToUse is now guaranteed to be set
      nom: restOfUserData.nom!, // nom is validated as required
      prenom: restOfUserData.prenom!, // prenom is validated as required
      role: restOfUserData.role!, // role is validated as required
      actif: restOfUserData.actif !== undefined ? restOfUserData.actif : true, // Default to true
      specialite: restOfUserData.role === UserRole.MEDECIN_SPECIALISTE ? restOfUserData.specialite : undefined,
      passwordHash: passwordHash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockUsers.unshift(newUser);
    return newUser;
  },

  updateUser: async (id: string, userData: Partial<UserFormData>): Promise<User | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const userIndex = mockUsers.findIndex(u => u.id === id);
    if (userIndex > -1) {
       // Check for unique username and email if they are being changed
      if (userData.username && mockUsers.some(u => u.username === userData.username && u.id !== id)) {
        throw new Error(`Le nom d'utilisateur "${userData.username}" est déjà pris.`);
      }
      if (userData.email && mockUsers.some(u => u.email === userData.email && u.id !== id)) {
        throw new Error(`L'adresse email "${userData.email}" est déjà utilisée.`);
      }

      // Exclude password fields from update payload for existing users in this iteration
      // A separate "change password" flow would be more robust
      const { password, confirmPassword, ...restOfUpdateData } = userData;

      const updatedUser = { 
        ...mockUsers[userIndex], 
        ...restOfUpdateData, 
        updated_at: new Date().toISOString() 
      };
      
      // Ensure specialite is undefined if role is not MEDECIN_SPECIALISTE
      if (updatedUser.role !== UserRole.MEDECIN_SPECIALISTE) {
        updatedUser.specialite = undefined;
      } else if (!updatedUser.specialite && userData.role === UserRole.MEDECIN_SPECIALISTE){
        // If role changed to specialist but no specialty provided, this should be caught by validation ideally
      }


      mockUsers[userIndex] = updatedUser;
      return updatedUser;
    }
    return undefined;
  },

  deleteUser: async (id: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const initialLength = mockUsers.length;
    const userToDelete = mockUsers.find(u => u.id === id);
    
    // Basic check: do not delete the last admin (example, more robust logic might be needed)
    if (userToDelete?.role === UserRole.ADMIN) {
        const adminCount = mockUsers.filter(u => u.role === UserRole.ADMIN).length;
        if (adminCount <= 1) {
            throw new Error("Impossible de supprimer le dernier administrateur.");
        }
    }

    mockUsers = mockUsers.filter(u => u.id !== id);
    return mockUsers.length < initialLength;
  },
};

export default userService;