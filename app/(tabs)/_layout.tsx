import { View, Text, StyleSheet, Platform } from "react-native";
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
          borderTopWidth:  0,
          shadowColor:     "#000",
          shadowOffset:    { width: 0, height: -4 },
          shadowOpacity:   0.08,
          shadowRadius:    16,
          elevation:       12,
          height:          Platform.OS === "ios" ? 84 : 68,
          paddingBottom:   Platform.OS === "ios" ? 26 : 10,
          paddingTop:      10,
        },
        tabBarActiveTintColor:   c.brand,
        tabBarInactiveTintColor: c.textFaint,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
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
            <View>
              <Icon name={focused ? "chatActive" : "chat"} size={24} color={color} />
              {unreadCount > 0 && (
                <View style={[badge.dot, { backgroundColor: c.brand }]}>
                  <Text style={badge.dotText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </View>
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
      <Tabs.Screen name="challenges"  options={{ href: null }} />
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
