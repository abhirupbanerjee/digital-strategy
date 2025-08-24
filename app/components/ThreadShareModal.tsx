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
  //const [currentShare, setCurrentShare] = useState<ThreadShare | null>(null);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create share link: ${response.status}`);
      }
            
      const data = await response.json();
      
      // Try to copy to clipboard
      try {
        await navigator.clipboard.writeText(data.shareUrl);
        alert(`✅ Share link created and copied!\n\n🔗 ${data.shareUrl}\n\n⏰ Expires: ${new Date(data.expiresAt).toLocaleString()}`);
      } catch (clipboardError) {
        // Fallback for mobile/browsers without clipboard access
        alert(`✅ Share link created!\n\n🔗 ${data.shareUrl}\n\n⏰ Expires: ${new Date(data.expiresAt).toLocaleString()}\n\n📋 Please copy the link manually`);
      }
      
      // Reload shares list
      loadShares();
      
    } catch (error) {
      console.error('Create share error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`❌ Failed to create share link\n\n${errorMessage}`);
    } finally {
      setCreating(false);
    }
  };

  const downloadZip = async () => {
    if (downloading) return;
    
    setDownloading(true);
    setDownloadProgress('Preparing export...');
    
    try {
      const response = await fetch(`/api/threads/${threadId}/download`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate export');
      }

      setDownloadProgress('Generating ZIP file...');

      // Get file info from headers
      const contentLength = response.headers.get('content-length');
      const filesCount = response.headers.get('x-files-count') || '0';
      const messagesCount = response.headers.get('x-messages-count') || '0';

      // Download the ZIP file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${threadId.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Success message with details
      const sizeText = contentLength 
        ? ` (${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB)`
        : '';
      
      alert(`📦 Download Complete!\n\n✅ Conversation exported successfully${sizeText}\n\n📄 Contains:\n• Professional HTML conversation\n• ${filesCount} file(s) in annexures folder\n• ${messagesCount} message(s)\n\n💡 Open the HTML file in any browser to view`);

    } catch (error) {
      console.error('Download error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`❌ Export Failed\n\n${errorMessage}\n\n💡 Try again or contact support if the issue persists`);
    } finally {
      setDownloading(false);
      setDownloadProgress('');
    }
  };

  const revokeShare = async (shareToken: string) => {
    if (!confirm('🗑️ Revoke this share link?\n\nThis will immediately disable access for anyone using this link.')) return;
    
    try {
      const response = await fetch(`/api/threads/${threadId}/shares?token=${shareToken}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('✅ Share link revoked successfully');
        loadShares();
      } else {
        throw new Error('Failed to revoke share');
      }
    } catch (error) {
      console.error('Revoke share error:', error);
      alert('❌ Failed to revoke share link');
    }
  };

  const copyShareUrl = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('📋 Share link copied to clipboard!');
    } catch (error) {
      // Fallback for mobile
      alert(`📋 Share link:\n\n${shareUrl}\n\n(Please copy manually)`);
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
          className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>🔗</span>
            <span>Share Thread</span>
          </h3>
          <div className="text-sm text-gray-600 mb-4">
            "{threadTitle}"
          </div>
          
          {/* Main Action Buttons */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            {/* Download Section */}
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <span>📦</span>
                <span>Export Conversation</span>
              </h4>
              <p className="text-sm text-gray-700 mb-3">
                Download a complete ZIP package with HTML conversation and all files
              </p>
              
              <button
                onClick={downloadZip}
                disabled={downloading}
                className="w-full py-2.5 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {downloading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {downloadProgress || 'Generating...'}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>📥</span>
                    <span>Download HTML + Files</span>
                  </span>
                )}
              </button>
              
              {downloading && (
                <div className="mt-2 text-xs text-green-700 text-center">
                  This may take a moment for threads with large files...
                </div>
              )}
            </div>
            
            {/* Share Link Section */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <span>🔗</span>
                <span>Create Share Link</span>
              </h4>
              // Simple one-click sharing
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Creates a collaborative link that expires in 24 hours
                </p>
                <button
                  onClick={createShareLink}
                  disabled={creating}
                  className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-lg"
                >
                  {creating ? 'Creating Link...' : '🔗 Create & Copy Share Link'}
                </button>
              </div>
                            

            </div>
          </div>
          
          {/* Existing Shares */}
          {shares.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <span>📋</span>
                <span>Active Share Links ({shares.length})</span>
              </h4>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {shares.map((share) => {
                  const isExpired = new Date(share.expires_at) < new Date();
                  return (
                    <div
                      key={share.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        isExpired 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          share.permissions === 'collaborate' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {share.permissions === 'collaborate' ? '✏️ Collaborate' : '👁️ Read Only'}
                        </span>
                        
                        <div className="flex gap-1">
                          {!isExpired && (
                            <button
                              onClick={() => copyShareUrl(share.shareUrl)}
                              className="text-blue-600 hover:text-blue-700 text-sm px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                              title="Copy link"
                            >
                              📋 Copy
                            </button>
                          )}
                          <button
                            onClick={() => revokeShare(share.share_token)}
                            className="text-red-600 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50 transition-colors"
                            title="Revoke access"
                          >
                            🗑️ Revoke
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-600">
                        <div className="flex items-center gap-4">
                          <span>📅 Created: {new Date(share.created_at).toLocaleDateString()}</span>
                          <span className={isExpired ? 'text-red-600 font-medium' : ''}>
                            {isExpired ? '🚫 Expired: ' : '⏰ Expires: '}
                            {new Date(share.expires_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      {!isExpired && (
                        <div className="mt-2 text-xs font-mono text-gray-500 break-all bg-gray-50 p-2 rounded border">
                          {share.shareUrl}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Close
            </button>
          </div>
          
          {/* Help Text */}
          <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-3 rounded border">
            💡 <strong>Tip:</strong> ZIP exports include a professional HTML file that opens in any browser, 
            plus all referenced files in an "annexures" folder. Perfect for sharing with stakeholders!
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}