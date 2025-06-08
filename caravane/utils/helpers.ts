
export const generateUniqueId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const formatDate = (dateString?: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  if (!dateString) return 'N/A';
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  };
  try {
    return new Date(dateString).toLocaleDateString('fr-FR', defaultOptions);
  } catch (error) {
    console.warn("Invalid date string for formatDate:", dateString);
    return 'Date invalide';
  }
};

export const formatDateTime = (dateString?: string | Date): string => {
  if (!dateString) return 'N/A';
   const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  try {
    return new Date(dateString).toLocaleDateString('fr-FR', options);
  } catch (error) {
    console.warn("Invalid date string for formatDateTime:", dateString);
    return 'Date invalide';
  }
};
