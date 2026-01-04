// src/contexts/WorkspaceProvider.tsx
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { WorkspaceContext, type WorkspaceContextType, type Workspace, type GetWorkspacesResponse } from './WorkspaceContext';

const GET_WORKSPACES = gql`
  query GetWorkspaces {
    myWorkspaces {
      id
      name
      description
      isDefault
      faceCount
    }
  }
`;

export const WorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const { data, loading, refetch } = useQuery<GetWorkspacesResponse>(GET_WORKSPACES);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);

  // Use useMemo to prevent creating new array on every render
  const workspaces = useMemo(() => data?.myWorkspaces || [], [data?.myWorkspaces]);
  
  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspace) {
      const defaultWorkspace = workspaces.find((w) => w.isDefault) || workspaces[0];
      setActiveWorkspace(defaultWorkspace);
    }
  }, [workspaces, activeWorkspace]);

  const contextValue: WorkspaceContextType = {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    refreshWorkspaces: refetch,
    loading
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
};