import { Message, Project, ShareLink, Thread } from "./entities.types";

export interface CopyOption {
  label: string;
  content: string;
  type: string;
}

export interface FileUploadState {
  uploading: boolean;
  files: File[];
  fileIds: string[];
}

export interface ChatState {
  messages: Message[];
  loading: boolean;
  typing: boolean;
  threadId: string | null;
  activeRun: boolean;
}

export interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  threads: Thread[];
  showProjectPanel: boolean;
}

export interface ShareState {
  showShareModal: boolean;
  shareLinks: ShareLink[];
  sharePermissions: 'read' | 'collaborate';
  shareExpiryDays: number;
  creatingShare: boolean;
}


