import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Instance } from '../modules/editor/editorMockData';
import { useAuth } from './AuthContext';
import { fetchInstances } from '../services/instances';

interface InstancesContextType {
  instances: Instance[];
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
  /** The identifiers of the types the instances are restricted to (applied by the backend) */
  typeFilter: string[];
  setTypeFilter: (types: string[]) => void;
  /** The spaces the instances are restricted to (applied by the backend) */
  spaceFilter: string[];
  setSpaceFilter: (spaces: string[]) => void;
  addInstance: (instance: Instance) => void;
  updateInstance: (instanceId: string, updates: Partial<Instance>) => void;
  deleteInstances: (instanceIds: string[]) => void;
  getInstance: (instanceId: string) => Instance | undefined;
}

const InstancesContext = createContext<InstancesContextType | undefined>(undefined);

export function InstancesProvider({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [spaceFilter, setSpaceFilter] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAccessToken()
      .then((token) => fetchInstances(token, { search: searchTerm, types: typeFilter, spaces: spaceFilter }))
      .then((loaded) => !cancelled && setInstances(loaded))
      .catch((e: unknown) => console.error('Failed to load the instances', e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, searchTerm, typeFilter, spaceFilter]);

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
    <InstancesContext.Provider value={{ instances, loading, searchTerm, setSearchTerm, typeFilter, setTypeFilter, spaceFilter, setSpaceFilter, addInstance, updateInstance, deleteInstances, getInstance }}>
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
