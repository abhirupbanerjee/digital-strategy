// components/chat/WebSearchToggle.tsx
import React from 'react';

interface WebSearchToggleProps {
  enabled: boolean;
  searchInProgress?: boolean;
  onToggle: () => void;
  isMobile?: boolean;
}

export const WebSearchToggle: React.FC<WebSearchToggleProps> = ({
  enabled,
  searchInProgress = false,
  onToggle,
  isMobile = false
}) => {
  if (isMobile) {
    return (
      <button
        onClick={onToggle}
        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
          enabled 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-200 text-gray-700'
        }`}
        title="When enabled, AI will search the web when it needs current information"
      >
        🌐 Allow AI Web Search {enabled && '✓'}
      </button>
    );
  }

  return (
    <label className="flex items-center cursor-pointer" title="When enabled, AI will search the web when it needs current information">
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        className="mr-2 w-4 h-4 text-blue-600 rounded"
      />
      <span className="text-sm flex items-center gap-1">
        {searchInProgress ? (
          <span className="animate-pulse">🔍</span>
        ) : (
          <span>🌐</span>
        )}
        Allow AI Web Search
        {enabled && (
          <span className="text-xs text-green-600 font-semibold ml-1">✓</span>
        )}
      </span>
    </label>
  );
};