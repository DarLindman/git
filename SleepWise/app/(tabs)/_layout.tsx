import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/design/tokens';
import { i18n } from '../../src/i18n';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color }: { name: IoniconName; color: string }) {
  return <Ionicons name={name} size={22} color={color} />;
}

export default function TabLayout() {
  const t = i18n.t();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#080d18',
          borderTopColor: 'rgba(60,200,180,0.1)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 60,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        },
        tabBarActiveTintColor: 'rgba(60,200,180,0.9)',
        tabBarInactiveTintColor: 'rgba(100,140,160,0.4)',
        tabBarLabelStyle: {
          fontFamily: 'InstrumentSans',
          fontSize: 10,
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.tonight,
          tabBarIcon: ({ color }) => <TabIcon name="moon-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t.tabs.history,
          tabBarIcon: ({ color }) => <TabIcon name="bar-chart-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: t.tabs.statistics,
          tabBarIcon: ({ color }) => <TabIcon name="stats-chart-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.tabs.settings,
          tabBarIcon: ({ color }) => <TabIcon name="settings-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
