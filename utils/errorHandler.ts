export const formatErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error?.message) return error.message;
  return 'An unexpected error occurred';
};

export const showErrorToast = (message: string): void => {
  // In a real implementation, you'd use a toast library
  console.error('Error:', message);
  alert(`Error: ${message}`);
};

export const logError = (error: any, context?: string): void => {
  console.error(context ? `${context}:` : 'Error:', error);
};