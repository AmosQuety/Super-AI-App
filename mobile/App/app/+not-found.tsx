import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '../components/ui/button';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-2xl font-bold mb-2">This screen doesn't exist.</Text>
        <Link href="/" asChild>
          <Button title="Go to home screen!" />
        </Link>
      </View>
    </>
  );
}