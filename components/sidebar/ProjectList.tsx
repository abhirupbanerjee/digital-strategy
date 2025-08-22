// components/sidebar/ProjectList.tsx
import React, { useState } from 'react';
import { Project } from '../../types/entities.types';

interface ProjectListProps {
  projects: Project[];
  currentProject: Project | null;
  onSelectProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  isMobile: boolean;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  currentProject,
  onSelectProject,
  onDeleteProject,
  isMobile
}) => {
  const [showDeleteMenu, setShowDeleteMenu] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <div key={project.id} className="relative group">
          <button
            onClick={() => onSelectProject(project)}
            className={`w-full text-left p-3 rounded-lg transition-colors ${
              currentProject?.id === project.id
                ? 'bg-blue-100 border-blue-300'
                : 'bg-white hover:bg-gray-100'
            } border`}
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: project.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{project.name}</div>
                <div className="text-xs text-gray-500">
                  {Array.isArray(project.threads) ? project.threads.length : 0} chat(s)
                </div>
              </div>
            </div>
          </button>
          
          {/* Desktop delete button */}
          {!isMobile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteProject(project.id);
              }}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
              title="Delete project"
            >
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          
          {/* Mobile three-dot menu */}
          {isMobile && (
            <div className="absolute top-2 right-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteMenu(showDeleteMenu === project.id ? null : project.id);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              
              {showDeleteMenu === project.id && (
                <div className="absolute right-0 top-8 bg-white rounded-xl ring-1 ring-gray-100 shadow-lg py-1 z-20 min-w-[120px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(project.id);
                      setShowDeleteMenu(null);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete Project
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
