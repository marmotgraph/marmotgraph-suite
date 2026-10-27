import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { InstanceSummary } from '../modules/editor/editorMockData';
import { useAuth } from './AuthContext';
import { fetchInstances, setFavorite } from '../services/instances';

interface InstancesContextType {
  /** The instances of the overview - only loaded once requested (see {@link useInstances}) */
  instances: InstanceSummary[];
  /** The number of instances matching the query as reported by the service - more than loaded if there are further pages */
  total: number;
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
  /** The identifiers of the types the instances are restricted to (applied by the backend) */
  typeFilter: string[];
  setTypeFilter: (types: string[]) => void;
  /** The spaces the instances are restricted to (applied by the backend) */
  spaceFilter: string[];
  setSpaceFilter: (spaces: string[]) => void;
  /** Whether the instances are restricted to the favorites of the user (applied by the backend) */
  favoritesOnly: boolean;
  setFavoritesOnly: (favoritesOnly: boolean) => void;
  /** Whether the instances are restricted to those the user has contributed to (applied by the backend) */
  contributedOnly: boolean;
  setContributedOnly: (contributedOnly: boolean) => void;
  /** Flags the instance as favorite (or removes the flag) - shown right away and reverted if the backend rejects it */
  toggleFavorite: (instanceId: string) => Promise<void>;
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
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [spaceFilter, setSpaceFilter] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [contributedOnly, setContributedOnly] = useState<boolean>(false);
  const [requested, setRequested] = useState<boolean>(false);
  const requestInstances = useCallback(() => setRequested(true), []);

  useEffect(() => {
    if (!requested) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAccessToken()
      .then((token) => fetchInstances(token, { search: searchTerm, types: typeFilter, spaces: spaceFilter, favorites: favoritesOnly, contributed: contributedOnly }))
      .then((loaded) => {
        if (!cancelled) {
          setInstances(loaded.instances);
          setTotal(loaded.total ?? loaded.instances.length);
        }
      })
      .catch((e: unknown) => console.error('Failed to load the instances', e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [requested, getAccessToken, searchTerm, typeFilter, spaceFilter, favoritesOnly, contributedOnly]);

  const addInstance = (instance: InstanceSummary) => {
    setInstances(prev => [...prev, instance]);
    setTotal(prev => prev + 1);
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

  const toggleFavorite = async (instanceId: string) => {
    const favorite = !instances.find(inst => inst.instanceId === instanceId)?.favorite;
    updateInstance(instanceId, { favorite });
    try {
      await setFavorite(await getAccessToken(), instanceId, favorite);
    } catch (e) {
      updateInstance(instanceId, { favorite: !favorite });
      throw e;
    }
  };

  const deleteInstances = (instanceIds: string[]) => {
    const removed = instances.filter(inst => instanceIds.includes(inst.instanceId)).length;
    setInstances(prev => prev.filter(inst => !instanceIds.includes(inst.instanceId)));
    setTotal(prev => Math.max(prev - removed, 0));
  };

  const getInstance = (instanceId: string) => {
    return instances.find(inst => inst.instanceId === instanceId);
  };

  return (
    <InstancesContext.Provider value={{ instances, total, loading, searchTerm, setSearchTerm, typeFilter, setTypeFilter, spaceFilter, setSpaceFilter, favoritesOnly, setFavoritesOnly, contributedOnly, setContributedOnly, toggleFavorite, addInstance, updateInstance, deleteInstances, getInstance, requestInstances }}>
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
