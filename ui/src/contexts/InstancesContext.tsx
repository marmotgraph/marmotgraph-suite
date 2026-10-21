import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { InstanceSummary } from '../modules/editor/editorMockData';
import { useAuth } from './AuthContext';
import { fetchInstances } from '../services/instances';

interface InstancesContextType {
  /** The instances of the overview - only loaded once requested (see {@link useInstances}) */
  instances: InstanceSummary[];
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
  /** The identifiers of the types the instances are restricted to (applied by the backend) */
  typeFilter: string[];
  setTypeFilter: (types: string[]) => void;
  /** The spaces the instances are restricted to (applied by the backend) */
  spaceFilter: string[];
  setSpaceFilter: (spaces: string[]) => void;
  addInstance: (instance: InstanceSummary) => void;
  updateInstance: (instanceId: string, updates: Partial<InstanceSummary>) => void;
  deleteInstances: (instanceIds: string[]) => void;
  getInstance: (instanceId: string) => InstanceSummary | undefined;
  /** Requests the instances to be loaded - they are kept (and reloaded when the query changes) from then on */
  requestInstances: () => void;
}

const InstancesContext = createContext<InstancesContextType | undefined>(undefined);

export function InstancesProvider({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAuth();
  const [instances, setInstances] = useState<InstanceSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [spaceFilter, setSpaceFilter] = useState<string[]>([]);
  const [requested, setRequested] = useState<boolean>(false);
  const requestInstances = useCallback(() => setRequested(true), []);

  useEffect(() => {
    if (!requested) {
      return;
    }
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
  }, [requested, getAccessToken, searchTerm, typeFilter, spaceFilter]);

  const addInstance = (instance: InstanceSummary) => {
    setInstances(prev => [...prev, instance]);
  };

  const updateInstance = (instanceId: string, updates: Partial<InstanceSummary>) => {
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
    <InstancesContext.Provider value={{ instances, loading, searchTerm, setSearchTerm, typeFilter, setTypeFilter, spaceFilter, setSpaceFilter, addInstance, updateInstance, deleteInstances, getInstance, requestInstances }}>
      {children}
    </InstancesContext.Provider>
  );
}

/**
 * @param load whether the component shows the instances - they are only fetched once a component requests them, so
 *             views not showing them (e.g. the detail of an instance) don't trigger loading them
 */
export function useInstances({ load = false }: { load?: boolean } = {}) {
  const context = useContext(InstancesContext);
  if (!context) {
    throw new Error('useInstances must be used within an InstancesProvider');
  }
  const { requestInstances } = context;
  useEffect(() => {
    if (load) {
      requestInstances();
    }
  }, [load, requestInstances]);
  return context;
}
