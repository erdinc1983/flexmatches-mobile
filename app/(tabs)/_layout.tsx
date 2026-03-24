import { Tabs } from "expo-router";
import { useTheme } from "../../lib/theme";
import { Icon } from "../../components/Icon";

export default function TabsLayout() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.tabBar,
          borderTopColor:  c.tabBarBorder,
          height:          64,
          paddingBottom:   10,
          paddingTop:      6,
        },
        tabBarActiveTintColor:   c.brand,
        tabBarInactiveTintColor: c.textFaint,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? "homeActive" : "home"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? "discoverActive" : "discover"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Chat",
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? "chatActive" : "chat"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="circles"
        options={{
          title: "Circles",
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? "circlesActive" : "circles"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? "profileActive" : "profile"} size={24} color={color} />
          ),
        }}
      />
      {/* Hidden tabs — not shown in tab bar */}
      <Tabs.Screen name="activity"    options={{ href: null }} />
      <Tabs.Screen name="feed"        options={{ href: null }} />
      <Tabs.Screen name="matches"     options={{ href: null }} />
      <Tabs.Screen name="goals"       options={{ href: null }} />
      <Tabs.Screen name="leaderboard" options={{ href: null }} />
    </Tabs>
  );
}
