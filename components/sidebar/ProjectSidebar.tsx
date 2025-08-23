// components/sidebar/ProjectSidebar.tsx
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Project, Thread } from '../../types/entities.types';
import { ProjectList } from './ProjectList';
import { ThreadList } from './ThreadList';

interface ProjectSidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  projects: Project[];
  currentProject: Project | null;
  threads: Thread[];
  currentThreadId: string | null;
  onClose: () => void;
  onSelectProject: (project: Project) => void;
  onSelectThread: (threadId: string) => void;
  onNewProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onNewChat: () => void;
  onSyncThreads?: (projectId: string, threadIds: string[]) => void;
  onShareThread?: (thread: { id: string; title: string }) => void;
}

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  isOpen,
  isMobile,
  projects,
  currentProject,
  threads,
  currentThreadId,
  onClose,
  onSelectProject,
  onSelectThread,
  onNewProject,
  onDeleteProject,
  onDeleteThread,
  onShareThread,
  onNewChat,
  onSyncThreads
}) => {
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-30 p-4 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Projects</h3>
          <div className="flex gap-2">
            <button
              onClick={onNewProject}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              + New
            </button>
            {currentProject && !isMobile && onSyncThreads && (
              <button
                onClick={() => onSyncThreads(currentProject.id, currentProject.threads)}
                className="text-green-600 hover:text-green-700 text-sm"
              >
                🔄 Sync
              </button>
            )}
            {isMobile && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {currentProject && (
          <div className="mt-2 p-2 bg-blue-50 rounded-md">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: currentProject.color }}
              />
              <span className="text-sm font-medium">{currentProject.name}</span>
            </div>
            {currentProject.description && (
              <p className="text-xs text-gray-600 mt-1">{currentProject.description}</p>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <ProjectList
          projects={projects}
          currentProject={currentProject}
          onSelectProject={onSelectProject}
          onDeleteProject={onDeleteProject}
          isMobile={isMobile}
        />

        {currentProject && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Recent Chats {threads.filter(t => currentProject.threads.includes(t.id)).length > 0 && 
                `(${threads.filter(t => currentProject.threads.includes(t.id)).length})`}
            </h4>
            <ThreadList
              threads={threads.filter(t => {
                // Check if thread ID exists in project's thread list
                if (typeof t.id === 'string' && Array.isArray(currentProject.threads)) {
                  return currentProject.threads.some(projectThreadId => 
                    projectThreadId === t.id || 
                    projectThreadId.includes(t.id) || 
                    t.id.includes(projectThreadId)
                  );
                }
                return false;
              })}
              currentThreadId={currentThreadId}
              onSelectThread={onSelectThread}
              onDeleteThread={onDeleteThread}
              onShareThread={onShareThread}
              isMobile={isMobile}
            />

            <button
              onClick={onNewChat}
              className="mt-2 w-full text-center text-sm text-blue-600 hover:text-blue-700 py-2"
            >
              + Start New Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="fixed inset-y-0 left-0 z-50 w-80 bg-gray-50"
          >
            {sidebarContent}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className={`relative bg-white/80 backdrop-blur flex flex-col ring-1 ring-gray-200 shadow-sm transition-[width] duration-300 ease-in-out ${isOpen ? "w-80" : "w-0 overflow-hidden"}`}>
      {sidebarContent}
    </div>
  );
};