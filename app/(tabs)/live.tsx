import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Radio, Users, Zap, Copy, Check, X, Eye, EyeOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

import colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import streamingService, { LiveStream } from '@/services/streaming';

const STREAMING_ACCOUNT_KEY = 'streaming_account_credentials';

interface StreamingCredentials {
  email: string;
  password: string;
  username: string;
  streamKey?: string;
  rtmpUrl?: string;
  createdAt: string;
}

function generatePassword(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%&*';
  
  let password = '';
  for (let i = 0; i < 5; i++) {
    password += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  for (let i = 0; i < 3; i++) {
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  password += special.charAt(Math.floor(Math.random() * special.length));
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

function LiveStreamCard({ stream, onPress }: { stream: LiveStream; onPress: () => void }) {
  const timeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  }, []);

  return (
    <TouchableOpacity style={styles.streamCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.thumbnailContainer}>
        {stream.thumbnail_url ? (
          <Image source={{ uri: stream.thumbnail_url }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Radio color={colors.dark.accent} size={40} />
          </View>
        )}
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <View style={styles.viewerTag}>
          <Users color="#FFF" size={12} />
          <Text style={styles.viewerText}>{stream.viewer_count}</Text>
        </View>
        <View style={styles.durationTag}>
          <Text style={styles.durationText}>{timeAgo(stream.started_at)}</Text>
        </View>
      </View>
      <View style={styles.streamInfo}>
        <View style={styles.streamerRow}>
          <Image
            source={{ uri: stream.avatar_url || `https://i.pravatar.cc/100?u=${stream.username}` }}
            style={styles.avatar}
          />
          <View style={styles.streamerInfo}>
            <Text style={styles.streamTitle} numberOfLines={1}>
              {stream.title || 'Live Stream'}
            </Text>
            <Text style={styles.streamerName}>@{stream.username}</Text>
          </View>
        </View>
        {stream.category && (
          <View style={styles.categoryTag}>
            <Text style={styles.categoryText}>{stream.category}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ onGoLive }: { onGoLive: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Radio color={colors.dark.accent} size={48} />
      </View>
      <Text style={styles.emptyTitle}>No Live Streams</Text>
      <Text style={styles.emptyText}>
        Be the first to go live and share your content with the community!
      </Text>
      <TouchableOpacity style={styles.goLiveButton} onPress={onGoLive}>
        <Zap color="#FFF" size={20} />
        <Text style={styles.goLiveButtonText}>Go Live</Text>
      </TouchableOpacity>
    </View>
  );
}

function CredentialsModal({ 
  visible, 
  credentials, 
  onClose 
}: { 
  visible: boolean; 
  credentials: StreamingCredentials | null;
  onClose: () => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const insets = useSafeAreaInsets();

  const copyToClipboard = async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!credentials) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Streaming Account Created!</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X color={colors.dark.textSecondary} size={24} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>
            Save these credentials to login on uservault.net
          </Text>

          <View style={styles.credentialCard}>
            <Text style={styles.credentialLabel}>Email</Text>
            <View style={styles.credentialRow}>
              <Text style={styles.credentialValue}>{credentials.email}</Text>
              <TouchableOpacity 
                onPress={() => copyToClipboard(credentials.email, 'email')}
                style={styles.copyButton}
              >
                {copiedField === 'email' ? (
                  <Check color="#4CAF50" size={20} />
                ) : (
                  <Copy color={colors.dark.accent} size={20} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.credentialCard}>
            <Text style={styles.credentialLabel}>Password</Text>
            <View style={styles.credentialRow}>
              <Text style={styles.credentialValue}>
                {showPassword ? credentials.password : '•'.repeat(credentials.password.length)}
              </Text>
              <View style={styles.passwordActions}>
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.copyButton}
                >
                  {showPassword ? (
                    <EyeOff color={colors.dark.textSecondary} size={20} />
                  ) : (
                    <Eye color={colors.dark.textSecondary} size={20} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => copyToClipboard(credentials.password, 'password')}
                  style={styles.copyButton}
                >
                  {copiedField === 'password' ? (
                    <Check color="#4CAF50" size={20} />
                  ) : (
                    <Copy color={colors.dark.accent} size={20} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.credentialCard}>
            <Text style={styles.credentialLabel}>Username</Text>
            <View style={styles.credentialRow}>
              <Text style={styles.credentialValue}>{credentials.username}</Text>
              <TouchableOpacity 
                onPress={() => copyToClipboard(credentials.username, 'username')}
                style={styles.copyButton}
              >
                {copiedField === 'username' ? (
                  <Check color="#4CAF50" size={20} />
                ) : (
                  <Copy color={colors.dark.accent} size={20} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {credentials.streamKey && (
            <View style={styles.credentialCard}>
              <Text style={styles.credentialLabel}>Stream Key</Text>
              <View style={styles.credentialRow}>
                <Text style={styles.credentialValue} numberOfLines={1}>
                  {credentials.streamKey.slice(0, 20)}...
                </Text>
                <TouchableOpacity 
                  onPress={() => copyToClipboard(credentials.streamKey || '', 'streamKey')}
                  style={styles.copyButton}
                >
                  {copiedField === 'streamKey' ? (
                    <Check color="#4CAF50" size={20} />
                  ) : (
                    <Copy color={colors.dark.accent} size={20} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function LoadingOverlay({ message }: { message: string }) {
  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingCard}>
        <ActivityIndicator size="large" color={colors.dark.accent} />
        <Text style={styles.loadingText}>{message}</Text>
      </View>
    </View>
  );
}

export default function LiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, currentUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [credentials, setCredentials] = useState<StreamingCredentials | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [hasCheckedAccount, setHasCheckedAccount] = useState(false);

  const {
    data: streams = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['live-streams'],
    queryFn: async () => {
      console.log('[LiveScreen] Fetching live streams...');
      const result = await streamingService.getLiveStreams();
      console.log('[LiveScreen] Got streams:', result?.length || 0);
      return result;
    },
    refetchInterval: 30000,
    retry: 2,
  });

  const checkAndCreateStreamingAccount = useCallback(async () => {
    if (!isAuthenticated || !currentUser || hasCheckedAccount) {
      console.log('[LiveScreen] Skipping account check - not authenticated or already checked');
      return;
    }

    console.log('[LiveScreen] Checking for existing streaming account...');
    setHasCheckedAccount(true);

    try {
      const storedCredentials = await AsyncStorage.getItem(STREAMING_ACCOUNT_KEY);
      
      if (storedCredentials) {
        const parsed = JSON.parse(storedCredentials) as StreamingCredentials;
        console.log('[LiveScreen] Found existing streaming account:', parsed.email);
        setCredentials(parsed);
        return;
      }

      console.log('[LiveScreen] No streaming account found, creating one...');
      setIsCreatingAccount(true);

      const username = currentUser.username || `user_${currentUser.id}`;
      const email = `${username}@uservault.stream`;
      const password = generatePassword();
      const displayName = currentUser.name || currentUser.username || 'Streamer';
      const bio = currentUser.bio || '';
      const avatarUrl = currentUser.avatar || '';

      console.log('[LiveScreen] Creating account with:', { email, username, displayName });

      const response = await streamingService.mobileSignup({
        email,
        password,
        username,
        display_name: displayName,
        bio,
        avatar_url: avatarUrl,
      });

      console.log('[LiveScreen] Account created successfully:', response);

      const newCredentials: StreamingCredentials = {
        email,
        password,
        username,
        streamKey: response.streaming?.stream_key,
        rtmpUrl: response.streaming?.rtmp_full,
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(STREAMING_ACCOUNT_KEY, JSON.stringify(newCredentials));
      setCredentials(newCredentials);
      setShowCredentialsModal(true);

      console.log('[LiveScreen] Credentials stored and modal shown');
    } catch (error) {
      console.error('[LiveScreen] Error creating streaming account:', error);
    } finally {
      setIsCreatingAccount(false);
    }
  }, [isAuthenticated, currentUser, hasCheckedAccount]);

  useEffect(() => {
    if (isAuthenticated && currentUser && !hasCheckedAccount) {
      checkAndCreateStreamingAccount();
    }
  }, [isAuthenticated, currentUser, hasCheckedAccount, checkAndCreateStreamingAccount]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleGoLive = useCallback(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    router.push('/go-live');
  }, [isAuthenticated, router]);

  const handleWatchStream = useCallback(
    (stream: LiveStream) => {
      router.push({
        pathname: '/stream/[id]',
        params: { id: stream.id, username: stream.username },
      });
    },
    [router]
  );

  const handleShowCredentials = useCallback(() => {
    if (credentials) {
      setShowCredentialsModal(true);
    }
  }, [credentials]);

  const renderStream = useCallback(
    ({ item }: { item: LiveStream }) => (
      <LiveStreamCard stream={item} onPress={() => handleWatchStream(item)} />
    ),
    [handleWatchStream]
  );

  return (
    <View style={styles.container}>
      {isCreatingAccount && (
        <LoadingOverlay message="Please wait, your account is being created..." />
      )}

      <CredentialsModal
        visible={showCredentialsModal}
        credentials={credentials}
        onClose={() => setShowCredentialsModal(false)}
      />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Radio color={colors.dark.accent} size={24} />
          <Text style={styles.headerTitle}>Live</Text>
        </View>
        <View style={styles.headerRight}>
          {credentials && (
            <TouchableOpacity 
              style={styles.credentialsButton} 
              onPress={handleShowCredentials}
            >
              <Text style={styles.credentialsButtonText}>Login Info</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.goLiveHeaderButton} onPress={handleGoLive}>
            <Zap color="#FFF" size={16} />
            <Text style={styles.goLiveHeaderText}>Go Live</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.dark.accent} />
        </View>
      ) : (
        <FlatList
          data={streams}
          renderItem={renderStream}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            streams.length === 0 && styles.emptyListContent,
          ]}
          numColumns={2}
          columnWrapperStyle={streams.length > 0 ? styles.columnWrapper : undefined}
          ListEmptyComponent={<EmptyState onGoLive={handleGoLive} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.dark.accent}
              colors={[colors.dark.accent]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.dark.text,
  },
  credentialsButton: {
    backgroundColor: colors.dark.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  credentialsButtonText: {
    color: colors.dark.text,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  goLiveHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dark.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  goLiveHeaderText: {
    color: '#FFF',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
    paddingBottom: 120,
  },
  emptyListContent: {
    flex: 1,
  },
  columnWrapper: {
    gap: 12,
  },
  streamCard: {
    flex: 1,
    maxWidth: '48%',
    backgroundColor: colors.dark.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  thumbnailContainer: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.dark.surface,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark.surface,
  },
  liveTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E53935',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  liveText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  viewerTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  viewerText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  durationTag: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600' as const,
  },
  streamInfo: {
    padding: 12,
  },
  streamerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.dark.surface,
  },
  streamerInfo: {
    flex: 1,
  },
  streamTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.dark.text,
    marginBottom: 2,
  },
  streamerName: {
    fontSize: 11,
    color: colors.dark.textSecondary,
  },
  categoryTag: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.dark.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 10,
    color: colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.dark.text,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  goLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dark.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
  },
  goLiveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: colors.dark.card,
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    gap: 16,
    marginHorizontal: 40,
  },
  loadingText: {
    color: colors.dark.text,
    fontSize: 16,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.dark.card,
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.dark.text,
  },
  closeButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    marginBottom: 24,
  },
  credentialCard: {
    backgroundColor: colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  credentialLabel: {
    fontSize: 12,
    color: colors.dark.textSecondary,
    marginBottom: 6,
    fontWeight: '500' as const,
  },
  credentialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  credentialValue: {
    fontSize: 15,
    color: colors.dark.text,
    fontWeight: '600' as const,
    flex: 1,
  },
  passwordActions: {
    flexDirection: 'row',
    gap: 8,
  },
  copyButton: {
    padding: 4,
  },
  doneButton: {
    backgroundColor: colors.dark.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  doneButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
