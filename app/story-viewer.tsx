import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import colors from '@/constants/colors';
import { useStoryById, useRecordStoryView } from '@/hooks/useApi';
import type { StoryFrame } from '@/types';

const { width, height } = Dimensions.get('window');

export default function StoryViewerScreen() {
  const { storyUuid } = useLocalSearchParams<{ storyUuid: string }>();
  const router = useRouter();
  const { data: storyData, isLoading } = useStoryById(storyUuid || null);
  const recordView = useRecordStoryView();
  
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const story = storyData?.data?.[0];
  const frames = story?.relations?.frames || [];
  const currentFrame = frames[currentFrameIndex] as StoryFrame | undefined;
  const user = story?.relations?.user;

  const normalizeUrl = (url: string | null | undefined): string | null => {
    if (!url || typeof url !== 'string' || url.length === 0) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://uservault.net${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsPaused(true);
        animationRef.current?.stop();
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsPaused(false);
        
        if (Math.abs(gestureState.dx) > 50) {
          if (gestureState.dx > 0) {
            goToPreviousFrame();
          } else {
            goToNextFrame();
          }
        } else {
          startProgressAnimation();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (currentFrame && !currentFrame.activity?.is_seen) {
      recordView.mutate(currentFrame.id);
    }
  }, [currentFrame, recordView]);

  const goToNextFrame = useCallback(() => {
    if (currentFrameIndex < frames.length - 1) {
      setCurrentFrameIndex(currentFrameIndex + 1);
      setProgress(0);
      progressAnim.setValue(0);
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    }
  }, [currentFrameIndex, frames.length, progressAnim, router]);

  const goToPreviousFrame = useCallback(() => {
    if (currentFrameIndex > 0) {
      setCurrentFrameIndex(currentFrameIndex - 1);
      setProgress(0);
      progressAnim.setValue(0);
    }
  }, [currentFrameIndex, progressAnim]);

  const startProgressAnimation = useCallback(() => {
    const duration = (currentFrame?.duration_seconds || 5) * 1000;
    const remaining = (1 - progress) * duration;

    progressAnim.setValue(progress);
    animationRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: remaining,
      useNativeDriver: false,
    });

    animationRef.current.start(({ finished }) => {
      if (finished) {
        goToNextFrame();
      }
    });

    const listener = progressAnim.addListener(({ value }) => {
      setProgress(value);
    });

    return () => {
      progressAnim.removeListener(listener);
    };
  }, [currentFrame, progress, progressAnim, goToNextFrame]);

  useEffect(() => {
    if (!isPaused && currentFrame) {
      const cleanup = startProgressAnimation();
      return cleanup;
    }
    return () => {
      animationRef.current?.stop();
    };
  }, [currentFrameIndex, isPaused, currentFrame, startProgressAnimation]);

  if (isLoading || !story) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.dark.text} />
      </View>
    );
  }

  const rawMediaUrl = currentFrame?.media?.url || currentFrame?.media?.thumbnail_url;
  const mediaUrl = normalizeUrl(rawMediaUrl);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progressBar}>
        {frames.map((_: StoryFrame, index: number) => (
          <View key={index} style={styles.progressSegment}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    index < currentFrameIndex
                      ? '100%'
                      : index === currentFrameIndex
                      ? `${progress * 100}%`
                      : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image
            source={{ uri: normalizeUrl(user?.avatar_url) || 'https://i.pravatar.cc/150' }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.username}>{user?.name || 'User'}</Text>
            <Text style={styles.timestamp}>{currentFrame?.date?.time_ago || ''}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.closeButton}>
          <X color={colors.dark.text} size={28} />
        </TouchableOpacity>
      </View>

      <View style={styles.storyContent} {...panResponder.panHandlers}>
        {mediaUrl && currentFrame?.type === 'IMAGE' && (
          <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="cover" />
        )}
        {currentFrame?.content && (
          <View style={styles.textOverlay}>
            <Text style={styles.contentText}>{currentFrame.content}</Text>
          </View>
        )}
      </View>

      {currentFrame && (
        <View style={styles.footer}>
          <Text style={styles.viewsCount}>
            {currentFrame.views_count?.formatted || '0'} views
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.dark.text,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.dark.accent,
  },
  username: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  timestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  closeButton: {
    padding: 4,
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: width,
    height: height,
    position: 'absolute',
  },
  textOverlay: {
    position: 'absolute',
    bottom: 100,
    paddingHorizontal: 24,
    width: '100%',
  },
  contentText: {
    fontSize: 18,
    color: colors.dark.text,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  viewsCount: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
