import React, { ReactNode } from "react";
export function ConfigProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function useConfig() {
  return { coreUrl: "", tenant: "preview" } as never;
}
