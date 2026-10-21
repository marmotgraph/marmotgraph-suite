import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Instance, mockInstances as initialInstances } from '../modules/editor/editorMockData';

interface InstancesContextType {
  instances: Instance[];
  addInstance: (instance: Instance) => void;
  updateInstance: (instanceId: string, updates: Partial<Instance>) => void;
  deleteInstances: (instanceIds: string[]) => void;
  getInstance: (instanceId: string) => Instance | undefined;
}

const InstancesContext = createContext<InstancesContextType | undefined>(undefined);

export function InstancesProvider({ children }: { children: ReactNode }) {
  const [instances, setInstances] = useState<Instance[]>([...initialInstances]);

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
    <InstancesContext.Provider value={{ instances, addInstance, updateInstance, deleteInstances, getInstance }}>
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
