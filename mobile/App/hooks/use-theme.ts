// hooks/use-theme-color.ts
import { useColorScheme } from 'react-native';

const Colors = {
  light: {
    tint: '#007AFF',
    tabIconDefault: '#687076',
    tabIconSelected: '#007AFF',
  },
  dark: {
    tint: '#007AFF',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#007AFF',
  },
};

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}

// hooks/use-color-scheme.ts
export { useColorScheme } from 'react-native';

// hooks/use-items.ts
import { useState } from 'react';

interface Item {
  id: string;
  name: string;
  createdAt: string;
}

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addItem = (itemData: Omit<Item, 'id'>) => {
    const newItem: Item = {
      id: Date.now().toString(),
      ...itemData,
    };
    setItems(prev => [...prev, newItem]);
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  return {
    items,
    isLoading,
    addItem,
    deleteItem,
  };
}

// hooks/use-auth.ts
import { useState } from 'react';

interface User {
  name: string;
  email: string;
  createdAt: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>({
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date().toISOString(),
  });

  const signOut = () => {
    setUser(null);
    // Handle sign out logic
  };

  return {
    user,
    signOut,
  };
}