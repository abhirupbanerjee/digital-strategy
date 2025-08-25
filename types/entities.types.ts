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
  blob_url?: string; // ADDED: Support for Vercel Blob storage URLs
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

// ADDED: Thread file context interfaces
export interface ThreadFileContext {
  id: string;
  thread_id: string;
  file_id: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  relevance_score: number;
  last_used: string;
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

export interface ActiveThreadFile {
  openai_file_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  last_used: string;
  usage_count: number;
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