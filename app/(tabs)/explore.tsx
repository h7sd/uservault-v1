import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Dimensions,
  TextInput,
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Heart, Users, BadgeCheck, MessageCircle, Share2, MoreHorizontal, Eye, X, Play, TrendingUp, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import colors from '@/constants/colors';
import { useExplorePosts, useSearchPeople, useFollowUser, useLikePost } from '@/hooks/useApi';
import { Video, ResizeMode } from 'expo-av';
import type { Post, User } from '@/types';
import { FREQUENTLY_USED_EMOJIS, EMOJI_CATEGORIES, getEmojiByUnified, type Emoji } from '@/constants/emojis';

const { width } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_ITEM_SIZE = (width - GRID_GAP * 2) / 3;

function AnimatedGridItem({ post, index }: { post: Post; index: number }) {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const postMedia = post.relations.media && post.relations.media.length > 0 ? post.relations.media[0] : null;
  const mediaType = postMedia?.type?.toUpperCase();
  const isVideo = mediaType === 'VIDEO';
  
  const normalizeUrl = (url: any): string | null => {
    if (!url || typeof url !== 'string' || url.length === 0) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://uservault.net${url.startsWith('/') ? '' : '/'}${url}`;
  };
  
  let mediaUrl = normalizeUrl(postMedia?.source_url);
  let thumbnailUrl = normalizeUrl(postMedia?.thumbnail_url);
  const postImage = isVideo ? (thumbnailUrl || mediaUrl) : mediaUrl;

  if (!postImage) return null;

  return (
    <Animated.View style={[
      styles.gridItem,
      { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
    ]}>
      <TouchableOpacity 
        style={styles.gridItemTouchable}
        activeOpacity={0.9}
        onPress={() => router.push(`/user/${post.relations.user.username || post.relations.user.id}`)}
      >
        <Image source={{ uri: postImage }} style={styles.gridImage} />
        {isVideo && (
          <View style={styles.videoIndicator}>
            <Play color="#FFF" size={16} fill="#FFF" />
          </View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.gridOverlay}
        >
          <View style={styles.gridStats}>
            <View style={styles.gridStat}>
              <Heart color="#FFF" size={12} fill="#FFF" />
              <Text style={styles.gridStatText}>{post.views_count.formatted}</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

function AnimatedUserItem({ user, index }: { user: User; index: number }) {
  const router = useRouter();
  const followMutation = useFollowUser();
  const [isFollowing, setIsFollowing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  let avatar = user.avatar || `https://i.pravatar.cc/150?u=${user.id}`;
  if (avatar && !avatar.startsWith('http://') && !avatar.startsWith('https://')) {
    avatar = `https://uservault.net${avatar.startsWith('/') ? '' : '/'}${avatar}`;
  }

  const handleFollow = async () => {
    if (!user.id || typeof user.id !== 'number') return;
    
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    const previousState = isFollowing;
    try {
      setIsFollowing(!isFollowing);
      await followMutation.mutateAsync(user.id);
    } catch (error) {
      setIsFollowing(previousState);
    }
  };

  return (
    <Animated.View style={[
      styles.userItem,
      { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }
    ]}>
      <TouchableOpacity 
        style={styles.userInfo}
        onPress={() => router.push(`/user/${user.username || user.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.userAvatarContainer}>
          <Image source={{ uri: avatar }} style={styles.userAvatar} />
          {user.verified && (
            <View style={styles.verifiedBadgeSmall}>
              <BadgeCheck color="#FFF" size={12} fill={colors.dark.accent} />
            </View>
          )}
        </View>
        <View style={styles.userDetails}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{user.name}</Text>
          </View>
          <Text style={styles.userUsername}>@{user.username}</Text>
          {user.bio && (
            <Text style={styles.userBio} numberOfLines={1}>{user.bio}</Text>
          )}
        </View>
      </TouchableOpacity>
      <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
        <TouchableOpacity 
          style={[styles.followButton, isFollowing && styles.followingButton]}
          onPress={handleFollow}
          activeOpacity={0.8}
        >
          <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const { data: postsData, isLoading: postsLoading, refetch: refetchPosts } = useExplorePosts();
  const { data: peopleData, isLoading: peopleLoading } = useSearchPeople(searchQuery);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const searchBarScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(headerOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    Animated.spring(searchBarScale, {
      toValue: 1.02,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
    Animated.spring(searchBarScale, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const posts = postsData?.data || [];
  const people = peopleData?.data || [];

  const isSearching = searchQuery.length >= 1;
  const isLoading = isSearching ? peopleLoading : postsLoading;

  const postsWithMedia = posts.filter((post: Post) => {
    const postMedia = post.relations.media && post.relations.media.length > 0 ? post.relations.media[0] : null;
    return postMedia?.source_url || postMedia?.thumbnail_url;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchPosts();
    } catch (e) {
      console.error('[Explore] Refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitleRow}>
              <Sparkles color={colors.dark.accent} size={24} />
              <Text style={styles.headerTitle}>Discover</Text>
            </View>
          </View>
          
          <Animated.View style={[
            styles.searchBar,
            isSearchFocused && styles.searchBarFocused,
            { transform: [{ scale: searchBarScale }] }
          ]}>
            <Search color={isSearchFocused ? colors.dark.accent : colors.dark.textSecondary} size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search people..."
              placeholderTextColor={colors.dark.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X color={colors.dark.textSecondary} size={18} />
              </TouchableOpacity>
            )}
          </Animated.View>
        </Animated.View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={colors.dark.accent}
            />
          }
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.dark.accent} />
              <Text style={styles.loadingText}>
                {isSearching ? 'Searching...' : 'Loading content...'}
              </Text>
            </View>
          ) : isSearching && people.length > 0 ? (
            <View style={styles.peopleList}>
              <View style={styles.sectionHeader}>
                <Users color={colors.dark.textSecondary} size={18} />
                <Text style={styles.sectionTitle}>People</Text>
                <Text style={styles.sectionCount}>{people.length} found</Text>
              </View>
              {people.map((user, index) => (
                <AnimatedUserItem key={user.id} user={user} index={index} />
              ))}
            </View>
          ) : isSearching && people.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Users color={colors.dark.textSecondary} size={48} />
              </View>
              <Text style={styles.emptyText}>No results found</Text>
              <Text style={styles.emptySubtext}>Try a different search term</Text>
            </View>
          ) : (
            <View style={styles.gridSection}>
              <View style={styles.trendingHeader}>
                <TrendingUp color={colors.dark.accent} size={18} />
                <Text style={styles.trendingTitle}>Trending</Text>
              </View>
              {postsWithMedia.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No content yet</Text>
                  <Text style={styles.emptySubtext}>Check back later for trending posts</Text>
                </View>
              ) : (
                <View style={styles.gridContainer}>
                  {postsWithMedia.map((post: Post, index: number) => (
                    <AnimatedGridItem key={post.id} post={post} index={index} />
                  ))}
                </View>
              )}
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTop: {
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.dark.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchBarFocused: {
    borderColor: colors.dark.accent,
    backgroundColor: colors.dark.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.dark.text,
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.dark.text,
    flex: 1,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.dark.textSecondary,
  },
  gridSection: {
    flex: 1,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  trendingTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
  },
  gridItemTouchable: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.dark.card,
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 4,
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    justifyContent: 'flex-end',
    padding: 6,
  },
  gridStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridStatText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: colors.dark.textSecondary,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    marginTop: 8,
  },
  peopleList: {
    paddingVertical: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    backgroundColor: colors.dark.card,
    borderRadius: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  userAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  verifiedBadgeSmall: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.dark.background,
    borderRadius: 10,
    padding: 2,
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  userUsername: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    marginBottom: 2,
  },
  userBio: {
    fontSize: 13,
    color: colors.dark.textSecondary,
    lineHeight: 17,
  },
  followButton: {
    backgroundColor: colors.dark.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.dark.border,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  followingButtonText: {
    color: colors.dark.textSecondary,
  },
});
