import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Video, ResizeMode } from 'expo-av';
import {
  ArrowLeft,
  Users,
  Heart,
  MessageCircle,
  Share2,
  Radio,
  AlertCircle,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import colors from '@/constants/colors';
import streamingService, { LiveStream } from '@/services/streaming';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_HEIGHT = (SCREEN_WIDTH * 9) / 16;

export default function StreamViewerScreen() {
  const { id, username } = useLocalSearchParams<{ id: string; username?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [liked, setLiked] = useState(false);

  const {
    data: stream,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['stream', id, username],
    queryFn: () => streamingService.getStream({ id, username }),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (stream?.id) {
      heartbeatInterval.current = setInterval(() => {
        streamingService.sendHeartbeat(stream.id).catch(console.error);
      }, 30000);

      streamingService.sendHeartbeat(stream.id).catch(console.error);
    }

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [stream?.id]);

  useEffect(() => {
    if (showControls) {
      const timer = setTimeout(() => setShowControls(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showControls]);

  const handleToggleControls = useCallback(() => {
    setShowControls((prev) => !prev);
  }, []);

  const handleLike = useCallback(() => {
    setLiked((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleShare = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleViewProfile = useCallback(() => {
    if (stream?.username) {
      router.push({
        pathname: '/user/[userId]',
        params: { userId: stream.username },
      });
    }
  }, [stream?.username, router]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.dark.accent} />
          <Text style={styles.loadingText}>Loading stream...</Text>
        </View>
      </View>
    );
  }

  if (error || !stream) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.errorContainer, { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft color={colors.dark.text} size={24} />
          </TouchableOpacity>
          <View style={styles.errorContent}>
            <AlertCircle color={colors.dark.textSecondary} size={48} />
            <Text style={styles.errorTitle}>Stream Unavailable</Text>
            <Text style={styles.errorText}>
              This stream may have ended or is not available at the moment.
            </Text>
            <TouchableOpacity style={styles.errorButton} onPress={handleBack}>
              <Text style={styles.errorButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <TouchableOpacity
        style={styles.videoContainer}
        activeOpacity={1}
        onPress={handleToggleControls}
      >
        {stream.hls_url ? (
          <Video
            ref={videoRef}
            source={{ uri: stream.hls_url }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isPlaying}
            isLooping={false}
            useNativeControls={false}
            onError={(e) => console.error('[Stream] Video error:', e)}
          />
        ) : (
          <View style={styles.noVideoContainer}>
            <Radio color={colors.dark.accent} size={60} />
            <Text style={styles.noVideoText}>Stream starting soon...</Text>
            <Text style={styles.noVideoSubtext}>
              The streamer is setting up their broadcast
            </Text>
          </View>
        )}

        {showControls && (
          <View style={[styles.topOverlay, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity style={styles.overlayBackButton} onPress={handleBack}>
              <ArrowLeft color="#FFF" size={24} />
            </TouchableOpacity>

            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
              <View style={styles.viewerCount}>
                <Users color="#FFF" size={14} />
                <Text style={styles.viewerCountText}>{stream.viewer_count}</Text>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.infoContainer}>
        <TouchableOpacity style={styles.streamerRow} onPress={handleViewProfile}>
          <Image
            source={{
              uri: stream.avatar_url || `https://i.pravatar.cc/100?u=${stream.username}`,
            }}
            style={styles.avatar}
          />
          <View style={styles.streamerInfo}>
            <Text style={styles.streamTitle} numberOfLines={2}>
              {stream.title || 'Live Stream'}
            </Text>
            <Text style={styles.streamerName}>@{stream.username}</Text>
          </View>
        </TouchableOpacity>

        {stream.category && (
          <View style={styles.categoryTag}>
            <Text style={styles.categoryText}>{stream.category}</Text>
          </View>
        )}

        {stream.description && (
          <Text style={styles.description} numberOfLines={3}>
            {stream.description}
          </Text>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, liked && styles.actionButtonActive]}
            onPress={handleLike}
          >
            <Heart
              color={liked ? '#E53935' : colors.dark.textSecondary}
              size={22}
              fill={liked ? '#E53935' : 'transparent'}
            />
            <Text style={[styles.actionText, liked && styles.actionTextActive]}>
              Like
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <MessageCircle color={colors.dark.textSecondary} size={22} />
            <Text style={styles.actionText}>Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Share2 color={colors.dark.textSecondary} size={22} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.dark.textSecondary,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  backButton: {
    marginLeft: 16,
    padding: 8,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.dark.text,
  },
  errorText: {
    fontSize: 15,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: colors.dark.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 16,
  },
  errorButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: VIDEO_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  noVideoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark.surface,
    gap: 16,
  },
  noVideoText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  noVideoSubtext: {
    fontSize: 14,
    color: colors.dark.textSecondary,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
  },
  overlayBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E53935',
  },
  liveText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.3)',
  },
  viewerCountText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  infoContainer: {
    flex: 1,
    padding: 20,
  },
  streamerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.dark.surface,
  },
  streamerInfo: {
    flex: 1,
  },
  streamTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.dark.text,
    marginBottom: 4,
    lineHeight: 24,
  },
  streamerName: {
    fontSize: 14,
    color: colors.dark.accent,
    fontWeight: '500' as const,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.dark.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 13,
    color: colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
  description: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
    paddingTop: 20,
  },
  actionButton: {
    alignItems: 'center',
    gap: 6,
  },
  actionButtonActive: {
    transform: [{ scale: 1.05 }],
  },
  actionText: {
    fontSize: 12,
    color: colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
  actionTextActive: {
    color: '#E53935',
  },
});
