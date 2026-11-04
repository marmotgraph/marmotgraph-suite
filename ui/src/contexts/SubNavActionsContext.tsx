import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";

/** A page action a view contributes to the subnav (e.g. because it depends on the permissions of the user). */
export interface SubNavAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

interface SubNavActionsState {
  actions: SubNavAction[];
  setActions: (actions: SubNavAction[]) => void;
}

const SubNavActionsContext = createContext<SubNavActionsState>({ actions: [], setActions: () => undefined });

/** Holds the page actions the current view contributes to the subnav. */
export function SubNavActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<SubNavAction[]>([]);
  return <SubNavActionsContext.Provider value={{ actions, setActions }}>{children}</SubNavActionsContext.Provider>;
}

/** The page actions contributed by the current view. */
export function useRegisteredSubNavActions(): SubNavAction[] {
  return useContext(SubNavActionsContext).actions;
}

/**
 * Shows the given actions in the subnav as long as the calling view is mounted. The actions are only replaced when
 * their labels change - the latest click handlers are always used.
 */
export function useSubNavActions(actions: SubNavAction[]) {
  const { setActions } = useContext(SubNavActionsContext);
  const latest = useRef(actions);
  latest.current = actions;
  const key = actions.map((action) => action.label).join("\n");

  useEffect(() => {
    setActions(
      latest.current.map((action, i) => ({ ...action, onClick: () => latest.current[i]?.onClick() })),
    );
    return () => setActions([]);
  }, [key, setActions]);
}
