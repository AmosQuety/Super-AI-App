import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '../components/ui/button';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center p-6">
        <Text className="mb-2 text-2xl font-bold">This screen doesn&apos;t exist.</Text>
        <Link href="/" asChild>
          <Button title="Go to home screen!" />
        </Link>
      </View>
    </>
  );
}
