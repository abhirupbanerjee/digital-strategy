import { useState, useCallback } from 'react';

export const useWebSearch = () => {
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [searchInProgress, setSearchInProgress] = useState(false);

  const toggleWebSearch = useCallback(() => {
    setWebSearchEnabled(prev => !prev);
  }, []);

  return {
    webSearchEnabled,
    searchInProgress,
    setWebSearchEnabled,
    setSearchInProgress,
    toggleWebSearch
  };
};