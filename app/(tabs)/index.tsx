import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Animated,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, MessageCircle, Share2, MoreHorizontal, Eye, X, Play, Bell, Bookmark, Send, CornerDownRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

import colors from '@/constants/colors';
import { useTimelineApi, useStoriesApi, useLikePost, useCurrentUserProfile, useUnreadNotificationCount, useCreateComment, usePostCommentsApi, useLikeComment } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import type { Story, Post } from '@/types';
import VerifiedBadge from '@/components/VerifiedBadge';
import { FREQUENTLY_USED_EMOJIS, EMOJI_CATEGORIES, getEmojiByUnified, type Emoji } from '@/constants/emojis';

const { width } = Dimensions.get('window');

function AnimatedStoryItem({ story, index }: { story: Story; index: number }) {
  const router = useRouter();
  const user = story.relations.user;
  const username = user.name || 'user';
  let avatar = user.avatar_url || `https://i.pravatar.cc/150?u=${story.story_uuid}`;
  if (avatar && !avatar.startsWith('http://') && !avatar.startsWith('https://')) {
    avatar = `https://uservault.net${avatar.startsWith('/') ? '' : '/'}${avatar}`;
  }

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.92,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    router.push(`/story-viewer?storyUuid=${story.story_uuid}`);
  };

  return (
    <Animated.View style={{ 
      opacity: fadeAnim, 
      transform: [{ scale: scaleAnim }] 
    }}>
      <TouchableOpacity 
        style={styles.storyItem} 
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Animated.View style={{ transform: [{ scale: pressScale }] }}>
          <LinearGradient
            colors={story.is_seen ? ['#3A3A3A', '#2A2A2A'] : ['#FF6B6B', '#FF8E53', '#FFBA5A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.storyGradientBorder}
          >
            <View style={styles.storyImageWrapper}>
              <Image source={{ uri: avatar }} style={styles.storyAvatar} cachePolicy="memory-disk" />
            </View>
          </LinearGradient>
        </Animated.View>
        <Text style={styles.storyUsername} numberOfLines={1}>
          {username}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

interface CommentUser {
  id: number;
  username: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  verified?: boolean;
}

interface CommentData {
  id: number;
  content: string;
  user?: CommentUser;
  relations?: {
    user?: CommentUser;
  };
  likes_count?: number | { raw?: number; formatted?: string };
  liked?: boolean;
  replies?: CommentData[];
  children?: CommentData[];
  created_at?: string;
  date?: { time_ago?: string };
  parent_id?: number;
}

function AnimatedPostItem({ post, index }: { post: Post; index: number }) {
  const [showReactionPicker, setShowReactionPicker] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [imageLoading, setImageLoading] = useState<boolean>(true);
  const [showFullscreenVideo, setShowFullscreenVideo] = useState<boolean>(false);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [showComments, setShowComments] = useState<boolean>(false);
  const [localComments, setLocalComments] = useState<CommentData[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<CommentData | null>(null);
  const [activePostHashId, setActivePostHashId] = useState<string | null>(null);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const bookmarkScale = useRef(new Animated.Value(1)).current;
  const fullscreenVideoRef = useRef<Video>(null);
  const likeMutation = useLikePost();
  const createCommentMutation = useCreateComment();
  const likeCommentMutation = useLikeComment();
  const router = useRouter();
  const { currentUser } = useAuth();
  
  const { data: commentsData, isLoading: commentsLoading, refetch: refetchComments } = usePostCommentsApi(
    activePostHashId
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const user = post.relations.user;
  const username = user.username || 'unknown';
  const displayName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : username;
  let avatar = user.avatar_url || `https://i.pravatar.cc/150?u=${post.id}`;
  if (avatar && !avatar.startsWith('http://') && !avatar.startsWith('https://')) {
    avatar = `https://uservault.net${avatar.startsWith('/') ? '' : '/'}${avatar}`;
  }

  const reactions = post.relations.reactions || [];
  
  const reactionCounts = reactions.reduce((acc: Record<string, { emoji: string; count: number }>, reaction: any, idx: number) => {
    const unifiedId = reaction.unified_id || `fallback-${idx}`;
    const emojiData = getEmojiByUnified(unifiedId);
    const emojiChar = emojiData?.emoji || '❤️';
    
    if (!acc[unifiedId]) {
      acc[unifiedId] = { emoji: emojiChar, count: 0 };
    }
    acc[unifiedId].count += 1;
    return acc;
  }, {} as Record<string, { emoji: string; count: number }>);

  const handleReactionPress = () => {
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.4,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
    setShowReactionPicker(true);
  };

  const handleBookmarkPress = () => {
    setIsBookmarked(!isBookmarked);
    Animated.sequence([
      Animated.timing(bookmarkScale, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(bookmarkScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSelectReaction = (emojiData: Emoji) => {
    setShowReactionPicker(false);
    likeMutation.mutate({ postId: post.id, unifiedId: emojiData.unified });
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

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
  const videoUrl = isVideo ? mediaUrl : null;

  const handleVideoPress = useCallback(() => {
    setShowFullscreenVideo(true);
  }, []);

  const handleCloseFullscreen = useCallback(async () => {
    if (fullscreenVideoRef.current) {
      await fullscreenVideoRef.current.pauseAsync();
    }
    setShowFullscreenVideo(false);
  }, []);

  const handleOpenComments = useCallback(() => {
    setShowComments(true);
    setActivePostHashId(post.hash_id);
    setLocalComments([]);
  }, [post.hash_id]);

  const handleLikeComment = useCallback((commentId: number) => {
    likeCommentMutation.mutate({ commentId });
  }, [likeCommentMutation]);

  const handleReply = useCallback((comment: CommentData) => {
    setReplyingTo(comment);
  }, []);

  const handleSendComment = useCallback(() => {
    if (!newComment.trim()) return;
    
    const newCommentData: CommentData = {
      id: Date.now(),
      content: newComment,
      user: {
        id: currentUser?.id || 0,
        username: currentUser?.username || 'me',
        name: currentUser?.name || 'Me',
        avatar_url: currentUser?.avatar || 'https://i.pravatar.cc/150?u=me',
      },
      likes_count: 0,
      liked: false,
      replies: [],
      created_at: 'Just now',
      parent_id: replyingTo?.id,
    };

    setLocalComments(prev => [newCommentData, ...prev]);

    createCommentMutation.mutate({
      postId: post.id,
      content: newComment,
      parentId: replyingTo?.id,
    }, {
      onSuccess: () => {
        refetchComments();
      }
    });

    setNewComment('');
    setReplyingTo(null);
  }, [newComment, replyingTo, currentUser, post.id, createCommentMutation, refetchComments]);

  const getCommentUser = useCallback((comment: CommentData): CommentUser => {
    const u = comment.user || comment.relations?.user;
    return {
      id: u?.id || 0,
      username: u?.username || 'user',
      name: u?.name || (u?.first_name && u?.last_name ? `${u.first_name} ${u.last_name}` : u?.first_name) || u?.username || 'User',
      avatar_url: u?.avatar_url,
      verified: u?.verified,
    };
  }, []);

  const getCommentLikesCount = useCallback((comment: CommentData): number => {
    if (typeof comment.likes_count === 'number') return comment.likes_count;
    if (typeof comment.likes_count === 'object' && comment.likes_count?.raw !== undefined) {
      return comment.likes_count.raw;
    }
    return 0;
  }, []);

  const getCommentTime = useCallback((comment: CommentData): string => {
    return comment.date?.time_ago || comment.created_at || '';
  }, []);

  const getCommentReplies = useCallback((comment: CommentData): CommentData[] => {
    return comment.replies || comment.children || [];
  }, []);

  const normalizeAvatarUrl = useCallback((url?: string): string => {
    if (!url) return 'https://i.pravatar.cc/150?u=default';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://uservault.net${url.startsWith('/') ? '' : '/'}${url}`;
  }, []);

  const handleNavigateToProfile = useCallback((username: string) => {
    setShowComments(false);
    router.push(`/user/${username}`);
  }, [router]);

  const renderComment = useCallback((comment: CommentData, isReply: boolean = false) => {
    const commentUser = getCommentUser(comment);
    const likesCount = getCommentLikesCount(comment);
    const timeAgo = getCommentTime(comment);
    const replies = getCommentReplies(comment);
    const avatarUrl = normalizeAvatarUrl(commentUser.avatar_url);

    return (
      <View key={comment.id} style={[styles.commentItem, isReply && styles.replyItem]}>
        <TouchableOpacity onPress={() => handleNavigateToProfile(commentUser.username)}>
          <Image source={{ uri: avatarUrl }} style={styles.commentAvatar} cachePolicy="memory-disk" />
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <TouchableOpacity onPress={() => handleNavigateToProfile(commentUser.username)}>
              <Text style={styles.commentUsername}>{commentUser.name}</Text>
            </TouchableOpacity>
            {commentUser.verified && <VerifiedBadge size={12} />}
            <Text style={styles.commentTime}>{timeAgo}</Text>
          </View>
          <Text style={styles.commentText}>{comment.content}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity 
              style={styles.commentActionButton}
              onPress={() => handleLikeComment(comment.id)}
            >
              <Heart 
                size={16} 
                color={comment.liked ? '#FF6B6B' : colors.dark.textSecondary}
                fill={comment.liked ? '#FF6B6B' : 'none'}
              />
              <Text style={[styles.commentActionText, comment.liked && styles.commentActionTextActive]}>
                {likesCount}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.commentActionButton}
              onPress={() => handleReply(comment)}
            >
              <CornerDownRight size={16} color={colors.dark.textSecondary} />
              <Text style={styles.commentActionText}>Reply</Text>
            </TouchableOpacity>
          </View>
          {replies.map(reply => renderComment(reply, true))}
        </View>
      </View>
    );
  }, [handleLikeComment, handleReply, getCommentUser, getCommentLikesCount, getCommentTime, getCommentReplies, normalizeAvatarUrl, handleNavigateToProfile]);

  return (
    <Animated.View style={[
      styles.post,
      {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }
    ]}>
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.postUser} onPress={() => {
          router.push(`/user/${user.username || user.id}`);
        }}>
          <View style={styles.avatarGlow}>
            <Image source={{ uri: avatar }} style={styles.postAvatar} cachePolicy="memory-disk" />
          </View>
          <View>
            <View style={styles.usernameRow}>
              <Text style={styles.postUsername}>{displayName}</Text>
              {user.verified && <VerifiedBadge size={16} />}
            </View>
            <Text style={styles.postTimestamp}>{post.date.time_ago}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreButton}>
          <MoreHorizontal color={colors.dark.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      {post.content && (
        <Text style={styles.postContent}>{post.content}</Text>
      )}

      {postMedia && isVideo && videoUrl ? (
        <TouchableOpacity 
          style={styles.videoContainer}
          onPress={handleVideoPress}
          activeOpacity={0.95}
        >
          <Image
            source={{ uri: thumbnailUrl || videoUrl }}
            style={styles.postImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View style={styles.videoOverlay}>
            <View style={styles.playButtonCircle}>
              <Play color="#FFF" size={28} fill="#FFF" />
            </View>
          </View>
        </TouchableOpacity>
      ) : postImage ? (
        <View style={styles.imageWrapper}>
          <Image 
            source={{ uri: postImage }} 
            style={styles.postImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
            onLoadStart={() => {
              setImageLoading(true);
              setImageError(false);
            }}
            onLoad={() => {
              setImageLoading(false);
              setImageError(false);
            }}
          />
          {imageLoading && !imageError && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="large" color={colors.dark.accent} />
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.postFooter}>
        <View style={styles.postActions}>
          <View style={styles.leftActions}>
            <TouchableOpacity onPress={handleReactionPress} style={styles.actionButton}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Heart 
                  color={Object.keys(reactionCounts).length > 0 ? '#FF6B6B' : colors.dark.text} 
                  size={24} 
                  fill={Object.keys(reactionCounts).length > 0 ? '#FF6B6B' : 'none'}
                />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleOpenComments}>
              <MessageCircle color={colors.dark.text} size={24} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Share2 color={colors.dark.text} size={22} />
            </TouchableOpacity>
          </View>
          <View style={styles.rightActions}>
            <View style={styles.viewCount}>
              <Eye color={colors.dark.textSecondary} size={16} />
              <Text style={styles.viewCountText}>{post.views_count.formatted}</Text>
            </View>
            <TouchableOpacity onPress={handleBookmarkPress} style={styles.actionButton}>
              <Animated.View style={{ transform: [{ scale: bookmarkScale }] }}>
                <Bookmark 
                  color={isBookmarked ? colors.dark.accent : colors.dark.text} 
                  size={22}
                  fill={isBookmarked ? colors.dark.accent : 'none'}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {Object.keys(reactionCounts).length > 0 && (
          <View style={styles.reactionsBar}>
            {Object.entries(reactionCounts).map(([unifiedId, data]) => (
              <View key={unifiedId} style={styles.reactionBadge}>
                <Text style={styles.reactionEmoji}>{data.emoji}</Text>
                <Text style={styles.reactionCount}>{data.count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Modal
        visible={showFullscreenVideo}
        transparent={false}
        animationType="fade"
        onRequestClose={handleCloseFullscreen}
        statusBarTranslucent
      >
        <View style={styles.fullscreenVideoContainer}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={handleCloseFullscreen}
          >
            <X color={colors.dark.text} size={28} />
          </TouchableOpacity>
          {videoUrl && (
            <Video
              ref={fullscreenVideoRef}
              source={{ uri: videoUrl }}
              style={styles.fullscreenVideo}
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              shouldPlay={true}
              useNativeControls={true}
              onError={() => {}}
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={showComments}
        transparent
        animationType="slide"
        onRequestClose={() => setShowComments(false)}
      >
        <KeyboardAvoidingView 
          style={styles.commentsModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.commentsOverlay} onPress={() => setShowComments(false)} />
          <View style={styles.commentsSheet}>
            <View style={styles.commentsSheetHandle} />
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <X color={colors.dark.text} size={24} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.commentsList} showsVerticalScrollIndicator={false}>
              {commentsLoading ? (
                <View style={styles.commentsLoading}>
                  <ActivityIndicator color={colors.dark.accent} />
                </View>
              ) : (() => {
                const apiComments: CommentData[] = commentsData?.data || [];
                const allComments = [...localComments, ...apiComments];
                
                if (allComments.length === 0) {
                  return (
                    <View style={styles.noComments}>
                      <Text style={styles.noCommentsText}>No comments yet</Text>
                      <Text style={styles.noCommentsSubtext}>Be the first to comment!</Text>
                    </View>
                  );
                }
                
                return allComments.map(comment => renderComment(comment));
              })()}
            </ScrollView>

            <View style={styles.commentInputContainer}>
              {replyingTo && (
                <View style={styles.replyingToBar}>
                  <Text style={styles.replyingToText}>Replying to @{replyingTo.user?.username || replyingTo.relations?.user?.username || 'user'}</Text>
                  <TouchableOpacity onPress={() => setReplyingTo(null)}>
                    <X size={16} color={colors.dark.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.commentInputRow}>
                <Image 
                  source={{ uri: currentUser?.avatar || 'https://i.pravatar.cc/150?u=me' }} 
                  style={styles.commentInputAvatar}
                />
                <TextInput
                  style={styles.commentInput}
                  placeholder={replyingTo ? `Reply to @${replyingTo.user?.username || replyingTo.relations?.user?.username || 'user'}...` : 'Add a comment...'}
                  placeholderTextColor={colors.dark.textSecondary}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity 
                  style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
                  onPress={handleSendComment}
                  disabled={!newComment.trim()}
                >
                  <Send size={20} color={newComment.trim() ? colors.dark.accent : colors.dark.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showReactionPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReactionPicker(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowReactionPicker(false)}
        >
          <Pressable style={styles.emojiPickerModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.emojiPickerHeader}>
              <Text style={styles.emojiPickerTitle}>React</Text>
            </View>
            
            <ScrollView style={styles.emojiPickerContent} showsVerticalScrollIndicator={false}>
              <View style={styles.quickReactions}>
                {FREQUENTLY_USED_EMOJIS.slice(0, 6).map((emojiData) => (
                  <TouchableOpacity
                    key={emojiData.unified}
                    style={styles.quickReactionButton}
                    onPress={() => handleSelectReaction(emojiData)}
                  >
                    <Text style={styles.quickReactionEmoji}>{emojiData.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.emojiSection}>
                <Text style={styles.emojiSectionTitle}>Smileys</Text>
                <View style={styles.emojiGrid}>
                  {EMOJI_CATEGORIES.smileys.map((emojiData) => (
                    <TouchableOpacity
                      key={emojiData.unified}
                      style={styles.emojiButton}
                      onPress={() => handleSelectReaction(emojiData)}
                    >
                      <Text style={styles.emojiButtonText}>{emojiData.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.emojiSection}>
                <Text style={styles.emojiSectionTitle}>Hearts</Text>
                <View style={styles.emojiGrid}>
                  {EMOJI_CATEGORIES.hearts.map((emojiData) => (
                    <TouchableOpacity
                      key={emojiData.unified}
                      style={styles.emojiButton}
                      onPress={() => handleSelectReaction(emojiData)}
                    >
                      <Text style={styles.emojiButtonText}>{emojiData.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.emojiSection}>
                <Text style={styles.emojiSectionTitle}>Gestures</Text>
                <View style={styles.emojiGrid}>
                  {EMOJI_CATEGORIES.gestures.map((emojiData) => (
                    <TouchableOpacity
                      key={emojiData.unified}
                      style={styles.emojiButton}
                      onPress={() => handleSelectReaction(emojiData)}
                    >
                      <Text style={styles.emojiButtonText}>{emojiData.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { data: postsData, isLoading: postsLoading, refetch: refetchPosts } = useTimelineApi();
  const { data: storiesData, isLoading: storiesLoading, refetch: refetchStories } = useStoriesApi();
  const { refetch: refetchProfile } = useCurrentUserProfile();
  const { data: unreadCountData } = useUnreadNotificationCount();
  const { currentUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const unreadCount = unreadCountData?.data?.raw || 0;
  const hasUnread = unreadCount > 0;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchPosts(),
        refetchStories(),
        refetchProfile(),
      ]);
    } catch (e) {
      console.error('[Home] Refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const posts = postsData?.data || [];
  const stories = storiesData?.data || [];

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <Animated.Text style={[styles.headerTitle, { transform: [{ scale: logoScale }] }]}>
            USERVAULT
          </Animated.Text>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => router.push('/notifications')}
          >
            <Bell color={colors.dark.text} size={24} />
            {hasUnread && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor={colors.dark.accent}
              progressBackgroundColor={colors.dark.card}
            />
          }
        >
          <View style={styles.storiesSection}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storiesContent}
            >
              <TouchableOpacity style={styles.storyItem} onPress={() => router.push('/create-story')}>
                <LinearGradient
                  colors={[colors.dark.card, colors.dark.surface]}
                  style={styles.addStoryGradient}
                >
                  <Image 
                    source={{ uri: currentUser?.avatar || 'https://i.pravatar.cc/150' }} 
                    style={styles.addStoryAvatar}
                    cachePolicy="memory-disk"
                  />
                  <View style={styles.addStoryButton}>
                    <Text style={styles.addStoryText}>+</Text>
                  </View>
                </LinearGradient>
                <Text style={styles.storyUsername}>Your Story</Text>
              </TouchableOpacity>
              {storiesLoading ? (
                <View style={styles.storiesLoading}>
                  <ActivityIndicator color={colors.dark.accent} />
                </View>
              ) : (
                stories.map((story: Story, index: number) => (
                  <AnimatedStoryItem key={story.story_uuid} story={story} index={index} />
                ))
              )}
            </ScrollView>
          </View>

          <View style={styles.postsSection}>
            {postsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.dark.accent} />
                <Text style={styles.loadingText}>Loading feed...</Text>
              </View>
            ) : posts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyText}>No posts yet</Text>
                <Text style={styles.emptySubtext}>Follow people to see their posts</Text>
              </View>
            ) : (
              posts.map((post: Post, index: number) => (
                <AnimatedPostItem key={post.id} post={post} index={index} />
              ))
            )}
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: colors.dark.text,
    letterSpacing: 2,
  },
  notificationButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark.card,
    borderRadius: 22,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  content: {
    flex: 1,
  },
  storiesSection: {
    paddingVertical: 16,
  },
  storiesContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  storiesLoading: {
    width: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyItem: {
    alignItems: 'center',
    width: 76,
  },
  storyGradientBorder: {
    padding: 3,
    borderRadius: 40,
  },
  storyImageWrapper: {
    padding: 2,
    backgroundColor: colors.dark.background,
    borderRadius: 35,
  },
  storyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  addStoryGradient: {
    padding: 3,
    borderRadius: 40,
    position: 'relative',
  },
  addStoryAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.dark.background,
  },
  addStoryButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.dark.accent,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.dark.background,
  },
  addStoryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700' as const,
    lineHeight: 16,
  },
  storyUsername: {
    fontSize: 11,
    color: colors.dark.textSecondary,
    marginTop: 8,
    fontWeight: '500' as const,
  },
  postsSection: {
    paddingTop: 8,
  },
  post: {
    marginBottom: 24,
    marginHorizontal: 16,
    backgroundColor: colors.dark.card,
    borderRadius: 20,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  postUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarGlow: {
    borderRadius: 22,
    padding: 2,
  },
  postAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postUsername: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  postTimestamp: {
    fontSize: 12,
    color: colors.dark.textSecondary,
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  postContent: {
    fontSize: 15,
    color: colors.dark.text,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.dark.surface,
    position: 'relative' as const,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  imageLoadingOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    position: 'relative' as const,
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.dark.surface,
  },
  videoOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  fullscreenVideoContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute' as const,
    top: 60,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postFooter: {
    padding: 14,
    gap: 12,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    padding: 4,
  },
  viewCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewCountText: {
    fontSize: 13,
    color: colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
  reactionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  emojiPickerModal: {
    backgroundColor: colors.dark.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.dark.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  emojiPickerHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emojiPickerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.dark.text,
  },
  quickReactions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  quickReactionButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark.surface,
    borderRadius: 25,
  },
  quickReactionEmoji: {
    fontSize: 28,
  },
  emojiPickerContent: {
    paddingHorizontal: 20,
  },
  emojiSection: {
    marginTop: 20,
  },
  emojiSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.dark.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.dark.surface,
  },
  emojiButtonText: {
    fontSize: 26,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.dark.textSecondary,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
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
  commentsModalContainer: {
    flex: 1,
  },
  commentsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  commentsSheet: {
    backgroundColor: colors.dark.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  commentsSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.dark.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.dark.text,
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  commentsLoading: {
    padding: 40,
    alignItems: 'center',
  },
  noComments: {
    padding: 40,
    alignItems: 'center',
  },
  noCommentsText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    marginTop: 4,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 12,
  },
  replyItem: {
    marginLeft: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.dark.border,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  commentTime: {
    fontSize: 12,
    color: colors.dark.textSecondary,
  },
  commentText: {
    fontSize: 14,
    color: colors.dark.text,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    color: colors.dark.textSecondary,
  },
  commentActionTextActive: {
    color: '#FF6B6B',
  },
  commentInputContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
    paddingBottom: 34,
  },
  replyingToBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.dark.surface,
  },
  replyingToText: {
    fontSize: 13,
    color: colors.dark.textSecondary,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentInput: {
    flex: 1,
    fontSize: 15,
    color: colors.dark.text,
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.dark.surface,
    borderRadius: 20,
  },
  sendButton: {
    padding: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
