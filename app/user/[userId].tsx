import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Grid,
  Bookmark,
  ArrowLeft,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';

import colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile, useUserProfilePosts, useFollowUser } from '@/hooks/useApi';
import type { User, Post } from '@/types';
import VerifiedBadge from '@/components/VerifiedBadge';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = 220;
const AVATAR_SIZE = 92;
const GRID_GAP = 2;
const GRID_ITEM = (width - GRID_GAP * 2) / 3;

type AnyRecord = Record<string, unknown>;

type ProfileTabKey = 'grid' | 'saved';

function normalizeProfileData(input: unknown): Partial<User> | null {
  if (!input || typeof input !== 'object') return null;

  const findUserObject = (obj: AnyRecord): AnyRecord | null => {
    if ((obj.id || obj.user_id || obj.userId) && (obj.username || obj.name || obj.email)) return obj;

    const candidates = [obj.data, obj.user, obj.profile, obj.me, obj.account];
    for (const c of candidates) {
      if (c && typeof c === 'object') {
        const found = findUserObject(c as AnyRecord);
        if (found) return found;
      }
    }
    return null;
  };

  let rawUser = findUserObject(input as AnyRecord);

  if (!rawUser) {
    const res = input as AnyRecord;
    if (res.name || res.username || res.email) rawUser = res;
    else return null;
  }

  const getVal = <T,>(keys: string[], defaultVal?: T): T | undefined => {
    for (const key of keys) {
      const val = rawUser![key];
      if (val !== undefined && val !== null && val !== '') {
        let finalVal = val as T;
        if (typeof val === 'string' && (key.includes('avatar') || key.includes('cover') || key.includes('image') || key.includes('photo'))) {
          if (!val.startsWith('http://') && !val.startsWith('https://')) {
            finalVal = `https://uservault.net${val.startsWith('/') ? '' : '/'}${val}` as T;
            console.log(`[UserProfile] Converted relative URL ${key}:`, finalVal);
          } else {
            console.log(`[UserProfile] Found absolute URL ${key}:`, typeof val === 'string' ? val.slice(0, 80) : val);
          }
        }
        return finalVal;
      }
    }
    return defaultVal;
  };

  const getNum = (keys: string[]): number => {
    for (const key of keys) {
      const val = rawUser![key];
      if (val !== undefined && val !== null) {
        if (typeof val === 'number') {
          console.log(`[UserProfile] Found number from '${key}':`, val);
          return val;
        }
        if (typeof val === 'string') {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed)) {
            console.log(`[UserProfile] Parsed number from '${key}':`, parsed);
            return parsed;
          }
        }
        if (typeof val === 'object' && val !== null) {
          const objVal = val as any;
          if (typeof objVal.raw === 'number') {
            console.log(`[UserProfile] Found count.raw from '${key}':`, objVal.raw);
            return objVal.raw;
          }
          if (typeof objVal.count === 'number') {
            console.log(`[UserProfile] Found count.count from '${key}':`, objVal.count);
            return objVal.count;
          }
          if (typeof objVal.formatted === 'string') {
            const parsed = parseInt(objVal.formatted.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(parsed)) {
              console.log(`[UserProfile] Parsed count.formatted from '${key}':`, parsed);
              return parsed;
            }
          }
        }
      }
    }
    console.log(`[UserProfile] ✗ Could not find number for keys:`, keys);
    return 0;
  };

  const id = getNum(['id', 'user_id', 'userId', 'uid']);
  const usernameRaw = getVal<string>(['username', 'user_name', 'handle', 'login']);
  const emailRaw = getVal<string>(['email']);
  const name = getVal<string>(['name', 'full_name', 'display_name', 'fullName', 'first_name']) || 'User';
  const bio = getVal<string>(['bio', 'about', 'description']);
  const avatar = getVal<string>(['avatar_url', 'avatar', 'profile_image', 'profile_photo_url', 'photo', 'profileImage', 'picture', 'image', 'photo_url']);
  const cover = getVal<string>(['cover_url', 'cover', 'banner', 'banner_url', 'cover_image', 'coverImage', 'header_image', 'background', 'background_url']);
  const location = getVal<string>(['location', 'city', 'address']);
  const website = getVal<string>(['website', 'url', 'site']);
  const verified = getVal<boolean>(['verified', 'is_verified'], false) || getVal<number>(['verified'], 0) === 1;
  const verified_at = getVal<string>(['verified_at', 'verifiedAt', 'verification_date']);
  const created_at = getVal<string>(['created_at', 'createdAt', 'joined_at', 'joinedAt', 'registration_date', 'date_joined']);
  const country = getVal<string>(['country', 'country_code']);
  const type = getVal<'author' | 'reader'>(['type'], 'reader');
  
  const posts_count = getNum(['posts_count', 'postsCount', 'posts', 'publications_count', 'posts.count', 'stats.posts', 'stats.posts_count']);
  const followers_count = getNum(['followers_count', 'followersCount', 'followers', 'followers.count', 'stats.followers', 'stats.followers_count']);
  const following_count = getNum(['following_count', 'followingCount', 'following', 'followings_count', 'following.count', 'stats.following', 'stats.following_count']);
  
  console.log('[UserProfile] Stats extraction for', usernameRaw || id, ':');
  console.log('[UserProfile]   posts_count:', posts_count);
  console.log('[UserProfile]   followers_count:', followers_count);
  console.log('[UserProfile]   following_count:', following_count);

  const normalized: Partial<User> = {
    id,
    username: usernameRaw || (emailRaw ? emailRaw.split('@')[0] : undefined) || 'user',
    name: name as any,
    email: emailRaw,
    bio,
    avatar,
    cover,
    location,
    website,
    posts_count,
    followers_count,
    following_count,
    verified,
    verified_at,
    created_at,
    country,
    type,
  };

  return normalized;
}

