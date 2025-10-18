import { ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useItems } from '../../hooks/use-items';

export default function ItemsScreen() {
  const { items, isLoading, addItem, deleteItem } = useItems();

  const handleAddItem = () => {
    addItem({
      name: `Item ${items.length + 1}`,
      createdAt: new Date().toISOString(),
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="p-6">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">
            Items
          </Text>
          <Button title="Add Item" onPress={handleAddItem} />
        </View>

        <ScrollView>
          <View className="space-y-3">
            {items.map((item) => (
              <Card key={item.id} className="p-4">
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                      {item.name}
                    </Text>
                    <Text className="text-gray-600 dark:text-gray-400">
                      Created: {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Button
                    title="Delete"
                    variant="destructive"
                    onPress={() => deleteItem(item.id)}
                  />
                </View>
              </Card>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}