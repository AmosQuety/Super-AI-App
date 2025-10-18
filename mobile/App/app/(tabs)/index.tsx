// app/(tabs)/index.tsx
import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import {
  MessageSquare,
  Image,
  Mic,
  Users,
  Zap,
  Brain,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Star,
  Shield,
  Globe
} from 'lucide-react-native';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../hooks/use-auth';

export default function HomeScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedStar, setSelectedStar] = useState(0);

  const chatTabs = [
    {
      id: 'chat',
      title: 'Chat',
      icon: MessageSquare,
      route: '/features/chats',
      description: 'Text conversations with AI',
      color: '#3B82F6' // blue-500
    },
    {
      id: 'image',
      title: 'Image',
      icon: Image,
      route: '/features/image',
      description: 'Visual AI interactions',
      color: '#8B5CF6' // purple-500
    },
    {
      id: 'voice',
      title: 'Voice',
      icon: Mic,
      route: '/features/voice',
      description: 'Voice-powered conversations',
      color: '#10B981' // emerald-500
    },
  ];

  const stats = [
    { label: 'AI Conversations', value: '2,847', icon: MessageSquare, change: '+12%' },
    { label: 'Active Users', value: '15.2K', icon: Users, change: '+8%' },
    { label: 'Response Time', value: '0.3s', icon: Zap, change: '-15%' },
    { label: 'Accuracy Rate', value: '98.7%', icon: Brain, change: '+2%' },
  ];

  const features = [
    {
      title: 'Advanced AI Models',
      description: 'Powered by cutting-edge language models for superior conversations',
      icon: Brain,
      color: '#3B82F6'
    },
    {
      title: 'Multi-Modal Experience',
      description: 'Chat with text, images, and voice in one seamless platform',
      icon: Sparkles,
      color: '#8B5CF6'
    },
    {
      title: 'Enterprise Security',
      description: 'Bank-level encryption and privacy protection for your data',
      icon: Shield,
      color: '#10B981'
    },
    {
      title: 'Global Accessibility',
      description: 'Available in 50+ languages with 99.9% uptime guarantee',
      icon: Globe,
      color: '#F59E0B'
    },
  ];

  const recentActivity = [
    { type: 'chat', title: 'Project Planning Discussion', time: '2 min ago', status: 'active' },
    { type: 'image', title: 'Logo Design Analysis', time: '15 min ago', status: 'completed' },
    { type: 'voice', title: 'Meeting Summary', time: '1 hour ago', status: 'completed' },
  ];

  const handleTabPress = (tab: any) => {
    console.log('Tab pressed:', tab.id, 'Route:', tab.route);
    setActiveTab(tab.id);
    router.push(tab.route as any);
  };

  // Dummy handler for star press (replace with your logic if needed)
  const handleStarPress = (star: number) => {
    console.log(`Star ${star} pressed`);
  };

  return (
    <ScrollView
      className="flex-1 bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      showsVerticalScrollIndicator={false}
    >
      {/* Header Section */}
      <View className="px-6 pt-16 pb-8">
       <View className="flex-row items-center justify-between mb-8 px-2">
  {/* Left: Greeting */}
  <View className="flex-1">
    <Text className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
      Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 
    </Text>
    <Text className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
      Ready to explore the future of AI?
    </Text>
  </View>

 
</View>


        {/* Chat Tabs */}
        <View className="mb-8">
          <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your AI Experience
          </Text>

          

           <View className="flex-row gap-4">
    {chatTabs.map((tab) => {
      const IconComponent = tab.icon;
      const isActive = activeTab === tab.id;
      return (
        <TouchableOpacity
          key={tab.id}
          onPress={() => handleTabPress(tab)}
          className={`
            flex-1 items-center justify-center p-5 rounded-2xl shadow-md
            ${isActive
              ? 'bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-600'
              : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
            }
          `}
          style={{
            shadowColor: isActive ? tab.color : 'transparent',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isActive ? 0.2 : 0,
            shadowRadius: 6,
            elevation: isActive ? 6 : 0,
          }}
        >
          <IconComponent
            size={28}
            color={isActive ? tab.color : '#6B7280'}
          />
          <Text
            className={`text-sm font-semibold mt-3 ${
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {tab.title}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
        </View>

      </View>

      {/* Stats Section */}
      <View className="px-6 mb-8">
        <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Platform Analytics
        </Text>
        <View className="flex-row flex-wrap gap-4">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <View key={index} className="flex-1 min-w-[45%]">
                <View className="p-5 bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
                  <View className="flex-row items-center justify-between mb-3">
                    <IconComponent size={24} color="#6B7280" />
                    <Text className="text-sm font-medium text-green-600 dark:text-green-400">
                      {stat.change}
                    </Text>
                  </View>
                  <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {stat.value}
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    {stat.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Recent Activity */}
      <View className="px-6 mb-8">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xl font-bold text-gray-900 dark:text-white">
            Recent Activity
          </Text>
          <TouchableOpacity className="flex-row items-center gap-1">
            <Text className="text-blue-600 dark:text-blue-400 font-medium">View All</Text>
            <ChevronRight size={18} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        <View className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
          <View className="gap-4">
            {recentActivity.map((activity, index) => (
              <View key={index} className="flex-row items-center gap-4">
                <View className={`p-3 rounded-xl ${
                  activity.type === 'chat' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  activity.type === 'image' ? 'bg-purple-100 dark:bg-purple-900/30' :
                  'bg-green-100 dark:bg-green-900/30'
                }`}>
                  {activity.type === 'chat' && <MessageSquare size={20} color="#3B82F6" />}
                  {activity.type === 'image' && <Image size={20} color="#8B5CF6" />}
                  {activity.type === 'voice' && <Mic size={20} color="#10B981" />}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900 dark:text-white">
                    {activity.title}
                  </Text>
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    {activity.time}
                  </Text>
                </View>
                <View className={`px-3 py-1 rounded-full ${
                  activity.status === 'active'
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Text className={`text-xs font-medium ${
                    activity.status === 'active'
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {activity.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Features Section */}
      <View className="px-6 mb-8">
        <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Why Choose Super AI App?
        </Text>
        <View className="gap-4">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <View key={index} className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
                <View className="flex-row items-start gap-4">
                  <View
                    className="p-3 rounded-2xl"
                    style={{ backgroundColor: `${feature.color}20` }}
                  >
                    <IconComponent size={24} color={feature.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      {feature.title}
                    </Text>
                    <Text className="text-gray-600 dark:text-gray-400 leading-6">
                      {feature.description}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* CTA Section */}

<View className="px-6 pb-8">
  <View className="p-8 rounded-3xl shadow-2xl bg-gradient-to-r from-amber-200 via-orange-200 to-yellow-100 ">
    <View className="items-center rounded-2xl border border-white/30 dark:border-gray-700/50 backdrop-blur-sm bg-blue-50/60">
      {/* Star Rating */}
      <View className="flex-row items-center mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={24}
            color={star <= selectedStar ? "#F59E0B" : "#D1D5DB"}
            fill={star <= selectedStar ? "#F59E0B" : "none"}
            onPress={() => {
              setSelectedStar(star);
              handleStarPress(star);
            }}
          />
        ))}
      </View>

      {/* Heading */}
      <Text className="text-2xl font-bold  mb-3">
        Join 50,000+ Happy Users
      </Text>

      {/* Subheading */}
      <Text className="text-lg mb-6 text-center">
        Experience the next generation of AI-powered conversations
      </Text>

      {/* CTA Button */}
      <View className="mt-6 bg-blue-600 rounded-2xl shadow-lg">
      <TouchableOpacity
        onPress={() => router.push('/features/chats')}
        className="bg-blue-600 border border-white rounded-2xl px-8 py-4 shadow-lg active:scale-95"
      >
        <Text className="text-white font-bold text-lg">
          Start Your First Chat
        </Text>
      </TouchableOpacity>
     </View>
    </View>
  </View>
</View>



      {/* Footer */}
      <View className="px-6 pb-12">
        <View className="items-center">
          <Text className="text-gray-400 dark:text-gray-500 text-sm mb-2">
            Super AI App v1.0.0
          </Text>
          <Text className="text-gray-400 dark:text-gray-500 text-xs text-center">
            Trusted by developers • Powered by advanced AI • Available worldwide
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}