import { Tabs } from 'expo-router';
import { Home, User } from 'lucide-react-native';
import { ProtectedRoute } from '../../components/auth/protected-route';

export default function TabLayout() {
  return (
    <ProtectedRoute>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#007AFF',
          headerShown: false,
          tabBarStyle: {
            backgroundColor: 'white',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarButtonTestID: 'tab-home',
            tabBarIcon: ({ color, size }) => <Home color={color} size={size || 24} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarButtonTestID: 'tab-profile',
            tabBarIcon: ({ color, size }) => <User color={color} size={size || 24} />,
          }}
        />
      </Tabs>
    </ProtectedRoute>
  );
}
