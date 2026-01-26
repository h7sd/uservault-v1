import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Radio, Users, Play, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import streamingService, { LiveStream } from '@/services/streaming';

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

export default function LiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: streams = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['live-streams'],
    queryFn: () => streamingService.getLiveStreams(),
    refetchInterval: 30000,
  });

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

  const renderStream = useCallback(
    ({ item }: { item: LiveStream }) => (
      <LiveStreamCard stream={item} onPress={() => handleWatchStream(item)} />
    ),
    [handleWatchStream]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Radio color={colors.dark.accent} size={24} />
          <Text style={styles.headerTitle}>Live</Text>
        </View>
        <TouchableOpacity style={styles.goLiveHeaderButton} onPress={handleGoLive}>
          <Zap color="#FFF" size={16} />
          <Text style={styles.goLiveHeaderText}>Go Live</Text>
        </TouchableOpacity>
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.dark.text,
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
});
