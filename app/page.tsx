"use client";

// app/page.tsx - Refactored to ~150 lines
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Types
import { Message } from '../types/entities.types';

// Hooks
import { useProjects } from '../hooks/useProjects';
import { useThreads } from '../hooks/useThreads';
import { useChat } from '../hooks/useChat';
import { useWebSearch } from '../hooks/useWebSearch';
import { useAutoSave } from '../hooks/useAutoSave';

// Components
import { ProjectSidebar } from '../components/sidebar/ProjectSidebar';
import { MessageList } from '../components/chat/MessageList';
import { ChatInput } from '../components/chat/ChatInput';
import { WebSearchToggle } from '../components/chat/WebSearchToggle';
import { NewProjectModal } from '../components/modals/NewProjectModal';
import ThreadShareModal from "./components/ThreadShareModal";

// Utils
import { formatErrorMessage } from '../utils/errorHandler';
import { ProjectService } from '../services/projectService';

const ChatApp: React.FC = () => {
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Modal States
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showThreadShareModal, setShowThreadShareModal] = useState(false);
  const [selectedThreadForShare, setSelectedThreadForShare] = useState<{ id: string; title: string } | null>(null);

  // Custom Hooks
  const {
    projects,
    currentProject,
    loading: projectsLoading,
    loadProjects,
    createProject,
    deleteProject,
    loadProject
  } = useProjects();

  const {
    threads,
    saveThread,
    deleteThread: deleteThreadService,
    updateThreadsFromProject,
    loadThread
  } = useThreads();

  const {
    messages,
    loading: chatLoading,
    typing,
    threadId,
    setThreadId,
    sendMessage,
    clearChat,
    setMessagesFromThread
  } = useChat();

  const {
    webSearchEnabled,
    searchInProgress,
    setSearchInProgress,
    toggleWebSearch
  } = useWebSearch();

  const { autoSaveStatus } = useAutoSave(
    threadId,
    messages,
    currentProject?.id || null,
    saveThread,
    threads
  );

  // Check for mobile device
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initial load
  useEffect(() => {
    loadProjects().catch(err => {
      console.error('Failed to load projects:', err);
      setShowProjectPanel(true);
      setShowNewProjectModal(true);
    });
  }, [loadProjects]);

  // Event Handlers
  const handleSendMessage = async (message: string, fileIds: string[]) => {
    try {
      setSearchInProgress(webSearchEnabled);
      const response = await sendMessage(message, webSearchEnabled, fileIds);
      
      // Auto-save to current project if new thread created
      if (response.threadId && response.threadId !== threadId && currentProject) {
        await saveThread(response.threadId, currentProject.id, [
          ...messages,
          { role: 'user', content: message, timestamp: new Date().toLocaleString() },
          { role: 'assistant', content: response.reply, timestamp: new Date().toLocaleString() }
        ]);
        // Reload project to show new thread at top
        await loadProject(currentProject.id);
      }
    } catch (error) {
      console.error('Send message error:', error);
      alert(formatErrorMessage(error));
    } finally {
      setSearchInProgress(false);
    }
  };

  const handleSelectProject = async (project: any) => {
    try {
      const loadedProject = await loadProject(project.id);
      
      // Get the actual thread objects from the project
      const { threads: projectThreads } = await ProjectService.getProject(project.id);
      
      // Update threads with the actual thread data
      updateThreadsFromProject(projectThreads || [], project.id);
      
      // Get unique thread IDs for loading
      const uniqueThreadIds = loadedProject.threads 
        ? Array.from(new Set(loadedProject.threads))
        : [];
      
      // Load first thread if available
      if (uniqueThreadIds.length > 0) {
        const threadMessages = await loadThread(uniqueThreadIds[0]);
        setMessagesFromThread(threadMessages);
        setThreadId(uniqueThreadIds[0]);
      } else {
        clearChat();
      }
      
      setShowProjectPanel(false);
    } catch (error) {
      console.error('Select project error:', error);
      alert(formatErrorMessage(error));
    }
  };

  const handleSelectThread = async (threadId: string) => {
    try {
      const threadMessages = await loadThread(threadId);
      setMessagesFromThread(threadMessages);
      setThreadId(threadId);
      
      if (isMobile) {
        setShowProjectPanel(false);
      }
    } catch (error) {
      console.error('Select thread error:', error);
      alert(formatErrorMessage(error));
    }
  };

  const handleCreateProject = async (projectData: { name: string; description?: string; color?: string }) => {
    try {
      await createProject(projectData);
      setShowNewProjectModal(false);
      setShowProjectPanel(true);
    } catch (error) {
      console.error('Create project error:', error);
      alert(formatErrorMessage(error));
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Delete this project and all its chats? This cannot be undone.')) {
      return;
    }
    
    try {
      await deleteProject(projectId);
      if (currentProject?.id === projectId) {
        clearChat();
      }
    } catch (error) {
      console.error('Delete project error:', error);
      alert(formatErrorMessage(error));
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    if (!confirm('Delete this chat? This cannot be undone.')) {
      return;
    }
    
    try {
      await deleteThreadService(threadId);
      if (threadId === threadId) {
        clearChat();
      }
    } catch (error) {
      console.error('Delete thread error:', error);
      alert(formatErrorMessage(error));
    }
  };



  const handleNewChat = () => {
    clearChat();
    setShowProjectPanel(false);
  };

  const openThreadShareModal = (thread: { id: string; title: string }) => {
    setSelectedThreadForShare(thread);
    setShowThreadShareModal(true);
  };

  const closeThreadShareModal = () => {
    setShowThreadShareModal(false);
    setSelectedThreadForShare(null);
  };

  return (
    <div className="h-[100svh] md:h-screen w-full flex flex-col bg-neutral-50 md:flex-row overflow-hidden">
      {/* Sidebar */}
      <ProjectSidebar
        isOpen={isMobile ? showProjectPanel : sidebarOpen}
        isMobile={isMobile}
        projects={projects}
        currentProject={currentProject}
        threads={threads}
        currentThreadId={threadId}
        onClose={() => setShowProjectPanel(false)}
        onSelectProject={handleSelectProject}
        onSelectThread={handleSelectThread}
        onNewProject={() => setShowNewProjectModal(true)}
        onDeleteProject={handleDeleteProject}
        onDeleteThread={handleDeleteThread}
        onShareThread={openThreadShareModal}
        onNewChat={handleNewChat}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 w-full p-3 md:p-4 bg-white/80 backdrop-blur border-b border-gray-200">
          <div className="relative flex items-center justify-between">
            {/* Toggle Button */}
            {!isMobile ? (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h10" />
                </svg>
                <span className="text-sm text-gray-700">{sidebarOpen ? "Hide panel" : "Show panel"}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowProjectPanel(!showProjectPanel)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}

            {/* Title */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              {!isMobile && <img src="/icon.png" alt="Icon" className="h-8 w-8 md:h-10 md:w-10" />}
              <h2 className={`font-semibold tracking-tight text-gray-900 ${isMobile ? 'text-base' : 'text-lg md:text-xl'}`}>
                Digital Strategy Bot
              </h2>
            </div>

            {/* Project Info */}
            <div className="flex items-center gap-2">
              {!isMobile && currentProject && (
                <>
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: currentProject.color }}
                  />
                  <span className="text-sm">{currentProject.name}</span>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Messages */}
        <MessageList 
          messages={messages} 
          typing={typing} 
          isMobile={isMobile} 
        />

        {/* Controls */}
        <div className="border-t bg-gray-50">
          <div className="p-3">
            <WebSearchToggle
              enabled={webSearchEnabled}
              searchInProgress={searchInProgress}
              onToggle={toggleWebSearch}
              isMobile={isMobile}
            />
          </div>
        </div>

        {/* Input */}
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={chatLoading || projectsLoading}
          isMobile={isMobile}
        />
      </div>

      {/* Modals */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreateProject={handleCreateProject}
      />

      {showThreadShareModal && selectedThreadForShare && (
        <ThreadShareModal
          isOpen={showThreadShareModal}
          onClose={closeThreadShareModal}
          threadId={selectedThreadForShare.id}
          threadTitle={selectedThreadForShare.title}
        />
      )}

      {/* Click outside handler for mobile */}
      {isMobile && showProjectPanel && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setShowProjectPanel(false)}
        />
      )}
    </div>
  );
};

export default ChatApp;