import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';

// Define Query here for simplicity
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

interface Workspace {
  id: string;
  name: string;
  isDefault: boolean;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace) => void;
  refreshWorkspaces: () => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const { data, loading, refetch } = useQuery(GET_WORKSPACES);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    if (data?.myWorkspaces && !activeWorkspace) {
      // Auto-select default workspace on load
      const def = data.myWorkspaces.find((w: Workspace) => w.isDefault) || data.myWorkspaces[0];
      setActiveWorkspace(def);
    }
  }, [data]);

  return (
    <WorkspaceContext.Provider value={{
      workspaces: data?.myWorkspaces || [],
      activeWorkspace,
      setActiveWorkspace,
      refreshWorkspaces: refetch,
      loading
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return context;
};