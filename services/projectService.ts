// services/projectService.ts - Fixed version
import { baseFetch } from './apiClient';
import { Project, ProjectResponse } from '../types/entities.types';
import { CONSTANTS } from '../types/constants';

// Type guard to ensure we have a valid project structure
const normalizeProject = (data: any): Project => {
  return {
    id: data.id || '',
    name: data.name || 'Untitled Project',
    description: data.description || undefined,
    createdAt: data.createdAt || data.created_at || new Date().toISOString(),
    threads: Array.isArray(data.threads) 
      ? data.threads.map((t: any) => typeof t === 'string' ? t : t.id || t.thread_id || '') 
      : [],
    color: data.color || '#6B7280'
  };
};

export class ProjectService {
  static async getProjects(): Promise<Project[]> {
    const response = await baseFetch(CONSTANTS.API_ENDPOINTS.PROJECTS);
    const data: ProjectResponse = await response.json();
    
    const projects = data.projects || [];
    return projects.map(normalizeProject);
  }

  static async createProject(projectData: {
    name: string;
    description?: string;
    color?: string;
  }): Promise<Project> {
    const response = await baseFetch(CONSTANTS.API_ENDPOINTS.PROJECTS, {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
    
    const data: ProjectResponse = await response.json();
    
    // Handle different response structures from API
    const rawProject = data.project || data;
    
    return normalizeProject(rawProject);
  }

  static async getProject(projectId: string): Promise<{ project: Project; threads: any[] }> {
    const response = await baseFetch(`${CONSTANTS.API_ENDPOINTS.PROJECTS}/${projectId}`);
    const data = await response.json();
    
    let threadObjs: any[] = [];
    let threadIds: string[] = [];
    
    if (Array.isArray(data.threads)) {
      threadObjs = data.threads;
      threadIds = threadObjs.map((t: any) => {
        if (typeof t === 'string') return t;
        return t.id || t.thread_id || t;
      });
    } else if (data.threads && typeof data.threads === 'object') {
      threadObjs = Object.values(data.threads);
      threadIds = threadObjs.map((t: any) => {
        if (typeof t === 'string') return t;
        return t.id || t.thread_id || t;
      });
    } else if (data.thread_ids && Array.isArray(data.thread_ids)) {
      threadIds = data.thread_ids;
    }

    // Remove duplicate thread IDs
    threadIds = Array.from(new Set(threadIds));
    
    // Normalize the project data with extracted thread IDs
    const project = normalizeProject({
      ...data,
      threads: threadIds
    });
    
    return {
      project,
      threads: threadObjs
    };
  }

  static async deleteProject(projectId: string): Promise<void> {
    await baseFetch(`${CONSTANTS.API_ENDPOINTS.PROJECTS}/${projectId}`, {
      method: 'DELETE',
    });
  }

}