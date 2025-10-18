import { Text, View } from 'react-native';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Loading } from '../../components/ui/loading';
import { useAuth } from '../../hooks/use-auth';

export default function ProfileScreen() {
  const { user, signOut, isLoading } = useAuth();

  if (isLoading) {
    return <Loading fullScreen message="Loading profile..." />;
  }

  return (
    <View className="flex-1 p-6 bg-gray-50 dark:bg-gray-900">
      <Card className="p-6">
        <Text className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
          Profile
        </Text>
        
        <View className="space-y-4">
          <View>
            <Text className="text-gray-600 dark:text-gray-400">Name</Text>
            <Text className="text-lg text-gray-900 dark:text-white">
              {user?.name || 'Guest User'}
            </Text>
          </View>

        <View>
          <Text className="text-gray-600 dark:text-gray-400">ID</Text>
          <Text className="text-lg text-gray-900 dark:text-white">
            {user?.id || 'N/A'}
          </Text>
        </View>
            
          
          <View>
            <Text className="text-gray-600 dark:text-gray-400">Email</Text>
            <Text className="text-lg text-gray-900 dark:text-white">
              {user?.email || 'guest@example.com'}
            </Text>
          </View>
          
          <View>
            <Text className="text-gray-600 dark:text-gray-400">Member Since</Text>
            <Text className="text-lg text-gray-900 dark:text-white">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
        </View>
        
        <Button 
          title="Sign Out" 
          variant="outline" 
          className="mt-6" 
          onPress={signOut} 
        />
      </Card>
    </View>
  );
}