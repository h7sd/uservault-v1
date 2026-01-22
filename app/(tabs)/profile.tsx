import React, { useCallback, useMemo, useRef, useEffect } from 'react';
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
  Settings,
  Grid,
  Bookmark,
  LogOut,
  RefreshCw,
  AlertCircle,
  Link as LinkIcon,
  MapPin,
  ShoppingBag,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

import colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentUserPosts, useCurrentUserProfile, useMarketplaceProducts } from '@/hooks/useApi';
import type { User, Post } from '@/types';
import VerifiedBadge from '@/components/VerifiedBadge';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = 220;
const AVATAR_SIZE = 92;
const GRID_GAP = 2;
const GRID_ITEM = (width - GRID_GAP * 2) / 3;

type AnyRecord = Record<string, unknown>;

type ProfileTabKey = 'grid' | 'saved' | 'marketplace';

function normalizeProfileData(input: unknown): Partial<User> | null {
  if (!input || typeof input !== 'object') return null;

  console.log('[Profile] ===== NORMALIZING PROFILE DATA =====');
  console.log('[Profile] Raw input keys:', Object.keys(input as AnyRecord));
  console.log('[Profile] Raw input:', JSON.stringify(input).slice(0, 1500));

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
    else {
      console.log('[Profile] ✗ Could not find user object in response');
      return null;
    }
  }

  console.log('[Profile] Found user object, keys:', Object.keys(rawUser));

  const getVal = <T,>(keys: string[], defaultVal?: T): T | undefined => {
    for (const key of keys) {
      const val = rawUser![key];
      if (val !== undefined && val !== null && val !== '') {
        let finalVal = val as T;
        if (typeof val === 'string' && (key.includes('avatar') || key.includes('cover') || key.includes('image') || key.includes('photo'))) {
          if (!val.startsWith('http://') && !val.startsWith('https://')) {
            finalVal = `https://uservault.net${val.startsWith('/') ? '' : '/'}${val}` as T;
            console.log(`[Profile] Converted relative URL ${key}:`, finalVal);
          } else {
            console.log(`[Profile] Found absolute URL ${key}:`, typeof val === 'string' ? val.slice(0, 80) : val);
          }
        } else {
          console.log(`[Profile] Found ${key}:`, typeof val === 'string' ? val.slice(0, 80) : val);
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
          console.log(`[Profile] Found number from '${key}':`, val);
          return val;
        }
        if (typeof val === 'string') {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed)) {
            console.log(`[Profile] Parsed number from '${key}':`, parsed);
            return parsed;
          }
        }
        if (typeof val === 'object' && val !== null) {
          const objVal = val as any;
          if (typeof objVal.raw === 'number') {
            console.log(`[Profile] Found count.raw from '${key}':`, objVal.raw);
            return objVal.raw;
          }
          if (typeof objVal.count === 'number') {
            console.log(`[Profile] Found count.count from '${key}':`, objVal.count);
            return objVal.count;
          }
          if (typeof objVal.formatted === 'string') {
            const parsed = parseInt(objVal.formatted.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(parsed)) {
              console.log(`[Profile] Parsed count.formatted from '${key}':`, parsed);
              return parsed;
            }
          }
        }
      }
    }
    console.log(`[Profile] ✗ Could not find number for keys:`, keys);
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
  
  console.log('[Profile] Stats extraction:');
  console.log('[Profile]   posts_count:', posts_count);
  console.log('[Profile]   followers_count:', followers_count);
  console.log('[Profile]   following_count:', following_count);

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

  console.log('[Profile] ===== NORMALIZED RESULT =====');
  console.log('[Profile] ID:', normalized.id);
  console.log('[Profile] Username:', normalized.username);
  console.log('[Profile] Name:', normalized.name);
  console.log('[Profile] Bio:', normalized.bio ? `YES (${normalized.bio.slice(0, 30)}...)` : 'NO');
  console.log('[Profile] Avatar:', normalized.avatar ? 'YES' : 'NO');
  console.log('[Profile] Cover:', normalized.cover ? 'YES' : 'NO');
  console.log('[Profile] Posts:', normalized.posts_count);
  console.log('[Profile] Followers:', normalized.followers_count);
  console.log('[Profile] Following:', normalized.following_count);
  console.log('[Profile] Verified:', normalized.verified);
  console.log('[Profile] ================================');

  return normalized;
}

