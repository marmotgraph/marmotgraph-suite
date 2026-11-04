import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchQuerySpaces,
  fetchQueryTypes,
  QuerySpace,
  QueryType,
} from "../../services/queries";
import type { TypesById } from "./queryModel";

export interface Loaded<T> {
  data?: T;
  error?: string;
}

/**
 * The structure of the types changes rarely - it is loaded once and shared by all views of the query builder (a failed
 * load is retried the next time it is needed).
 */
let typesRequest: Promise<TypesById> | undefined;
let spacesRequest: Promise<QuerySpace[]> | undefined;

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function useShared<T>(load: (token: string) => Promise<T>, reset: () => void): Loaded<T> {
  const { getAccessToken } = useAuth();
  const [state, setState] = useState<Loaded<T>>({});
  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then(load)
      .then((data) => !cancelled && setState({ data }))
      .catch((e: unknown) => {
        reset();
        if (!cancelled) {
          setState({ error: message(e) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, load, reset]);
  return state;
}

const loadTypes = (token: string) => {
  typesRequest ??= fetchQueryTypes(token).then(
    (types: QueryType[]) => new Map(types.map((type) => [type.identifier, type])),
  );
  return typesRequest;
};
const resetTypes = () => {
  typesRequest = undefined;
};

const loadSpaces = (token: string) => {
  spacesRequest ??= fetchQuerySpaces(token);
  return spacesRequest;
};
const resetSpaces = () => {
  spacesRequest = undefined;
};

/** The types with the properties a query can follow, by identifier */
export function useQueryTypes(): Loaded<TypesById> {
  return useShared(loadTypes, resetTypes);
}

/** The spaces with the permissions of the user - the private space first */
export function useQuerySpaces(): Loaded<QuerySpace[]> {
  return useShared(loadSpaces, resetSpaces);
}

/** The core gives this name for the private space of the user instead of its identifier */
const PRIVATE_SPACE = "myspace";

/** The space with the given name - "myspace" stands for the private space of the user */
export function findSpace(spaces: QuerySpace[] | undefined, name: string | undefined): QuerySpace | undefined {
  if (!name || !spaces) {
    return undefined;
  }
  return spaces.find((s) => s.identifier === name) ?? (name === PRIVATE_SPACE ? spaces.find((s) => s.isPrivate) : undefined);
}

/** The name to show for a space */
export function spaceLabel(space: QuerySpace | undefined, identifier?: string): string {
  if (space?.isPrivate) {
    return "My private space";
  }
  return space?.name || space?.identifier || identifier || "";
}
