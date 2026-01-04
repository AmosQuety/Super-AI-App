// src/contexts/WorkspaceContext.ts
import { createContext } from 'react';

export interface Workspace {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  faceCount: number;
}

export interface GetWorkspacesResponse {
  myWorkspaces: Workspace[];
}

export interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace) => void;
  refreshWorkspaces: () => void;
  loading: boolean;
}

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);