// app/components/ThreadShareModal.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThreadShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  threadId: string;
  threadTitle: string;
}

interface ThreadShare {
  id: string;
  share_token: string;
  permissions: 'read' | 'collaborate';
  expires_at: string;
  created_at: string;
  shareUrl: string;
  isExpired: boolean;
}

export default function ThreadShareModal({ 
  isOpen, 
  onClose, 
  threadId, 
  threadTitle 
}: ThreadShareModalProps) {
  const [shares, setShares] = useState<ThreadShare[]>([]);
  const [permissions, setPermissions] = useState<'read' | 'collaborate'>('read');
  const [expiryDays, setExpiryDays] = useState(1);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Load existing shares when modal opens
  useEffect(() => {
    if (isOpen && threadId) {
      loadShares();
    }
  }, [isOpen, threadId]);

  const loadShares = async () => {
    try {
      console.log('Loading shares for thread:', threadId);
      const response = await fetch(`/api/threads/${threadId}/shares`);
      
      if (!response.ok) {
        console.error('Failed to load shares:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        return;
      }
      
      const data = await response.json();
      console.log('Shares loaded:', data);
      setShares(data.shares || []);
    } catch (error) {
      console.error('Error loading shares:', error);
    }
  };

  const createShareLink = async () => {
    if (creating) return;
    
    setCreating(true);
    try {
      const response = await fetch(`/api/threads/${threadId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions,
          expiryDays
        })
      });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`Failed to create share link: ${response.status}`);
          }
            
      const data = await response.json();
      
      // Try to copy to clipboard
      try {
        await navigator.clipboard.writeText(data.shareUrl);
        alert(`Share link created and copied!\nExpires: ${new Date(data.expiresAt).toLocaleString()}`);
      } catch (clipboardError) {
        // Fallback for mobile/browsers without clipboard access
        alert(`Share link created!\nExpires: ${new Date(data.expiresAt).toLocaleString()}\n\nLink: ${data.shareUrl}\n\n(Please copy manually)`);
      }
      
      // Reload shares list
      loadShares();
      
    } catch (error) {
      console.error('Create share error:', error);
      alert('Failed to create share link');
    } finally {
      setCreating(false);
    }
  };

  const downloadZip = async () => {
    if (downloading) return;
    
    setDownloading(true);
    try {
      const response = await fetch(`/api/threads/${threadId}/download`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to generate download');
      }

      // Download the ZIP file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thread-${threadId.substring(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      alert('Download started! The ZIP file contains the conversation PDF and all referenced files.');

    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to generate download');
    } finally {
      setDownloading(false);
    }
  };

  const revokeShare = async (shareToken: string) => {
    if (!confirm('Revoke this share link?')) return;
    
    try {
      const response = await fetch(`/api/threads/${threadId}/shares?token=${shareToken}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadShares();
      } else {
        throw new Error('Failed to revoke share');
      }
    } catch (error) {
      console.error('Revoke share error:', error);
      alert('Failed to revoke share link');
    }
  };

  const copyShareUrl = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    } catch (error) {
      // Fallback for mobile
      alert(`Share link:\n${shareUrl}\n\n(Please copy manually)`);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
        style={{ zIndex: 9999 }}
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
            <span>Share Thread</span>
          </h3>
          <div className="text-sm text-gray-600 mb-4">
            "{threadTitle}"
          </div>
          
          {/* Main Action Buttons */}
          <div className="grid grid-cols-1 gap-3 mb-6">
            {/* Create Share Link Section */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-3">Share Options</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access Level
                  </label>
                  <select
                    value={permissions}
                    onChange={(e) => setPermissions(e.target.value as 'read' | 'collaborate')}
                    className="w-full rounded-lg ring-1 ring-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="read">Read Only - Can view conversation</option>
                    <option value="collaborate">Collaborate - Can chat and contribute</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expires In
                  </label>
                  <select
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    className="w-full rounded-lg ring-1 ring-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 Day (Default)</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>1 Week</option>
                    <option value={14}>2 Weeks</option>
                    <option value={30}>1 Month</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={createShareLink}
                    disabled={creating}
                    className="py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium text-sm"
                  >
                    {creating ? 'Creating...' : 'Get Share Link'}
                  </button>
                  
                  <button
                    onClick={downloadZip}
                    disabled={downloading}
                    className="py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-sm"
                  >
                    {downloading ? 'Generating...' : 'Download ZIP'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Existing Shares */}
          {shares.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Active Share Links ({shares.length})</h4>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {shares.map((share) => {
                  const isExpired = new Date(share.expires_at) < new Date();
                  return (
                    <div
                      key={share.id}
                      className={`rounded-lg ring-1 ring-gray-200 p-3 ${isExpired ? 'bg-red-50 border-red-200' : 'bg-white'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          share.permissions === 'collaborate' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {share.permissions === 'collaborate' ? 'Collaborate' : 'Read Only'}
                        </span>
                        
                        <div className="flex gap-1">
                          {!isExpired && (
                            <button
                              onClick={() => copyShareUrl(share.shareUrl)}
                              className="text-blue-600 hover:text-blue-700 text-sm px-2 py-1"
                            >
                              Copy
                            </button>
                          )}
                          <button
                            onClick={() => revokeShare(share.share_token)}
                            className="text-red-600 hover:text-red-700 text-sm px-2 py-1"
                          >
                            Revoke
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
                        <div className="mt-2 text-xs text-gray-500 break-all bg-gray-50 p-2 rounded">
                          {share.shareUrl}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
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
    </AnimatePresence>
  );
}