import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Eye,
  EyeOff,
  X,
  Check,
  Info,
  Video,
  StopCircle,
  Radio,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { streamingService } from '@/services/streaming';

const STREAMING_ACCOUNT_KEY = 'uservault_streaming_account_created';
const STREAMING_TOKEN_KEY = 'uservault_streaming_token';

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

const CATEGORIES = [
  'Just Chatting',
  'Gaming',
  'Music',
  'Art',
  'Sports',
  'Education',
  'Technology',
  'Lifestyle',
  'Other',
];

export default function GoLiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { authToken, currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Just Chatting');
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [copied, setCopied] = useState<'rtmp' | 'key' | 'full' | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [liveRtmpUrl, setLiveRtmpUrl] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [streamingToken, setStreamingToken] = useState<string | null>(null);
  const [hasStreamingAccount, setHasStreamingAccount] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStreamingAccount = async () => {
      try {
        const [accountCreated, storedToken] = await Promise.all([
          AsyncStorage.getItem(STREAMING_ACCOUNT_KEY),
          AsyncStorage.getItem(STREAMING_TOKEN_KEY),
        ]);
        setHasStreamingAccount(accountCreated === 'true');
        if (storedToken) {
          setStreamingToken(storedToken);
        }
        console.log('[GoLive] Streaming account status:', accountCreated, 'token:', !!storedToken);
      } catch (error) {
        console.error('[GoLive] Error checking streaming account:', error);
        setHasStreamingAccount(false);
      }
    };
    checkStreamingAccount();
  }, []);

  const createStreamingAccountMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.username) {
        throw new Error('No user logged in');
      }
      
      const email = `${currentUser.username}@uservault.stream`;
      const password = generatePassword();
      
      console.log('[GoLive] Creating streaming account for:', email);
      
      const response = await streamingService.mobileSignup({
        email,
        password,
        username: currentUser.username,
        display_name: currentUser.name || currentUser.username,
        bio: currentUser.bio || '',
        avatar_url: currentUser.avatar,
      });
      
      return response;
    },
    onSuccess: async (data) => {
      console.log('[GoLive] Streaming account created successfully');
      await AsyncStorage.setItem(STREAMING_ACCOUNT_KEY, 'true');
      if (data.access_token) {
        await AsyncStorage.setItem(STREAMING_TOKEN_KEY, data.access_token);
        setStreamingToken(data.access_token);
      }
      setHasStreamingAccount(true);
      setIsCreatingAccount(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['mobile-stream-config'] });
    },
    onError: (error) => {
      console.error('[GoLive] Failed to create streaming account:', error);
      setIsCreatingAccount(false);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create streaming account');
    },
  });

  const { mutateAsync: createStreamingAccount } = createStreamingAccountMutation;

  const effectiveToken = streamingToken || authToken;

  const {
    data: mobileConfig,
    isLoading: loadingConfig,
  } = useQuery({
    queryKey: ['mobile-stream-config', effectiveToken],
    queryFn: () => streamingService.getMobileConfig(effectiveToken!),
    enabled: !!effectiveToken && hasStreamingAccount === true,
  });

  const goLiveMutation = useMutation({
    mutationFn: () =>
      streamingService.mobileGoLive(effectiveToken!, {
        title: title || `${currentUser?.username}'s Stream`,
        category: selectedCategory,
        description,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsLive(true);
      setLiveRtmpUrl(data.rtmp_full);
      console.log('[GoLive] Stream started successfully:', data);
    },
    onError: (error) => {
      console.log('[GoLive] Error starting stream:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to start stream');
    },
  });

  const endStreamMutation = useMutation({
    mutationFn: () => streamingService.mobileEndStream(effectiveToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsLive(false);
      setLiveRtmpUrl(null);
      Alert.alert('Stream Ended', 'Your stream has been ended successfully.');
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to end stream');
    },
  });

  const handleCopy = useCallback(async (text: string, type: 'rtmp' | 'key' | 'full') => {
    await Clipboard.setStringAsync(text);
    setCopied(type);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const { mutate: goLive } = goLiveMutation;

  const handleGoLive = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for your stream');
      return;
    }
    
    if (!hasStreamingAccount) {
      setIsCreatingAccount(true);
      try {
        await createStreamingAccount();
        setTimeout(() => {
          goLive();
        }, 500);
      } catch {
        // Error handled in mutation
      }
      return;
    }
    
    goLive();
  }, [title, goLive, hasStreamingAccount, createStreamingAccount]);

  const { mutate: endStream } = endStreamMutation;

  const handleEndStream = useCallback(() => {
    Alert.alert(
      'End Stream?',
      'Are you sure you want to end your live stream?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Stream',
          style: 'destructive',
          onPress: () => endStream(),
        },
      ]
    );
  }, [endStream]);

  return (
    <View style={styles.container}>
      <Modal
        visible={isCreatingAccount}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Radio color={colors.dark.accent} size={48} />
            </View>
            <Text style={styles.modalTitle}>Setting Up Your Stream</Text>
            <Text style={styles.modalText}>
              Please wait while your streaming account is being created...
            </Text>
            <ActivityIndicator size="large" color={colors.dark.accent} style={styles.modalLoader} />
          </View>
        </View>
      </Modal>

      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Go Live',
          headerStyle: { backgroundColor: colors.dark.background },
          headerTintColor: colors.dark.text,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <X color={colors.dark.text} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {isLive && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Info color={colors.dark.accent} size={20} />
            <Text style={styles.infoTitle}>{isLive ? 'You are Live!' : 'How to Stream'}</Text>
          </View>
          <Text style={styles.infoText}>
            {isLive
              ? 'Your stream is now live! Use the RTMP URL below in your streaming app (OBS, Larix Broadcaster, etc.) to broadcast.'
              : 'Enter your stream details and tap "Go Live" to prepare your stream. Then use the RTMP URL in your broadcasting app.'}
          </Text>
        </View>

        {isLive && liveRtmpUrl && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stream URL (Full)</Text>
            <View style={styles.credentialCard}>
              <Text style={styles.credentialLabel}>RTMP URL WITH KEY</Text>
              <View style={styles.credentialRow}>
                <Text style={styles.credentialValue} numberOfLines={1}>
                  {showStreamKey ? liveRtmpUrl : liveRtmpUrl.replace(/\/[^/]+$/, '/••••••••••')}
                </Text>
                <View style={styles.keyActions}>
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowStreamKey(!showStreamKey)}
                  >
                    {showStreamKey ? (
                      <EyeOff color={colors.dark.textSecondary} size={18} />
                    ) : (
                      <Eye color={colors.dark.textSecondary} size={18} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => handleCopy(liveRtmpUrl, 'full')}
                  >
                    {copied === 'full' ? (
                      <Check color={colors.dark.success} size={18} />
                    ) : (
                      <Copy color={colors.dark.accent} size={18} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.keyWarning}>
                This URL contains your stream key. Keep it private!
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stream Credentials</Text>

          <View style={styles.credentialCard}>
            <Text style={styles.credentialLabel}>RTMP URL</Text>
            <View style={styles.credentialRow}>
              {loadingConfig ? (
                <ActivityIndicator size="small" color={colors.dark.textSecondary} />
              ) : (
                <Text style={styles.credentialValue} numberOfLines={1}>
                  {mobileConfig?.rtmp_url || 'rtmp://stream.uservault.de/live'}
                </Text>
              )}
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => handleCopy(mobileConfig?.rtmp_url || 'rtmp://stream.uservault.de/live', 'rtmp')}
              >
                {copied === 'rtmp' ? (
                  <Check color={colors.dark.success} size={18} />
                ) : (
                  <Copy color={colors.dark.accent} size={18} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.credentialCard}>
            <Text style={styles.credentialLabel}>Stream Key</Text>
            <View style={styles.credentialRow}>
              {loadingConfig ? (
                <ActivityIndicator size="small" color={colors.dark.textSecondary} />
              ) : (
                <Text style={styles.credentialValue} numberOfLines={1}>
                  {showStreamKey
                    ? mobileConfig?.stream_key || 'Loading...'
                    : '••••••••••••••••••••'}
                </Text>
              )}
              <View style={styles.keyActions}>
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowStreamKey(!showStreamKey)}
                >
                  {showStreamKey ? (
                    <EyeOff color={colors.dark.textSecondary} size={18} />
                  ) : (
                    <Eye color={colors.dark.textSecondary} size={18} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => handleCopy(mobileConfig?.stream_key || '', 'key')}
                  disabled={!mobileConfig?.stream_key}
                >
                  {copied === 'key' ? (
                    <Check color={colors.dark.success} size={18} />
                  ) : (
                    <Copy color={colors.dark.accent} size={18} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.keyWarning}>
              Keep your stream key private! Anyone with this key can stream to your channel.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stream Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="What are you streaming today?"
              placeholderTextColor={colors.dark.textSecondary}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell viewers what to expect..."
              placeholderTextColor={colors.dark.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesContainer}
            >
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === cat && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {isLive ? (
          <TouchableOpacity
            style={[styles.endStreamButton, endStreamMutation.isPending && styles.buttonDisabled]}
            onPress={handleEndStream}
            disabled={endStreamMutation.isPending}
          >
            {endStreamMutation.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <StopCircle color="#FFF" size={22} />
                <Text style={styles.goLiveButtonText}>End Stream</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.goLiveButton, goLiveMutation.isPending && styles.buttonDisabled]}
            onPress={handleGoLive}
            disabled={goLiveMutation.isPending}
          >
            {goLiveMutation.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Video color="#FFF" size={22} />
                <Text style={styles.goLiveButtonText}>Go Live</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  headerButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.dark.accent + '30',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  infoText: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    lineHeight: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.dark.text,
    marginBottom: 16,
  },
  credentialCard: {
    backgroundColor: colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  credentialLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  credentialLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  credentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  credentialValue: {
    flex: 1,
    fontSize: 14,
    color: colors.dark.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    padding: 8,
    backgroundColor: colors.dark.surface,
    borderRadius: 8,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  regenerateText: {
    fontSize: 12,
    color: colors.dark.accent,
    fontWeight: '500' as const,
  },
  keyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyeButton: {
    padding: 8,
  },
  keyWarning: {
    fontSize: 11,
    color: colors.dark.textSecondary,
    marginTop: 12,
    fontStyle: 'italic',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.dark.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.dark.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.dark.text,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categoriesContainer: {
    marginHorizontal: -4,
  },
  categoryChip: {
    backgroundColor: colors.dark.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  categoryChipActive: {
    backgroundColor: colors.dark.accent,
    borderColor: colors.dark.accent,
  },
  categoryChipText: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
  categoryChipTextActive: {
    color: '#FFF',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
    padding: 16,
  },
  goLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#E53935',
    paddingVertical: 16,
    borderRadius: 14,
  },
  endStreamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#424242',
    paddingVertical: 16,
    borderRadius: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  goLiveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E53935',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: 20,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
  },
  liveText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.dark.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.dark.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 15,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  modalLoader: {
    marginTop: 16,
  },
});
