import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareLink {
  id: string;
  share_token: string;
  permissions: 'read' | 'collaborate';
  expires_at: string;
  created_at: string;
  shareUrl: string;
}

interface ShareModalProps {
  currentProject: { id: string; name: string } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ currentProject, isOpen, onClose }: ShareModalProps) {
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [sharePermissions, setSharePermissions] = useState<'read' | 'collaborate'>('read');
  const [shareExpiryDays, setShareExpiryDays] = useState(1);
  const [creatingShare, setCreatingShare] = useState(false);

  const loadProjectShares = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/shares`);
      if (response.ok) {
        const data = await response.json();
        setShareLinks(data.shares || []);
      }
    } catch (error) {
      console.error('Load shares error:', error);
    }
  };

  const createShareLink = async () => {
    if (!currentProject || creatingShare) return;
    
    setCreatingShare(true);
    try {
      const response = await fetch(`/api/projects/${currentProject.id}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: sharePermissions,
          expiryDays: shareExpiryDays
        })
      });

      if (!response.ok) throw new Error('Failed to create share link');
      
      const data = await response.json();
      
      await navigator.clipboard.writeText(data.shareUrl);
      alert(`Share link created and copied!\nExpires: ${new Date(data.expiresAt).toLocaleString()}`);
      
      loadProjectShares(currentProject.id);
      
    } catch (error) {
      console.error('Create share error:', error);
      alert('Failed to create share link');
    } finally {
      setCreatingShare(false);
    }
  };

  const revokeShareLink = async (shareToken: string) => {
    if (!currentProject || !confirm('Revoke this share link?')) return;
    
    try {
      const response = await fetch(`/api/projects/${currentProject.id}/shares?token=${shareToken}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to revoke share');
      loadProjectShares(currentProject.id);
      
    } catch (error) {
      console.error('Revoke share error:', error);
      alert('Failed to revoke share link');
    }
  };

  const copyShareLink = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    } catch (error) {
      console.error('Copy error:', error);
    }
  };

  useEffect(() => {
    if (currentProject && isOpen) {
      loadProjectShares(currentProject.id);
    }
  }, [currentProject, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && currentProject && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>🔗</span>
              Share "{currentProject.name}"
            </h3>
            
            {/* Create New Share */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium mb-3">Create New Share Link</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access Level
                  </label>
                  <select
                    value={sharePermissions}
                    onChange={(e) => setSharePermissions(e.target.value as 'read' | 'collaborate')}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="read">👁️ Read Only - Can view conversations</option>
                    <option value="collaborate">✏️ Collaborate - Can chat and contribute</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expires In
                  </label>
                  <select
                    value={shareExpiryDays}
                    onChange={(e) => setShareExpiryDays(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 Day (Default)</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>1 Week</option>
                    <option value={14}>2 Weeks</option>
                    <option value={30}>1 Month</option>
                  </select>
                </div>
                
                <button
                  onClick={createShareLink}
                  disabled={creatingShare}
                  className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium"
                >
                  {creatingShare ? 'Creating...' : '🔗 Create & Copy Link'}
                </button>
              </div>
            </div>
            
            {/* Existing Shares */}
            <div>
              <h4 className="font-medium mb-3">Active Share Links ({shareLinks.length})</h4>
              
              {shareLinks.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  No active share links. Create one above.
                </p>
              ) : (
                <div className="space-y-2">
                  {shareLinks.map((share) => {
                    const isExpired = new Date(share.expires_at) < new Date();
                    return (
                      <div
                        key={share.id}
                        className={`border rounded-lg p-3 ${isExpired ? 'bg-red-50 border-red-200' : 'bg-white'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            share.permissions === 'collaborate' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {share.permissions === 'collaborate' ? '✏️ Collaborate' : '👁️ Read Only'}
                          </span>
                          
                          <div className="flex gap-1">
                            {!isExpired && (
                              <button
                                onClick={() => copyShareLink(share.shareUrl)}
                                className="text-blue-600 hover:text-blue-700 text-sm px-2 py-1"
                              >
                                📋 Copy
                              </button>
                            )}
                            <button
                              onClick={() => revokeShareLink(share.share_token)}
                              className="text-red-600 hover:text-red-700 text-sm px-2 py-1"
                            >
                              🗑️ Revoke
                            </button>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-600">
                          <div>Created: {new Date(share.created_at).toLocaleDateString()}</div>
                          <div className={isExpired ? 'text-red-600 font-medium' : ''}>
                            {isExpired ? 'Expired: ' : 'Expires: '}
                            {new Date(share.expires_at).toLocaleString()}
                          </div>
                        </div>
                        
                        {!isExpired && (
                          <div className="mt-2 text-xs text-gray-500 break-all bg-gray-50 p-1 rounded">
                            {share.shareUrl}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={onClose}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

