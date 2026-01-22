import { Tabs, useRouter } from "expo-router";
import { Home, Compass, Plus, MessageCircle, Image as ImageIcon, Video, X } from "lucide-react-native";
import React, { useRef, useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Image, Animated, Modal, Text, Pressable } from "react-native";
import * as ImagePicker from 'expo-image-picker';


import colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

function AnimatedTabIcon({ 
  IconComponent, 
  color, 
  size, 
  focused 
}: { 
  IconComponent: any; 
  color: string; 
  size: number; 
  focused: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(focused ? 1 : 0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.1 : 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: focused ? 1 : 0.7,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View style={{ 
      transform: [{ scale: scaleAnim }],
      opacity: opacityAnim,
    }}>
      <IconComponent color={color} size={size} />
    </Animated.View>
  );
}

function CreateButton({ onPress }: { onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[
        styles.plusButtonGlow,
        { opacity: glowAnim }
      ]} />
      <Animated.View style={[
        styles.plusButton,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        <Plus color="#FFF" size={26} strokeWidth={2.5} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  const openSheet = () => {
    setShowCreateSheet(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowCreateSheet(false);
    });
  };

  const handlePostPicture = async () => {
    closeSheet();
    setTimeout(async () => {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        router.push({ pathname: '/create-post', params: { mediaUri: result.assets[0].uri, mediaType: 'image' } });
      }
    }, 300);
  };

  const handlePostVideo = async () => {
    closeSheet();
    setTimeout(async () => {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        router.push({ pathname: '/create-post', params: { mediaUri: result.assets[0].uri, mediaType: 'video' } });
      }
    }, 300);
  };

  const handleCreate = () => {
    openSheet();
  };

  return (
    <>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.dark.text,
        tabBarInactiveTintColor: colors.dark.textSecondary,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.dark.surface,
          borderTopColor: colors.dark.border,
          borderTopWidth: 0.5,
          height: 85,
          paddingBottom: 28,
          paddingTop: 12,
          position: 'absolute',
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600' as const,
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon 
              IconComponent={Home} 
              color={color} 
              size={size} 
              focused={focused} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon 
              IconComponent={Compass} 
              color={color} 
              size={size} 
              focused={focused} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          tabBarIcon: () => (
            <CreateButton onPress={handleCreate} />
          ),
          tabBarLabel: () => null,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            handleCreate();
          },
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon 
              IconComponent={MessageCircle} 
              color={color} 
              size={size} 
              focused={focused} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => {
            const avatarUrl = currentUser?.avatar || `https://i.pravatar.cc/200?u=${currentUser?.username || 'user'}`;
            return (
              <View style={[styles.avatarIcon, focused && styles.avatarIconActive]}>
                <Image 
                  source={{ uri: avatarUrl }} 
                  style={styles.avatarImage}
                />
              </View>
            );
          },
        }}
      />
    </Tabs>

      <Modal
        visible={showCreateSheet}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeSheet}>
          <Animated.View 
            style={[
              styles.sheetContainer,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHandle} />
              
              <TouchableOpacity style={styles.sheetOption} onPress={handlePostPicture}>
                <View style={styles.sheetIconContainer}>
                  <ImageIcon color={colors.dark.accent} size={24} />
                </View>
                <Text style={styles.sheetOptionText}>Post Picture</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetOption} onPress={handlePostVideo}>
                <View style={styles.sheetIconContainer}>
                  <Video color={colors.dark.accent} size={24} />
                </View>
                <Text style={styles.sheetOptionText}>Post Video</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetCancelButton} onPress={closeSheet}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.dark.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.dark.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 16,
  },
  sheetIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  sheetCancelButton: {
    marginTop: 8,
    marginHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.dark.surface,
    borderRadius: 14,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.dark.textSecondary,
  },
  plusButtonGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.dark.accent,
    top: -5,
    left: -5,
  },
  plusButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: colors.dark.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarIconActive: {
    borderColor: colors.dark.accent,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
});
