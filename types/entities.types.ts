export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | any;
  files?: MessageFile[];
  timestamp?: string;
  fileIds?: string[];
}

export interface MessageFile {
  type: string;
  file_id?: string;
  url?: string;
  description: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  threads: string[];
  color?: string;
}

export interface Thread {
  id: string;
  projectId?: string;
  title: string;
  lastMessage?: string;
  createdAt: string;
  lastActivity?: string;
  isSaved?: boolean;
  isNew?: boolean;
}

export interface ShareLink {
  id: string;
  share_token: string;
  permissions: 'read' | 'collaborate';
  expires_at: string;
  created_at: string;
  shareUrl: string;
}

// types/api.types.ts
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success?: boolean;
}

export interface ChatResponse {
  reply: string;
  threadId?: string;
  files?: MessageFile[];
}

// Fix: Make ProjectResponse more flexible to handle API variations
export interface ProjectResponse {
  project?: Partial<Project>; // API might return incomplete project data
  projects?: Partial<Project>[]; // Same for projects array
  [key: string]: any; // Allow for additional fields from API
}

export interface ThreadResponse {
  thread?: Thread;
  threads?: Thread[];
  messages?: Message[];
}

