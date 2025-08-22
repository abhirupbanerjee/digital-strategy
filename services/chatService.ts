import { baseFetch } from './apiClient';
import { ChatResponse } from '../types/entities.types';
import { CONSTANTS } from '../types/constants';

export class ChatService {
  static async sendMessage(data: {
    message: string;
    originalMessage: string;
    threadId?: string | null;
    webSearchEnabled?: boolean;
    fileIds?: string[];
  }): Promise<ChatResponse> {
    const response = await baseFetch(CONSTANTS.API_ENDPOINTS.CHAT, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    return response.json();
  }

  static async uploadFile(file: File): Promise<{ fileId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'assistants');
    
    const response = await baseFetch(CONSTANTS.API_ENDPOINTS.UPLOAD, {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set content-type for FormData
    });
    
    return response.json();
  }
}