function getPostPreviewUrl(post: Post): string | null {
  if (!post.relations || !post.relations.media) return null;
  if (!Array.isArray(post.relations.media) || post.relations.media.length === 0) return null;
  
  const firstMedia = post.relations.media[0];
  const mediaType = firstMedia?.type;
  let rawUrl: string | null | undefined = null;
  
  console.log('[UserProfile] Post', post.id, 'media:', firstMedia);
  console.log('[UserProfile] Post', post.id, 'media type:', mediaType);
  
  if (mediaType === 'VIDEO') {
    rawUrl = firstMedia?.thumbnail_url;
    console.log('[UserProfile] Post', post.id, 'is video, using thumbnail:', rawUrl);
  } else {
    rawUrl = firstMedia?.source_url || firstMedia?.thumbnail_url;
    console.log('[UserProfile] Post', post.id, 'is image/other, using source:', rawUrl);
  }
  
  if (typeof rawUrl === 'string' && rawUrl.length > 0) {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      console.log('[UserProfile] Post', post.id, 'using absolute URL:', rawUrl);
      return rawUrl;
    }
    const fullUrl = `https://uservault.net${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
    console.log('[UserProfile] Post', post.id, 'converted to full URL:', fullUrl);
    return fullUrl;
  }
  
  console.log('[UserProfile] Post', post.id, 'no valid URL found');
  return null;
}

function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
}

function SkeletonLine({ widthPercent }: { widthPercent: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });

  return (
    <Animated.View
      style={[
        styles.skeletonLine,
        { width: `${Math.max(8, Math.min(100, widthPercent))}%`, opacity },
      ]}
    />
  );
}

export default function UserProfileScreen() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const username = userId || '';
  const isOwnProfile = currentUser?.username === username;

  const followMutation = useFollowUser();
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [isRequested, setIsRequested] = React.useState(false);

  const {
    data: profileData,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useUserProfile(username);

  const {
    data: postsData,
    isLoading: postsLoading,
    refetch: refetchPosts,
  } = useUserProfilePosts(username);

  const scrollY = useRef(new Animated.Value(0)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;

  const [activeTab, setActiveTab] = React.useState<ProfileTabKey>('grid');

  const fetchedUser = useMemo(() => {
    const normalized = normalizeProfileData(profileData);
    console.log('[UserProfile] Normalized user data:', normalized);
    return normalized;
  }, [profileData]);
  
  const displayUser = fetchedUser;

  const initialFollowStatusSet = React.useRef(false);

  React.useEffect(() => {
    if (displayUser && !initialFollowStatusSet.current) {
      const meta = profileData?.data?.meta || profileData?.meta;
      const followingStatus = meta?.following || meta?.is_following || false;
      const requestedStatus = meta?.requested || meta?.is_requested || false;
      console.log('[UserProfile] Setting initial follow status - following:', followingStatus, 'requested:', requestedStatus);
      setIsFollowing(followingStatus);
      setIsRequested(requestedStatus);
      initialFollowStatusSet.current = true;
    }
  }, [displayUser, profileData]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchProfile(), refetchPosts()]);
  }, [refetchProfile, refetchPosts]);

  const gridPosts = useMemo(() => {
    const posts = postsData?.data ?? [];
    console.log('[UserProfile] Processing posts:', posts.length);
    const allPosts = posts.map((p: Post) => {
      const url = getPostPreviewUrl(p);
      const hasMedia = !!url;
      console.log('[UserProfile] Post', p.id, '- hasMedia:', hasMedia, 'content:', p.content?.substring(0, 30));
      return { post: p, url, hasMedia };
    });
    
    return allPosts;
  }, [postsData]);

  const isLoading = profileLoading || postsLoading;

  const coverTranslateY = scrollY.interpolate({
    inputRange: [-80, 0, COVER_HEIGHT],
    outputRange: [-40, 0, -40],
    extrapolate: 'clamp',
  });

  const coverScale = scrollY.interpolate({
    inputRange: [-120, 0],
    outputRange: [1.15, 1],
    extrapolate: 'clamp',
  });

  const avatarTranslateY = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, -26],
    extrapolate: 'clamp',
  });

  const avatarScale = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [1, 0.84],
    extrapolate: 'clamp',
  });

  const setTab = useCallback(
    (tab: ProfileTabKey) => {
      setActiveTab(tab);
      const value = tab === 'grid' ? 0 : 1;
      Animated.spring(tabAnim, {
        toValue: value,
        speed: 18,
        bounciness: 8,
        useNativeDriver: true,
      }).start();
    },
    [tabAnim]
  );

  const indicatorTranslateX = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (width - 32) / 2],
  });



  const coverUrl = displayUser?.cover || 'https://images.unsplash.com/photo-1520975682031-a2cfb08f4e97?auto=format&fit=crop&w=1600&q=70';
  const avatarUrl = displayUser?.avatar || `https://i.pravatar.cc/200?u=${displayUser?.username || 'user'}`;

  if (profileError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={colors.dark.text} size={24} />
          </TouchableOpacity>
          <View style={styles.topBarTitleWrap}>
            <Text style={styles.topBarTitle}>User Profile</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>User Not Found</Text>
          <Text style={styles.errorMessage}>
            {profileError instanceof Error ? profileError.message : 'This user could not be found or may no longer exist.'}
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (profileLoading || !displayUser) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.dark.text} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.dark.text} size={24} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={colors.dark.text} />}
      >
        <View style={styles.hero}>
          <Animated.View style={[styles.coverWrap, { transform: [{ translateY: coverTranslateY }, { scale: coverScale }] }]}>
            <Image source={{ uri: coverUrl }} style={styles.cover} />
            <View style={styles.coverScrim} />
            <View style={styles.coverPattern} pointerEvents="none" />
          </Animated.View>

          <View style={styles.heroContent}>
            <Animated.View style={[styles.avatarWrap, { transform: [{ translateY: avatarTranslateY }, { scale: avatarScale }] }]}>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            </Animated.View>

            <View style={styles.headerBlock}>
              {profileLoading ? (
                <View style={styles.skeletonBlock}>
                  <SkeletonLine widthPercent={42} />
                  <SkeletonLine widthPercent={68} />
                  <SkeletonLine widthPercent={54} />
                </View>
              ) : (
                <>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{displayUser.name}</Text>
                    {displayUser.verified && (
                      <VerifiedBadge 
                        size={22} 
                        verifiedDate={displayUser.verified_at}
                        joinedDate={displayUser.created_at}
                        location={displayUser.country || displayUser.location}
                      />
                    )}
                  </View>
                  <Text style={styles.handle}>@{displayUser.username}</Text>

                  {!!displayUser.bio && (
                    <Text style={styles.bio}>
                      {displayUser.bio}
                    </Text>
                  )}
                </>
              )}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statValue}>{compactNumber(displayUser.posts_count ?? 0)}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statValue}>{compactNumber(displayUser.followers_count ?? 0)}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statValue}>{compactNumber(displayUser.following_count ?? 0)}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>

            <View style={styles.primaryActions}>
              {isOwnProfile ? (
                <>
                  <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={() => router.push('/modal')}>
                    <Text style={styles.primaryBtnText}>Edit Profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.9}>
                    <Text style={styles.secondaryBtnText}>Share</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity 
                    style={[styles.primaryBtn, (isFollowing || isRequested) && styles.primaryBtnFollowing]} 
                    activeOpacity={0.9}
                    disabled={followMutation.isPending}
                    onPress={async () => {
                      if (!displayUser?.id) {
                        console.error('[UserProfile] ✗ Cannot follow - no user ID');
                        return;
                      }
                      
                      console.log('[UserProfile] ===== TOGGLE FOLLOW =====');
                      console.log('[UserProfile] User ID:', displayUser.id);
                      console.log('[UserProfile] Username:', displayUser.username);
                      console.log('[UserProfile] Current following:', isFollowing);
                      console.log('[UserProfile] Current requested:', isRequested);
                      
                      try {
                        const response = await followMutation.mutateAsync(displayUser.id);
                        console.log('[UserProfile] ✓ Follow response:', JSON.stringify(response));
                        
                        const newFollowing = response?.data?.following ?? false;
                        const newRequested = response?.data?.requested ?? false;
                        
                        console.log('[UserProfile] New following:', newFollowing);
                        console.log('[UserProfile] New requested:', newRequested);
                        
                        setIsFollowing(newFollowing);
                        setIsRequested(newRequested);
                        
                        setTimeout(async () => {
                          initialFollowStatusSet.current = false;
                          await refetchProfile();
                        }, 500);
                      } catch (error) {
                        console.error('[UserProfile] ✗ Follow error:', error);
                      }
                    }}
                  >
                    <Text style={[styles.primaryBtnText, (isFollowing || isRequested) && styles.primaryBtnTextFollowing]}>
                      {followMutation.isPending ? 'Loading...' : (isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.secondaryBtn} 
                    activeOpacity={0.9}
                    onPress={() => {
                      if (!displayUser?.username) {
                        console.error('[UserProfile] Cannot message - no username');
                        return;
                      }
                      console.log('[UserProfile] Navigate to chat with:', displayUser.username);
                      router.push(`/chat/${displayUser.username}`);
                    }}
                  >
                    <Text style={styles.secondaryBtnText}>Message</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.tabBar}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              onPress={() => setTab('grid')}
              style={[styles.tabBtn, activeTab === 'grid' && styles.tabBtnActive]}
            >
              <Grid color={activeTab === 'grid' ? colors.dark.text : colors.dark.textSecondary} size={18} />
              <Text style={[styles.tabText, activeTab === 'grid' && styles.tabTextActive]}>Posts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTab('saved')}
              style={[styles.tabBtn, activeTab === 'saved' && styles.tabBtnActive]}
            >
              <Bookmark color={activeTab === 'saved' ? colors.dark.text : colors.dark.textSecondary} size={18} />
              <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>Tagged</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabIndicatorTrack}>
            <Animated.View style={[styles.tabIndicator, { transform: [{ translateX: indicatorTranslateX }] }]} />
          </View>
        </View>

        {activeTab === 'saved' ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No tagged posts</Text>
            <Text style={styles.emptySub}>Posts where @{displayUser.username} is tagged will appear here.</Text>
          </View>
        ) : postsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.dark.text} />
          </View>
        ) : gridPosts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptySub}>
              {isOwnProfile ? "You haven't posted anything yet." : `@${displayUser.username} hasn't posted anything yet.`}
            </Text>
          </View>
        ) : (
          <View style={styles.postsContainer}>
            {gridPosts.map(({ post, url, hasMedia }) => {
              if (hasMedia && url) {
                return (
                  <TouchableOpacity key={post.id} style={styles.gridItem} activeOpacity={0.9}>
                    <Image 
                      source={{ uri: url }} 
                      style={styles.gridImg}
                      onError={(error) => {
                        console.error('[UserProfile] Image load error for post', post.id, ':', error.nativeEvent.error);
                        console.error('[UserProfile] Failed URL:', url);
                      }}
                      onLoad={() => {
                        console.log('[UserProfile] Image loaded successfully for post', post.id);
                      }}
                    />
                  </TouchableOpacity>
                );
              } else {
                return (
                  <TouchableOpacity key={post.id} style={styles.textPostCard} activeOpacity={0.9}>
                    <Text style={styles.textPostContent} numberOfLines={3}>
                      {post.content}
                    </Text>
                    <View style={styles.textPostFooter}>
                      <Text style={styles.textPostDate}>
                        {post.date?.time_ago || (post.date?.iso ? new Date(post.date.iso).toLocaleDateString() : 'Recent')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }
            })}
          </View>
        )}

        <View style={{ height: Platform.OS === 'web' ? 24 : 40 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  topBar: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: colors.dark.background,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  topBarTitleWrap: {
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  topBarTitle: {
    color: colors.dark.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  scroll: {
    flex: 1,
  },
  hero: {
    paddingBottom: 14,
  },
  coverWrap: {
    height: COVER_HEIGHT,
    overflow: 'hidden',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  coverPattern: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0.35,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroContent: {
    paddingHorizontal: 16,
    marginTop: -46,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: colors.dark.card,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  headerBlock: {
    marginTop: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: colors.dark.text,
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
  },
  handle: {
    marginTop: 2,
    color: colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  bio: {
    marginTop: 10,
    color: colors.dark.text,
    fontSize: 14,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statPill: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: {
    color: colors.dark.text,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  statLabel: {
    marginTop: 4,
    color: colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnFollowing: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  primaryBtnText: {
    color: colors.dark.background,
    fontSize: 14,
    fontWeight: '900' as const,
    letterSpacing: 0.2,
  },
  primaryBtnTextFollowing: {
    color: colors.dark.text,
  },
  secondaryBtn: {
    width: 110,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: colors.dark.text,
    fontSize: 14,
    fontWeight: '800' as const,
  },
  tabBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tabText: {
    color: colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '800' as const,
  },
  tabTextActive: {
    color: colors.dark.text,
  },
  tabIndicatorTrack: {
    marginTop: 10,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  tabIndicator: {
    width: (width - 32) / 2,
    height: 3,
    backgroundColor: colors.dark.accent,
    borderRadius: 999,
  },
  postsContainer: {
    paddingHorizontal: 1,
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridItem: {
    width: GRID_ITEM,
    height: GRID_ITEM,
    backgroundColor: colors.dark.card,
    overflow: 'hidden',
    borderRadius: 2,
    marginBottom: 2,
    marginRight: 2,
  },
  gridImg: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.dark.card,
  },
  textPostCard: {
    marginHorizontal: 8,
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  textPostContent: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.dark.text,
    fontWeight: '500' as const,
  },
  textPostFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  textPostDate: {
    fontSize: 12,
    color: colors.dark.textSecondary,
    fontWeight: '600' as const,
  },
  emptyWrap: {
    paddingHorizontal: 16,
    paddingVertical: 28,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    color: colors.dark.text,
    fontSize: 18,
    fontWeight: '900' as const,
    letterSpacing: -0.2,
  },
  emptySub: {
    marginTop: 6,
    color: colors.dark.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  center: {
    paddingVertical: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonBlock: {
    gap: 10,
    marginTop: 4,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: colors.dark.text,
    fontSize: 24,
    fontWeight: '900' as const,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  errorMessage: {
    color: colors.dark.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  errorButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: colors.dark.accent,
  },
  errorButtonText: {
    color: colors.dark.background,
    fontSize: 16,
    fontWeight: '900' as const,
    letterSpacing: 0.2,
  },
});
