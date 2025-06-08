
import { Caravane, CaravaneFormData, CaravaneStatut, Specialite, PaginatedResponse, User, UserRole } from '../types';
import { generateUniqueId } from '../utils/helpers';
import { MOCK_CARAVANES as initialMockCaravanes, MOCK_USERS } from '../constants'; // Import mock data

// Simulate a database for caravanes
let mockCaravanes: Caravane[] = [...initialMockCaravanes]; // Use a mutable copy of the imported mock data

const caravaneService = {
  getCaravanes: async (params: { page?: number; limit?: number; search?: string } = {}): Promise<PaginatedResponse<Caravane>> => {
    const { page = 1, limit = 10, search = '' } = params;
    await new Promise(resolve => setTimeout(resolve, 300));

    let filteredCaravanes = mockCaravanes;
    if (search) {
      const searchTermLower = search.toLowerCase();
      filteredCaravanes = mockCaravanes.filter(c =>
        c.nom.toLowerCase().includes(searchTermLower) ||
        c.lieu.toLowerCase().includes(searchTermLower) ||
        c.numero_unique.toLowerCase().includes(searchTermLower)
      );
    }
    
    filteredCaravanes.sort((a, b) => new Date(b.date_caravane).getTime() - new Date(a.date_caravane).getTime());

    const total = filteredCaravanes.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedData = filteredCaravanes.slice((page - 1) * limit, page * limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
      totalPages
    };
  },

  getCaravaneById: async (id: string): Promise<Caravane | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockCaravanes.find(c => c.id === id);
  },

  addCaravane: async (caravaneData: CaravaneFormData): Promise<Caravane> => {
    await new Promise(resolve => setTimeout(resolve, 400));

    const allSelectedIds = [
      ...(caravaneData.selectedGPIds || []),
      ...(caravaneData.selectedSpecialistIds || []),
      ...(caravaneData.selectedAccueilIds || [])
    ];
    
    const uniqueSelectedIds = Array.from(new Set(allSelectedIds));

    const equipe_medicale = uniqueSelectedIds
        .map(id => MOCK_USERS.find(user => user.id === id))
        .filter(user => user !== undefined) as User[];

    // Destructure to exclude the ID arrays from being directly spread onto newCaravane
    const { selectedGPIds, selectedSpecialistIds, selectedAccueilIds, ...restOfCaravaneData } = caravaneData;

    const newCaravane: Caravane = {
      id: generateUniqueId(),
      numero_unique: `CAR-${generateUniqueId().substring(0,6)}`,
      ...restOfCaravaneData,
      equipe_medicale: equipe_medicale,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockCaravanes.unshift(newCaravane);
    return newCaravane;
  },

  updateCaravane: async (id: string, caravaneData: Partial<CaravaneFormData>): Promise<Caravane | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const caravaneIndex = mockCaravanes.findIndex(c => c.id === id);
    if (caravaneIndex > -1) {
      const existingCaravane = mockCaravanes[caravaneIndex];
      
      let equipeMedicaleToUpdate = existingCaravane.equipe_medicale || [];

      if (caravaneData.selectedGPIds || caravaneData.selectedSpecialistIds || caravaneData.selectedAccueilIds) {
          const allSelectedIds = Array.from(new Set([
            ...(caravaneData.selectedGPIds || []),
            ...(caravaneData.selectedSpecialistIds || []),
            ...(caravaneData.selectedAccueilIds || [])
          ]));
          
          equipeMedicaleToUpdate = allSelectedIds
            .map(staffId => MOCK_USERS.find(user => user.id === staffId))
            .filter(user => user !== undefined) as User[];
      }
      
      const { selectedGPIds, selectedSpecialistIds, selectedAccueilIds, ...restOfUpdateData } = caravaneData;

      mockCaravanes[caravaneIndex] = { 
        ...existingCaravane, 
        ...restOfUpdateData,
        equipe_medicale: equipeMedicaleToUpdate, 
        updated_at: new Date().toISOString() 
      };
      return mockCaravanes[caravaneIndex];
    }
    return undefined;
  },

  deleteCaravane: async (id: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    const initialLength = mockCaravanes.length;
    mockCaravanes = mockCaravanes.filter(c => c.id !== id);
    return mockCaravanes.length < initialLength;
  },
};

export default caravaneService;