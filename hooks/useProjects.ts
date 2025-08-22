import { useState, useCallback } from 'react';
import { Project } from '../types/entities.types';
import { ProjectService } from '../services/projectService';
import { formatErrorMessage, logError } from '../utils/errorHandler';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const projectsData = await ProjectService.getProjects();
      setProjects(projectsData);
      
      if (projectsData.length === 0) {
        // Auto-create default project if none exist
        const defaultProject = await ProjectService.createProject({
          name: "Default",
          description: "Default project for conversations",
          color: "#6B7280"
        });
        setProjects([defaultProject]);
        setCurrentProject(defaultProject);
      }
    } catch (error) {
      logError(error, 'Load projects');
      throw new Error(formatErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(async (projectData: {
    name: string;
    description?: string;
    color?: string;
  }) => {
    try {
      const newProject = await ProjectService.createProject(projectData);
      setProjects(prev => [...prev, newProject]);
      setCurrentProject(newProject);
      return newProject;
    } catch (error) {
      logError(error, 'Create project');
      throw new Error(formatErrorMessage(error));
    }
  }, []);

  const deleteProject = useCallback(async (projectId: string) => {
    try {
      await ProjectService.deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }
    } catch (error) {
      logError(error, 'Delete project');
      throw new Error(formatErrorMessage(error));
    }
  }, [currentProject]);

  const loadProject = useCallback(async (projectId: string) => {
    try {
      const { project } = await ProjectService.getProject(projectId);
      setCurrentProject(project);
      
      // Update projects list
      setProjects(prev => prev.map(p => p.id === projectId ? project : p));
      
      return project;
    } catch (error) {
      logError(error, 'Load project');
      throw new Error(formatErrorMessage(error));
    }
  }, []);

  return {
    projects,
    currentProject,
    loading,
    setCurrentProject,
    loadProjects,
    createProject,
    deleteProject,
    loadProject
  };
};
