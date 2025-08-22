import { useState, useCallback } from 'react';
import { Thread, Message } from '../types/entities.types';
import { ThreadService } from '../services/threadService';
import { formatErrorMessage, logError } from '../utils/errorHandler';
import { cleanSearchArtifactsFromContent } from '../utils/contentUtils';
import { generateContextualTitle } from '../utils/threadUtils';

export const useThreads = () => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);

  const loadThread = useCallback(async (threadId: string): Promise<Message[]> => {
    setLoading(true);
    try {
      const { messages } = await ThreadService.getThread(threadId);
      
      // Clean messages when loading old threads
      const cleanedMessages = messages.map((msg: Message) => ({
        ...msg,
        content: typeof msg.content === 'string' ? cleanSearchArtifactsFromContent(msg.content) : msg.content
      }));
      
      return cleanedMessages;
    } catch (error) {
      logError(error, 'Load thread');
      throw new Error(formatErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const saveThread = useCallback(async (
    threadId: string,
    projectId: string,
    messages: Message[]
  ) => {
    try {
      const smartTitle = generateContextualTitle(messages);
      
      const thread: Thread = {
        id: threadId,
        projectId,
        title: smartTitle,
        lastMessage: messages[messages.length - 1]?.content?.substring(0, 100) || '',
        createdAt: new Date().toISOString()
      };

      await ThreadService.saveThread({ ...thread, messages });
      
      setThreads(prev => [...prev.filter(t => t.id !== threadId), thread]);
      
      return thread;
    } catch (error) {
      logError(error, 'Save thread');
      throw new Error(formatErrorMessage(error));
    }
  }, []);

  const deleteThread = useCallback(async (threadId: string) => {
    try {
      await ThreadService.deleteThread(threadId);
      setThreads(prev => prev.filter(t => t.id !== threadId));
    } catch (error) {
      logError(error, 'Delete thread');
      throw new Error(formatErrorMessage(error));
    }
  }, []);

  const updateThreadsFromProject = useCallback((projectThreads: any[], projectId: string) => {
    const newThreads = projectThreads.map((t: any) => ({
      id: t.id || t.thread_id,
      projectId,
      title: t.title || t.name || 'Untitled',
      lastMessage: t.lastMessage || t.last_message || '',
      createdAt: t.createdAt || t.created_at || new Date().toISOString()
    })).filter(t => t.id);
    
    setThreads(prev => {
      const threadIds = newThreads.map(t => t.id);
      const filteredPrev = prev.filter(t => !threadIds.includes(t.id));
      return [...filteredPrev, ...newThreads];
    });
  }, []);

  return {
    threads,
    loading,
    setThreads,
    loadThread,
    saveThread,
    deleteThread,
    updateThreadsFromProject
  };
};