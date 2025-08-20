'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface StorageStats {
  totalSizeBytes: number;
  totalSizeMB: number;
  fileCount: number;
  lastCleanupAt: string | null;
  updatedAt: string;
  limit: {
    bytes: number;
    mb: number;
  };
  usage: {
    percentage: number;
    remaining: {
      bytes: number;
      mb: number;
    };
  };
  recentFiles: Array<{
    filename: string;
    sizeMB: number;
    createdAt: string;
    accessedAt: string;
  }>;
  cleanup: {
    threshold: {
      bytes: number;
      mb: number;
    };
    triggered: boolean;
    required: boolean;
  };
}

interface CleanupResult {
  success: boolean;
  message: string;
  deletedCount?: number;
  deletedSize?: number;
  newTotalSize?: number;
  deletedFiles?: Array<{
    filename: string;
    size: number;
    created_at: string;
  }>;
}

export default function StorageDashboard() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [recalculateLoading, setRecalculateLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setError(null);
      const response = await fetch('/api/vercel-storage/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch storage stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerCleanup = async () => {
    if (!stats) return;
    
    setCleanupLoading(true);
    setCleanupResult(null);
    
    try {
      const response = await fetch('/api/vercel-storage/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      setCleanupResult(result);
      
      // Refresh stats after cleanup
      await fetchStats();
    } catch (err) {
      setCleanupResult({
        success: false,
        message: err instanceof Error ? err.message : 'Cleanup failed'
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  const recalculateMetrics = async () => {
    setRecalculateLoading(true);
    
    try {
      const response = await fetch('/api/vercel-storage/stats', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to recalculate metrics');
      }
      
      // Refresh stats after recalculation
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recalculate');
    } finally {
      setRecalculateLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading storage dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">No storage data available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Storage Dashboard
          </h1>
          <p className="text-gray-600">
            Monitor Vercel Blob storage usage and manage file cleanup
          </p>
        </div>

        {/* Storage Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="text-sm font-medium text-gray-500 mb-2">Total Storage Used</div>
            <div className={`text-2xl font-bold ${getUsageColor(stats.usage.percentage)}`}>
              {stats.totalSizeMB} MB
            </div>
            <div className="text-sm text-gray-500">
              of {stats.limit.mb} MB ({stats.usage.percentage}%)
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="text-sm font-medium text-gray-500 mb-2">Files Stored</div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.fileCount}
            </div>
            <div className="text-sm text-gray-500">
              files in Vercel Blob
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="text-sm font-medium text-gray-500 mb-2">Remaining</div>
            <div className="text-2xl font-bold text-green-600">
              {stats.usage.remaining.mb} MB
            </div>
            <div className="text-sm text-gray-500">
              available storage
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="text-sm font-medium text-gray-500 mb-2">Last Cleanup</div>
            <div className="text-2xl font-bold text-gray-700">
              {stats.lastCleanupAt ? (
                new Date(stats.lastCleanupAt).toLocaleDateString()
              ) : (
                'Never'
              )}
            </div>
            <div className="text-sm text-gray-500">
              automatic cleanup
            </div>
          </motion.div>
        </div>

        {/* Usage Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg shadow p-6 mb-8"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Storage Usage</h2>
            <span className={`text-sm font-medium ${getUsageColor(stats.usage.percentage)}`}>
              {stats.usage.percentage}% used
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.usage.percentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-4 rounded-full ${getProgressBarColor(stats.usage.percentage)}`}
            />
          </div>
          
          <div className="flex justify-between text-sm text-gray-600">
            <span>0 MB</span>
            <span className="text-red-500">
              Cleanup at {stats.cleanup.threshold.mb} MB
            </span>
            <span>{stats.limit.mb} MB</span>
          </div>

          {stats.cleanup.required && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <div className="flex items-center">
                <div className="text-yellow-600 mr-2">⚠️</div>
                <div>
                  <p className="text-yellow-800 font-medium">Cleanup Required</p>
                  <p className="text-yellow-700 text-sm">
                    Storage has exceeded the {stats.cleanup.threshold.mb}MB threshold. 
                    Cleanup will be triggered automatically or you can run it manually.
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-lg shadow p-6 mb-8"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Storage Management</h2>
          
          <div className="flex flex-wrap gap-4">
            <button
              onClick={triggerCleanup}
              disabled={cleanupLoading}
              className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {cleanupLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Cleaning...
                </>
              ) : (
                <>
                  🗑️ Trigger Cleanup
                </>
              )}
            </button>

            <button
              onClick={recalculateMetrics}
              disabled={recalculateLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {recalculateLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Calculating...
                </>
              ) : (
                <>
                  🔄 Recalculate Metrics
                </>
              )}
            </button>

            <button
              onClick={fetchStats}
              className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center"
            >
              📊 Refresh Stats
            </button>
          </div>

          {cleanupResult && (
            <div className={`mt-4 p-4 rounded ${
              cleanupResult.success 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className={`font-medium ${
                cleanupResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {cleanupResult.success ? '✅' : '❌'} {cleanupResult.message}
              </div>
              
              {cleanupResult.success && cleanupResult.deletedCount && (
                <div className="mt-2 text-sm text-green-700">
                  <p>Deleted {cleanupResult.deletedCount} files ({(cleanupResult.deletedSize! / 1024 / 1024).toFixed(2)} MB)</p>
                  <p>New total: {(cleanupResult.newTotalSize! / 1024 / 1024).toFixed(2)} MB</p>
                  
                  {cleanupResult.deletedFiles && cleanupResult.deletedFiles.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium">Show deleted files</summary>
                      <ul className="mt-2 space-y-1">
                        {cleanupResult.deletedFiles.map((file, index) => (
                          <li key={index} className="text-xs">
                            {file.filename} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Recent Files */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Files</h2>
          
          {stats.recentFiles.length === 0 ? (
            <p className="text-gray-500">No files found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-4 font-medium text-gray-700">Filename</th>
                    <th className="text-left py-2 px-4 font-medium text-gray-700">Size</th>
                    <th className="text-left py-2 px-4 font-medium text-gray-700">Created</th>
                    <th className="text-left py-2 px-4 font-medium text-gray-700">Last Accessed</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentFiles.map((file, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 px-4 text-sm text-gray-900 font-medium">
                        {file.filename}
                      </td>
                      <td className="py-2 px-4 text-sm text-gray-600">
                        {file.sizeMB} MB
                      </td>
                      <td className="py-2 px-4 text-sm text-gray-600">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-4 text-sm text-gray-600">
                        {new Date(file.accessedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Last updated: {new Date(stats.updatedAt).toLocaleString()}</p>
          <p className="mt-2">
            Files older than 7 days and not recently accessed are eligible for cleanup at 400MB threshold.
          </p>
        </div>
      </div>
    </div>
  );
}