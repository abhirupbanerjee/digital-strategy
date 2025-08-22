// components/sidebar/ThreadList.tsx
import React, { useState } from 'react';
import { Thread } from '../../types/entities.types';

interface ThreadListProps {
  threads: Thread[];
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onShareThread?: (thread: { id: string; title: string }) => void;
  isMobile: boolean;
}

export const ThreadList: React.FC<ThreadListProps> = ({
  threads,
  currentThreadId,
  onSelectThread,
  onDeleteThread,
  onShareThread,
  isMobile
}) => {
  const [showDeleteMenu, setShowDeleteMenu] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      {threads.slice(0, 5).map((thread) => (
        <div key={thread.id} className="relative group">
          <button
            onClick={() => onSelectThread(thread.id)}
            className={`w-full text-left p-2 rounded text-sm ${
              currentThreadId === thread.id
                ? 'bg-blue-50 text-blue-700'
                : 'hover:bg-gray-100'
            }`}
          >
            <div className="truncate">{thread.title}</div>
            <div className="text-xs text-gray-500 truncate">
              {thread.lastMessage}
            </div>
          </button>
          
          {/* Desktop thread menu */}
          {!isMobile && (
            <div className="absolute top-2 right-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteMenu(showDeleteMenu === thread.id ? null : thread.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
                title="Thread options"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              
              {showDeleteMenu === thread.id && (
                <div className="absolute right-0 top-8 bg-white rounded-xl ring-1 ring-gray-100 shadow-lg py-1 z-20 min-w-[140px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onShareThread) onShareThread({ id: thread.id, title: thread.title });
                      setShowDeleteMenu(null);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                  >
                    🔗 Share Thread
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread(thread.id);
                      setShowDeleteMenu(null);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    🗑️ Delete Thread
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Mobile delete menu */}
          {isMobile && (
            <div className="absolute top-2 right-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteMenu(showDeleteMenu === thread.id ? null : thread.id);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              
              {showDeleteMenu === thread.id && (
                <div className="absolute right-0 top-6 bg-white rounded-xl ring-1 ring-gray-100 shadow-lg py-1 z-20 min-w-[100px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread(thread.id);
                      setShowDeleteMenu(null);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete Chat
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