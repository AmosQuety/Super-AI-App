import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Item } from '../libs/types';
import { dbService } from '../services/db';

export function useItems() {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: () => dbService.getItems(),
  });

  const addMutation = useMutation({
    mutationFn: (item: Omit<Item, 'id'>) => dbService.createItem(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dbService.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Item> }) =>
      dbService.updateItem(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  return {
    items,
    isLoading,
    addItem: addMutation.mutate,
    deleteItem: deleteMutation.mutate,
    updateItem: updateMutation.mutate,
  };
}