function getPostPreviewUrl(post: Post): string | null {
  console.log('[Profile] getPostPreviewUrl for post:', post.id);
  console.log('[Profile] post type:', post.type);
  console.log('[Profile] post.relations:', post.relations ? Object.keys(post.relations) : 'no relations');
  console.log('[Profile] post.relations.media:', JSON.stringify(post.relations?.media));
  
  if (!post.relations || !post.relations.media) {
    console.log('[Profile] no relations or media for post:', post.id);
    return null;
  }
  
  if (!Array.isArray(post.relations.media) || post.relations.media.length === 0) {
    console.log('[Profile] media is not an array or empty for post:', post.id);
    return null;
  }
  
  const firstMedia = post.relations.media[0];
  console.log('[Profile] first media object:', JSON.stringify(firstMedia));
  
  const mediaType = firstMedia?.type;
  let mediaUrl: string | null | undefined = null;
  
  if (mediaType === 'VIDEO') {
    mediaUrl = firstMedia?.thumbnail_url;
    console.log('[Profile] video detected, using thumbnail:', mediaUrl);
    if (!mediaUrl) {
      console.log('[Profile] ✗ Video has no thumbnail, skipping');
      return null;
    }
  } else {
    mediaUrl = firstMedia?.source_url || firstMedia?.thumbnail_url;
    console.log('[Profile] image/other media, using source_url:', mediaUrl);
  }
  
  if (typeof mediaUrl === 'string' && mediaUrl.length > 0) {
    const lowerUrl = mediaUrl.toLowerCase();
    if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.mov') || lowerUrl.endsWith('.webm') || lowerUrl.endsWith('.avi')) {
      console.log('[Profile] ✗ URL is a video file, cannot use as image:', mediaUrl);
      return null;
    }
    
    if (!mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
      mediaUrl = `https://uservault.net${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;
      console.log('[Profile] converted to absolute URL:', mediaUrl);
    }
    return mediaUrl;
  }
  
  console.log('[Profile] ✗ No valid URL found for post:', post.id);
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

export default function ProfileScreen() {
  const { currentUser, logout, updateUser } = useAuth();
  const router = useRouter();

  const {
    data: profileData,
    isLoading: profileLoading,
    refetch: refetchProfile,
    error: profileError,
  } = useCurrentUserProfile();

  const {
    data: postsData,
    isLoading: postsLoading,
    refetch: refetchPosts,
    error: postsError,
  } = useCurrentUserPosts();

  const scrollY = useRef(new Animated.Value(0)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;

  const [activeTab, setActiveTab] = React.useState<ProfileTabKey>('grid');

  const { data: marketplaceData, isLoading: marketplaceLoading } = useMarketplaceProducts(1, undefined);
  const marketplaceProducts = marketplaceData?.data || [];

  const fetchedUser = useMemo(() => normalizeProfileData(profileData), [profileData]);
  
  const hasSyncedRef = useRef(false);
  const lastSyncedIdRef = useRef<number | null>(null);
  const initialUserIdRef = useRef<number | null>(currentUser?.id ?? null);
  const updateCountRef = useRef(0);
  
  useEffect(() => {
    if (initialUserIdRef.current === null && currentUser?.id) {
      initialUserIdRef.current = currentUser.id;
      console.log('[Profile] Stored initial user ID:', currentUser.id);
    }
  }, [currentUser?.id]);
  
  const displayUser = useMemo(() => {
    if (!currentUser) return null;
    if (!fetchedUser) return currentUser;
    if (fetchedUser.id !== initialUserIdRef.current) {
      console.log('[Profile] ⚠️ fetchedUser ID mismatch!', fetchedUser.id, '!=', initialUserIdRef.current);
      return currentUser;
    }
    return { ...currentUser, ...fetchedUser, is_temporary: false };
  }, [currentUser, fetchedUser]);

  const isTemporary = displayUser?.is_temporary === true;
  
  useEffect(() => {
    if (!fetchedUser || !fetchedUser.id || !initialUserIdRef.current) return;
    
    if (fetchedUser.id !== initialUserIdRef.current) {
      console.log('[Profile] ⚠️ Refusing to sync - ID mismatch:', fetchedUser.id, '!=', initialUserIdRef.current);
      return;
    }
    
    if (currentUser?.id !== initialUserIdRef.current) {
      console.log('[Profile] ⚠️ currentUser was changed to wrong user! Refusing to sync.');
      return;
    }
    
    if (updateCountRef.current >= 2) {
      console.log('[Profile] ⚠️ Already synced twice, preventing infinite loop');
      return;
    }
    
    if (fetchedUser.id === initialUserIdRef.current && currentUser?.id === fetchedUser.id) {
      if (!hasSyncedRef.current || lastSyncedIdRef.current !== fetchedUser.id) {
        console.log('[Profile] ✓ Syncing fetched user into AuthContext, id:', fetchedUser.id);
        hasSyncedRef.current = true;
        lastSyncedIdRef.current = fetchedUser.id;
        updateCountRef.current += 1;
        updateUser({ ...fetchedUser, is_temporary: false });
      }
    }
  }, [fetchedUser, currentUser?.id, updateUser]);

  const handleRefresh = useCallback(async () => {
    console.log('[Profile] pull to refresh');
    await Promise.all([refetchProfile(), refetchPosts()]);
  }, [refetchProfile, refetchPosts]);

  const handleForceSync = useCallback(async () => {
    console.log('[Profile] force sync triggered');
    await Promise.all([refetchProfile(), refetchPosts()]);
  }, [refetchProfile, refetchPosts]);

  const handleLogout = useCallback(async () => {
    console.log('[Profile] logout pressed');
    await logout();
    router.replace('/login');
  }, [logout, router]);

  const gridPosts = useMemo(() => {
    console.log('[Profile] ===== COMPUTING GRID POSTS =====');
    console.log('[Profile] postsData:', postsData);
    console.log('[Profile] postsData?.data length:', postsData?.data?.length || 0);
    
    const posts = postsData?.data ?? [];
    console.log('[Profile] total posts count:', posts.length);
    
    if (posts.length > 0) {
      console.log('[Profile] first post full data:', JSON.stringify(posts[0]));
    }
    
    const allPosts = posts.map((p) => {
      const url = getPostPreviewUrl(p);
      return { post: p, url, hasMedia: !!url };
    });
    
    console.log('[Profile] posts with media check:', allPosts.map(p => ({
      id: p.post.id,
      type: p.post.type,
      hasMedia: p.hasMedia,
      mediaCount: p.post.relations?.media?.length || 0
    })));
    
    console.log('[Profile] ✓ Total gridPosts count (including text):', allPosts.length);
    console.log('[Profile] ==================================');
    return allPosts;
  }, [postsData]);

  const hasAnyError = !!profileError || !!postsError;
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

  const headerFade = scrollY.interpolate({
    inputRange: [0, 90],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const setTab = useCallback(
    (tab: ProfileTabKey) => {
      setActiveTab(tab);
      const value = tab === 'grid' ? 0 : tab === 'saved' ? 1 : 2;
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
    inputRange: [0, 1, 2],
    outputRange: [0, (width - 32) / 3, ((width - 32) / 3) * 2],
  });

  const coverUrl = displayUser?.cover || 'https://images.unsplash.com/photo-1520975682031-a2cfb08f4e97?auto=format&fit=crop&w=1600&q=70';
  const avatarUrl = displayUser?.avatar || `https://i.pravatar.cc/200?u=${displayUser?.username || 'user'}`;

  if (!displayUser) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center} testID="profile_loading_empty">
          <ActivityIndicator size="large" color={colors.dark.text} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar} testID="profile_topbar">
        <Animated.View style={[styles.topBarTitleWrap, { opacity: headerFade }]} pointerEvents="none">
          <Text style={styles.topBarTitle} numberOfLines={1}>
            @{displayUser.username}
          </Text>
        </Animated.View>

        <View style={styles.topBarActions}>
          {isTemporary && (
            <TouchableOpacity
              onPress={handleForceSync}
              style={[styles.iconBtn, styles.iconBtnWarning]}
              testID="profile_force_sync"
            >
              <RefreshCw color={colors.dark.warning} size={20} />
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => router.push('/modal')} style={styles.iconBtn} testID="profile_settings">
            <Settings color={colors.dark.text} size={20} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} testID="profile_logout">
            <LogOut color={colors.dark.text} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={colors.dark.text} />}
        testID="profile_scroll"
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
                <View style={styles.skeletonBlock} testID="profile_skeleton">
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
                  <Text style={styles.handle} testID="profile_handle">@{displayUser.username}</Text>

                  {!!displayUser.bio && (
                    <Text style={styles.bio} testID="profile_bio">
                      {displayUser.bio}
                    </Text>
                  )}

                  <View style={styles.metaRow}>
                    {!!displayUser.location && (
                      <View style={styles.metaItem} testID="profile_location">
                        <MapPin color={colors.dark.textSecondary} size={14} />
                        <Text style={styles.metaText} numberOfLines={1}>
                          {displayUser.location}
                        </Text>
                      </View>
                    )}

                    {!!displayUser.website && (
                      <View style={styles.metaItem} testID="profile_website">
                        <LinkIcon color={colors.dark.textSecondary} size={14} />
                        <Text style={styles.metaText} numberOfLines={1}>
                          {String(displayUser.website)}
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>

            <View style={styles.statsRow} testID="profile_stats">
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

            {(isTemporary || hasAnyError) && (
              <View style={[styles.notice, hasAnyError ? styles.noticeError : styles.noticeWarn]} testID="profile_notice">
                <AlertCircle color={hasAnyError ? colors.dark.error : colors.dark.warning} size={18} />
                <Text style={styles.noticeText} numberOfLines={2}>
                  {hasAnyError
                    ? 'Could not load some profile data. Pull to refresh.'
                    : 'Profile not fully synced yet. Pull to refresh.'}
                </Text>
                <TouchableOpacity onPress={handleForceSync} style={styles.noticeBtn} testID="profile_notice_retry">
                  <Text style={styles.noticeBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.primaryActions}>
              <TouchableOpacity 
                style={styles.primaryBtn} 
                activeOpacity={0.9} 
                testID="profile_edit_btn"
                onPress={() => router.push('/edit-profile')}
              >
                <Text style={styles.primaryBtnText}>Edit profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.9} testID="profile_share_btn">
                <Text style={styles.secondaryBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.tabBar} testID="profile_tabs">
          <View style={styles.tabRow}>
            <TouchableOpacity
              onPress={() => setTab('grid')}
              style={[styles.tabBtn, activeTab === 'grid' && styles.tabBtnActive]}
              testID="profile_tab_grid"
            >
              <Grid color={activeTab === 'grid' ? colors.dark.text : colors.dark.textSecondary} size={18} />
              <Text style={[styles.tabText, activeTab === 'grid' && styles.tabTextActive]}>Posts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTab('saved')}
              style={[styles.tabBtn, activeTab === 'saved' && styles.tabBtnActive]}
              testID="profile_tab_saved"
            >
              <Bookmark color={activeTab === 'saved' ? colors.dark.text : colors.dark.textSecondary} size={18} />
              <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>Saved</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTab('marketplace')}
              style={[styles.tabBtn, activeTab === 'marketplace' && styles.tabBtnActive]}
              testID="profile_tab_marketplace"
            >
              <ShoppingBag color={activeTab === 'marketplace' ? colors.dark.text : colors.dark.textSecondary} size={18} />
              <Text style={[styles.tabText, activeTab === 'marketplace' && styles.tabTextActive]}>Market</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabIndicatorTrack}>
            <Animated.View style={[styles.tabIndicatorThreeTabs, { transform: [{ translateX: indicatorTranslateX }] }]} />
          </View>
        </View>

        {activeTab === 'marketplace' ? (
          marketplaceLoading ? (
            <View style={styles.center} testID="profile_marketplace_loading">
              <ActivityIndicator color={colors.dark.text} />
            </View>
          ) : marketplaceProducts.length === 0 ? (
            <View style={styles.emptyWrap} testID="profile_marketplace_empty">
              <ShoppingBag color={colors.dark.textSecondary} size={48} />
              <Text style={styles.emptyTitle}>No products yet</Text>
              <Text style={styles.emptySub}>Your marketplace listings will appear here.</Text>
            </View>
          ) : (
            <View style={styles.marketplaceGrid} testID="profile_marketplace_grid">
              {marketplaceProducts.map((product) => (
                <TouchableOpacity key={product.id} style={styles.productCard} activeOpacity={0.9}>
                  {product.images && product.images.length > 0 ? (
                    <Image source={{ uri: product.images[0] }} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, styles.productImagePlaceholder]}>
                      <ShoppingBag color={colors.dark.textSecondary} size={32} />
                    </View>
                  )}
                  <View style={styles.productInfo}>
                    <Text style={styles.productTitle} numberOfLines={2}>
                      {product.title}
                    </Text>
                    <Text style={styles.productPrice}>
                      {product.currency} {product.price.toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : activeTab === 'saved' ? (
          <View style={styles.emptyWrap} testID="profile_saved_placeholder">
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptySub}>Bookmark posts to keep them here.</Text>
          </View>
        ) : isLoading ? (
          <View style={styles.center} testID="profile_grid_loading">
            <ActivityIndicator color={colors.dark.text} />
          </View>
        ) : gridPosts.length === 0 ? (
          <View style={styles.emptyWrap} testID="profile_posts_empty">
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptySub}>Your photo posts will show up here.</Text>
          </View>
        ) : (
          <View style={styles.grid} testID="profile_posts_grid">
            {gridPosts.map(({ post, url, hasMedia }) => {
              if (hasMedia && url) {
                return (
                  <TouchableOpacity key={post.id} style={styles.gridItem} activeOpacity={0.9} testID={`profile_post_${post.id}`}>
                    <Image 
                      source={{ uri: url }} 
                      style={styles.gridImg}
                      onError={(error) => {
                        console.error('[Profile] Image load error for post', post.id, ':', error.nativeEvent.error);
                        console.error('[Profile] Failed image URL:', url);
                      }}
                      onLoad={() => {
                        console.log('[Profile] Image loaded successfully for post', post.id);
                      }}
                    />
                  </TouchableOpacity>
                );
              } else {
                const textContent = post.content || '';
                return (
                  <TouchableOpacity key={post.id} style={[styles.gridItem, styles.textPostItem]} activeOpacity={0.9} testID={`profile_post_${post.id}`}>
                    <Text style={styles.textPostContent} numberOfLines={6}>
                      {textContent}
                    </Text>
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
  topBarTitleWrap: {
    flex: 1,
    marginRight: 8,
  },
  topBarTitle: {
    color: colors.dark.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconBtnWarning: {
    backgroundColor: 'rgba(255,214,10,0.08)',
    borderColor: 'rgba(255,214,10,0.20)',
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
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metaText: {
    color: colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
    maxWidth: 240,
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
  notice: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
  },
  noticeWarn: {
    backgroundColor: 'rgba(255,214,10,0.08)',
    borderColor: 'rgba(255,214,10,0.18)',
  },
  noticeError: {
    backgroundColor: 'rgba(255,69,58,0.08)',
    borderColor: 'rgba(255,69,58,0.22)',
  },
  noticeText: {
    flex: 1,
    color: colors.dark.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  noticeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  noticeBtnText: {
    color: colors.dark.text,
    fontSize: 12,
    fontWeight: '800' as const,
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
  primaryBtnText: {
    color: colors.dark.background,
    fontSize: 14,
    fontWeight: '900' as const,
    letterSpacing: 0.2,
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
  tabIndicatorThreeTabs: {
    width: (width - 32) / 3,
    height: 3,
    backgroundColor: colors.dark.accent,
    borderRadius: 999,
  },
  marketplaceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  productCard: {
    width: '48%',
    backgroundColor: colors.dark.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  productImage: {
    width: '100%',
    height: 160,
    backgroundColor: colors.dark.surface,
  },
  productImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    padding: 12,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.dark.text,
    marginBottom: 8,
    lineHeight: 18,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.dark.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: 1,
    paddingBottom: 20,
  },
  gridItem: {
    width: GRID_ITEM,
    height: GRID_ITEM,
    backgroundColor: colors.dark.card,
    overflow: 'hidden',
    borderRadius: 10,
  },
  gridImg: {
    width: '100%',
    height: '100%',
  },
  textPostItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    justifyContent: 'center',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  textPostContent: {
    color: colors.dark.text,
    fontSize: 12,
    lineHeight: 16,
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
});
