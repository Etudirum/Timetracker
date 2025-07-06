import React, { useState, useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { offlineStorage } from '../services/offlineStorage';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Wifi, WifiOff, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export function SyncManager() {
  const [syncStatus, setSyncStatus] = useState('idle');
  const [offlineCount, setOfflineCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const isOnline = useNetworkStatus();

  useEffect(() => {
    checkOfflineData();
  }, []);

  useEffect(() => {
    if (isOnline && offlineCount > 0) {
      handleAutoSync();
    }
  }, [isOnline, offlineCount]);

  const checkOfflineData = async () => {
    const offlineEntries = await offlineStorage.getOfflineEntries();
    const offlineEmployees = await offlineStorage.getOfflineEmployees();
    const syncQueue = await offlineStorage.getSyncQueue();
    
    setOfflineCount(offlineEntries.length + offlineEmployees.length + syncQueue.length);
  };

  const handleAutoSync = async () => {
    if (syncStatus === 'syncing') return;
    
    setSyncStatus('syncing');
    try {
      await syncOfflineData();
      setOfflineCount(0);
      setSyncStatus('success');
      setLastSync(new Date());
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error('Erreur de synchronisation:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const syncOfflineData = async () => {
    if (!isOnline) return;

    try {
      const batch = writeBatch(db);

      // Sync time entries
      const offlineEntries = await offlineStorage.getOfflineEntries();
      for (const entry of offlineEntries) {
        if (entry.isOffline) {
          const docRef = doc(collection(db, 'timeEntries'));
          const cleanEntry = { ...entry };
          delete cleanEntry.id;
          delete cleanEntry.isOffline;
          delete cleanEntry.timestamp;
          
          batch.set(docRef, {
            ...cleanEntry,
            syncedAt: serverTimestamp()
          });
        }
      }

      // Sync employees
      const offlineEmployees = await offlineStorage.getOfflineEmployees();
      for (const employee of offlineEmployees) {
        if (employee.isOffline) {
          const docRef = doc(collection(db, 'employees'));
          const cleanEmployee = { ...employee };
          delete cleanEmployee.id;
          delete cleanEmployee.isOffline;
          delete cleanEmployee.timestamp;
          
          batch.set(docRef, {
            ...cleanEmployee,
            syncedAt: serverTimestamp()
          });
        }
      }

      // Process sync queue
      const syncQueue = await offlineStorage.getSyncQueue();
      for (const item of syncQueue) {
        const docRef = doc(db, item.collection, item.docId);
        
        if (item.operation === 'update') {
          batch.update(docRef, {
            ...item.data,
            syncedAt: serverTimestamp()
          });
        } else if (item.operation === 'create') {
          batch.set(docRef, {
            ...item.data,
            syncedAt: serverTimestamp()
          });
        }
      }

      await batch.commit();
      
      // Clear offline data
      await offlineStorage.clearOfflineEntries();
      await offlineStorage.clearOfflineEmployees();
      await offlineStorage.clearSyncQueue();

      console.log('Synchronisation terminée avec succès');
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      throw error;
    }
  };

  const handleManualSync = async () => {
    await checkOfflineData();
    if (offlineCount > 0) {
      await handleAutoSync();
    }
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Jamais';
    return new Date(lastSync).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex items-center space-x-3">
      {/* Network Status */}
      <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-sm ${
        isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        <span>{isOnline ? 'En ligne' : 'Hors ligne'}</span>
      </div>

      {/* Sync Status */}
      {offlineCount > 0 && (
        <div className="flex items-center space-x-2">
          <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-lg text-sm">
            {offlineCount} en attente
          </div>
          
          {isOnline && (
            <button
              onClick={handleManualSync}
              disabled={syncStatus === 'syncing'}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-sm transition-colors ${
                syncStatus === 'syncing' 
                  ? 'bg-blue-100 text-blue-800 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              <span>{syncStatus === 'syncing' ? 'Sync...' : 'Sync'}</span>
            </button>
          )}
        </div>
      )}

      {/* Sync Result */}
      {syncStatus === 'success' && (
        <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-3 py-1 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>Synchronisé</span>
        </div>
      )}

      {syncStatus === 'error' && (
        <div className="flex items-center space-x-1 bg-red-100 text-red-800 px-3 py-1 rounded-lg text-sm">
          <XCircle className="w-4 h-4" />
          <span>Erreur</span>
        </div>
      )}

      {/* Last Sync */}
      {lastSync && syncStatus === 'idle' && (
        <div className="text-xs text-gray-500">
          Dernière sync: {formatLastSync()}
        </div>
      )}
    </div>
  );
}