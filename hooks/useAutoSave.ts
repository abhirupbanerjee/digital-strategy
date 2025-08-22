// hooks/useAutoSave.ts
import { useState, useEffect, useCallback } from 'react';
import { Message, Thread }  from '../types/entities.types';

export const useAutoSave = (
  threadId: string | null,
  messages: Message[],
  currentProjectId: string | null,
  saveThread: (threadId: string, projectId: string, messages: Message[]) => Promise<Thread>,
  threads: Thread[]
) => {
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const shouldAutoSave = useCallback(() => {
    return threadId && 
           currentProjectId && 
           messages.length > 0 && 
           !threads.find(t => t.id === threadId);
  }, [threadId, currentProjectId, messages.length, threads]);

  const performAutoSave = useCallback(async () => {
    if (!shouldAutoSave()) return;

    setAutoSaveStatus('saving');
    try {
      await saveThread(threadId!, currentProjectId!, messages);
      setAutoSaveStatus('saved');
      
      // Reset to idle after showing saved status
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      setAutoSaveStatus('error');
      console.error('Auto-save failed:', error);
    }
  }, [shouldAutoSave, saveThread, threadId, currentProjectId, messages]);

  // Auto-save when conditions are met
  useEffect(() => {
    if (shouldAutoSave()) {
      const timeoutId = setTimeout(performAutoSave, 5000); // 5 second delay
      return () => clearTimeout(timeoutId);
    }
  }, [shouldAutoSave, performAutoSave]);

  return {
    autoSaveStatus,
    performAutoSave
  };
};