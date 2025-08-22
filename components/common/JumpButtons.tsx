import React from 'react';

interface JumpButtonsProps {
  onJumpToTop: () => void;
  onJumpToBottom: () => void;
  visible: boolean;
}

export const JumpButtons: React.FC<JumpButtonsProps> = ({ 
  onJumpToTop, 
  onJumpToBottom, 
  visible 
}) => {
  if (!visible) return null;

  return (
    <div className="absolute right-4 bottom-20 flex flex-col gap-2 z-30">
      <button
        onClick={onJumpToTop}
        className="w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 opacity-80 hover:opacity-100"
        title="Jump to top"
      >
        ↑
      </button>
      <button
        onClick={onJumpToBottom}
        className="w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 opacity-80 hover:opacity-100"
        title="Jump to bottom"
      >
        ↓
      </button>
    </div>
  );
};
