import { Tabs, useRouter } from "expo-router";
import { Home, Compass, Plus, MessageCircle, Image as ImageIcon, Video, X, Radio } from "lucide-react-native";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Image, Animated, Modal, Text, Pressable, ActivityIndicator } from "react-native";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { streamingService } from "@/services/streaming";

const STREAMING_ACCOUNT_KEY = 'uservault_streaming_account_created';
const STREAMING_TOKEN_KEY = 'uservault_streaming_token';
const STREAMING_EMAIL_KEY = 'uservault_streaming_email';
const STREAMING_PASSWORD_KEY = 'uservault_streaming_password';

function generatePassword(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const specials = '!@#$%&*';
  
  let password = '';
  for (let i = 0; i < 4; i++) {
    password += letters[Math.floor(Math.random() * letters.length)];
  }
  for (let i = 0; i < 3; i++) {
    password += numbers[Math.floor(Math.random() * numbers.length)];
  }
  password += specials[Math.floor(Math.random() * specials.length)];
  password += letters[Math.floor(Math.random() * letters.length)];
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

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
  const { currentUser, isAuthenticated } = useAuth();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const [isCreatingStreamAccount, setIsCreatingStreamAccount] = useState(false);
  const [streamAccountCreated, setStreamAccountCreated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStreamingAccount = async () => {
      try {
        const accountCreated = await AsyncStorage.getItem(STREAMING_ACCOUNT_KEY);
        setStreamAccountCreated(accountCreated === 'true');
        console.log('[TabLayout] Streaming account status:', accountCreated);
      } catch (error) {
        console.error('[TabLayout] Error checking streaming account:', error);
        setStreamAccountCreated(false);
      }
    };
    checkStreamingAccount();
  }, []);

  const createStreamingAccount = useCallback(async () => {
    if (!currentUser?.username) {
      console.log('[TabLayout] No user logged in');
      router.push('/login');
      return false;
    }

    setIsCreatingStreamAccount(true);
    try {
      const email = `${currentUser.username}@uservault.stream`;
      const password = generatePassword();

      console.log('[TabLayout] Creating streaming account for:', email);

      const response = await streamingService.mobileSignup({
        email,
        password,
        username: currentUser.username,
        display_name: currentUser.name || currentUser.username,
        bio: currentUser.bio || '',
        avatar_url: currentUser.avatar,
      });

      console.log('[TabLayout] Signup response:', JSON.stringify(response));

      await AsyncStorage.setItem(STREAMING_ACCOUNT_KEY, 'true');
      if (response.access_token) {
        await AsyncStorage.setItem(STREAMING_TOKEN_KEY, response.access_token);
      }
      await AsyncStorage.setItem(STREAMING_EMAIL_KEY, email);
      await AsyncStorage.setItem(STREAMING_PASSWORD_KEY, password);

      setStreamAccountCreated(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('[TabLayout] Streaming account created successfully');
      return true;
    } catch (error) {
      console.error('[TabLayout] Failed to create streaming account:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    } finally {
      setIsCreatingStreamAccount(false);
    }
  }, [currentUser, router]);

  const handleLiveTabPress = useCallback(async () => {
    console.log('[TabLayout] Live tab pressed, isAuthenticated:', isAuthenticated, 'streamAccountCreated:', streamAccountCreated);
    
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (streamAccountCreated === false) {
      console.log('[TabLayout] Creating streaming account...');
      const success = await createStreamingAccount();
      if (success) {
        router.push('/go-live');
      }
    } else {
      router.push('/go-live');
    }
  }, [isAuthenticated, streamAccountCreated, createStreamingAccount, router]);

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
        name="live"
        options={{
          title: "Live",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon 
              IconComponent={Radio} 
              color={color} 
              size={size} 
              focused={focused} 
            />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            handleLiveTabPress();
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
        visible={isCreatingStreamAccount}
        transparent
        animationType="fade"
      >
        <View style={styles.streamAccountModalOverlay}>
          <View style={styles.streamAccountModalContent}>
            <View style={styles.streamAccountIconContainer}>
              <Radio color={colors.dark.accent} size={48} />
            </View>
            <Text style={styles.streamAccountTitle}>Setting Up Your Stream</Text>
            <Text style={styles.streamAccountText}>
              Please wait while your streaming account is being created...
            </Text>
            <ActivityIndicator size="large" color={colors.dark.accent} style={styles.streamAccountLoader} />
            <Text style={styles.streamAccountSubtext}>This may take a few seconds</Text>
          </View>
        </View>
      </Modal>

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
  streamAccountModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  streamAccountModalContent: {
    backgroundColor: colors.dark.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  streamAccountIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  streamAccountTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.dark.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  streamAccountText: {
    fontSize: 15,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  streamAccountLoader: {
    marginTop: 16,
  },
  streamAccountSubtext: {
    fontSize: 12,
    color: colors.dark.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
});
