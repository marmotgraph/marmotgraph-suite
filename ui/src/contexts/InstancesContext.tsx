import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Instance } from '../modules/editor/editorMockData';
import { useAuth } from './AuthContext';
import { fetchInstances } from '../services/instances';

interface InstancesContextType {
  instances: Instance[];
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
  addInstance: (instance: Instance) => void;
  updateInstance: (instanceId: string, updates: Partial<Instance>) => void;
  deleteInstances: (instanceIds: string[]) => void;
  getInstance: (instanceId: string) => Instance | undefined;
}

const InstancesContext = createContext<InstancesContextType | undefined>(undefined);

export function InstancesProvider({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then((token) => fetchInstances(token, searchTerm))
      .then((loaded) => !cancelled && setInstances(loaded))
      .catch((e: unknown) => console.error('Failed to load the instances', e));
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, searchTerm]);

  const addInstance = (instance: Instance) => {
    setInstances(prev => [...prev, instance]);
  };

  const updateInstance = (instanceId: string, updates: Partial<Instance>) => {
    setInstances(prev =>
      prev.map(inst =>
        inst.instanceId === instanceId
          ? { ...inst, ...updates }
          : inst
      )
    );
  };

  const deleteInstances = (instanceIds: string[]) => {
    setInstances(prev => prev.filter(inst => !instanceIds.includes(inst.instanceId)));
  };

  const getInstance = (instanceId: string) => {
    return instances.find(inst => inst.instanceId === instanceId);
  };

  return (
    <InstancesContext.Provider value={{ instances, searchTerm, setSearchTerm, addInstance, updateInstance, deleteInstances, getInstance }}>
      {children}
    </InstancesContext.Provider>
  );
}

export function useInstances() {
  const context = useContext(InstancesContext);
  if (!context) {
    throw new Error('useInstances must be used within an InstancesProvider');
  }
  return context;
}
