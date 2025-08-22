import { baseFetch } from './apiClient';
import { Thread, Message } from '../types/entities.types';
import { CONSTANTS } from '../types/constants';

export class ThreadService {
  static async getThread(threadId: string): Promise<{ messages: Message[] }> {
    let response = await baseFetch(`${CONSTANTS.API_ENDPOINTS.THREADS}?threadId=${threadId}`);
    
    if (!response.ok) {
      response = await baseFetch(`${CONSTANTS.API_ENDPOINTS.THREADS}/${threadId}`);
    }
    
    const data = await response.json();
    
    let messages = [];
    if (data.messages) {
      messages = data.messages;
    } else if (data.thread && data.thread.messages) {
      messages = data.thread.messages;
    } else if (Array.isArray(data)) {
      messages = data;
    }
    
    return { messages };
  }

  static async saveThread(thread: Thread & { messages: Message[] }): Promise<void> {
    await baseFetch(CONSTANTS.API_ENDPOINTS.THREADS, {
      method: 'POST',
      body: JSON.stringify(thread),
    });
  }

  static async deleteThread(threadId: string): Promise<void> {
    await baseFetch(`${CONSTANTS.API_ENDPOINTS.THREADS}/${threadId}`, {
      method: 'DELETE',
    });
  }

  static async updateThreadTitles(projectId: string): Promise<any> {
    const response = await baseFetch('/api/update-thread-titles', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
    
    return response.json();
  }
}
