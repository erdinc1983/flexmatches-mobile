import { View, Text, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { useTheme } from "../../lib/theme";
import { useNotifications } from "../../lib/notificationContext";
import { Icon } from "../../components/Icon";

export default function TabsLayout() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { unreadCount } = useNotifications();

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
            <View>
              <Icon name={focused ? "profileActive" : "profile"} size={24} color={color} />
              {unreadCount > 0 && (
                <View style={[badge.dot, { backgroundColor: c.brand }]}>
                  <Text style={badge.dotText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </View>
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

const badge = StyleSheet.create({
  dot: {
    position: "absolute",
    top: -4, right: -6,
    minWidth: 16, height: 16,
    borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  dotText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
