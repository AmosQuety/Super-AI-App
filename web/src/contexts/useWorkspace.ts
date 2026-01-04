// src/hooks/useWorkspace.ts
import { useContext } from 'react';
import { WorkspaceContext } from '../contexts/WorkspaceContext';

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return context;
};