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
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Radio,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  Zap,
  X,
  Check,
  Info,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import streamingService from '@/services/streaming';

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
  const [copied, setCopied] = useState<'rtmp' | 'key' | null>(null);

  const {
    data: streamInfo,
    isLoading: loadingInfo,
    refetch: refetchInfo,
  } = useQuery({
    queryKey: ['stream-info'],
    queryFn: () => streamingService.getStreamInfo(authToken!),
    enabled: !!authToken,
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: () => streamingService.regenerateStreamKey(authToken!),
    onSuccess: () => {
      refetchInfo();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Stream key regenerated successfully');
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to regenerate key');
    },
  });

  const startStreamMutation = useMutation({
    mutationFn: () =>
      streamingService.startStream(authToken!, {
        title: title || `${currentUser?.username}'s Stream`,
        category: selectedCategory,
        description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Stream Ready!',
        'Your stream is now prepared. Start streaming from your broadcast software (OBS, Larix Broadcaster, etc.) using the RTMP URL and Stream Key shown above.',
        [{ text: 'Got it', onPress: () => router.back() }]
      );
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to start stream');
    },
  });

  const handleCopy = useCallback(async (text: string, type: 'rtmp' | 'key') => {
    await Clipboard.setStringAsync(text);
    setCopied(type);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleRegenerateKey = useCallback(() => {
    Alert.alert(
      'Regenerate Stream Key?',
      'This will invalidate your current stream key. Any active streams will be disconnected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: () => regenerateKeyMutation.mutate(),
        },
      ]
    );
  }, [regenerateKeyMutation]);

  const handleGoLive = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for your stream');
      return;
    }
    startStreamMutation.mutate();
  }, [title, startStreamMutation]);

  const rtmpUrl = streamingService.getRtmpUrl();

  return (
    <View style={styles.container}>
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
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Info color={colors.dark.accent} size={20} />
            <Text style={styles.infoTitle}>How to Stream</Text>
          </View>
          <Text style={styles.infoText}>
            Use a streaming app like OBS Studio, Streamlabs, or Larix Broadcaster on your device.
            Enter the RTMP URL and Stream Key below to start broadcasting.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stream Credentials</Text>

          <View style={styles.credentialCard}>
            <Text style={styles.credentialLabel}>RTMP URL</Text>
            <View style={styles.credentialRow}>
              <Text style={styles.credentialValue} numberOfLines={1}>
                {rtmpUrl}
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => handleCopy(rtmpUrl, 'rtmp')}
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
            <View style={styles.credentialLabelRow}>
              <Text style={styles.credentialLabel}>Stream Key</Text>
              <TouchableOpacity
                style={styles.regenerateButton}
                onPress={handleRegenerateKey}
                disabled={regenerateKeyMutation.isPending}
              >
                {regenerateKeyMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.dark.accent} />
                ) : (
                  <>
                    <RefreshCw color={colors.dark.accent} size={14} />
                    <Text style={styles.regenerateText}>Regenerate</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.credentialRow}>
              {loadingInfo ? (
                <ActivityIndicator size="small" color={colors.dark.textSecondary} />
              ) : (
                <Text style={styles.credentialValue} numberOfLines={1}>
                  {showStreamKey
                    ? streamInfo?.stream_key || 'Loading...'
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
                  onPress={() => handleCopy(streamInfo?.stream_key || '', 'key')}
                  disabled={!streamInfo?.stream_key}
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
        <TouchableOpacity
          style={[styles.goLiveButton, startStreamMutation.isPending && styles.buttonDisabled]}
          onPress={handleGoLive}
          disabled={startStreamMutation.isPending}
        >
          {startStreamMutation.isPending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Zap color="#FFF" size={22} />
              <Text style={styles.goLiveButtonText}>Prepare Stream</Text>
            </>
          )}
        </TouchableOpacity>
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
  buttonDisabled: {
    opacity: 0.6,
  },
  goLiveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
});
