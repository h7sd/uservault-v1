import React, { useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  ActivityIndicator,
  RefreshControl,
  Animated,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, Search, Edit3, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import colors from '@/constants/colors';
import { useMessengerChats } from '@/hooks/useApi';
import type { Chat } from '@/types';

function AnimatedChatItem({ chat, index }: { chat: Chat; index: number }) {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const chatInfo = chat.chat_info;
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (!chatInfo) {
    return null;
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Now';
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  const isGroupChat = chatInfo.is_group || chat.type === 'group' || (chatInfo.members_count && chatInfo.members_count > 2);
  
  const otherUserAvatar = chatInfo.avatar_url || 'https://i.pravatar.cc/150';
  const fullAvatar = otherUserAvatar?.startsWith('http') 
    ? otherUserAvatar 
    : `https://uservault.net${otherUserAvatar?.startsWith('/') ? '' : '/'}${otherUserAvatar}`;
  
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    const chatIdValue = chat.chat_id || chat.id;
    
    if (isGroupChat) {
      router.push(`/group-chat/${chatIdValue}` as any);
    } else if (chatInfo.username) {
      router.push(`/chat/${chatInfo.username}`);
    } else if (chatInfo.id) {
      router.push(`/chat/${chatInfo.id}`);
    } else {
      router.push(`/group-chat/${chatIdValue}` as any);
    }
  };

  const lastMessage = chat.last_message || chat.messages?.[0];
  const displayName = isGroupChat 
    ? (chatInfo.name || `Group (${chatInfo.members_count || 0})`) 
    : (chatInfo.name || chatInfo.username || 'User');
  
  const hasUnread = chat.unread_count > 0;

  return (
    <Animated.View style={[
      { 
        opacity: fadeAnim, 
        transform: [{ translateX: slideAnim }, { scale: scaleAnim }] 
      }
    ]}>
      <TouchableOpacity 
        style={[styles.chatItem, hasUnread && styles.chatItemUnread]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: fullAvatar }} 
            style={styles.chatAvatar} 
          />
          {isGroupChat && (
            <View style={styles.groupBadge}>
              <Text style={styles.groupBadgeText}>{chatInfo.members_count || '+'}</Text>
            </View>
          )}
          {hasUnread && <View style={styles.onlineIndicator} />}
        </View>
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatName, hasUnread && styles.chatNameUnread]} numberOfLines={1}>
              {displayName}
            </Text>
            {lastMessage && (
              <Text style={[styles.chatTime, hasUnread && styles.chatTimeUnread]}>
                {formatTime(lastMessage.created_at)}
              </Text>
            )}
          </View>
          {lastMessage && (
            <View style={styles.messageRow}>
              <Text style={[styles.chatMessage, hasUnread && styles.chatMessageUnread]} numberOfLines={1}>
                {lastMessage.content}
              </Text>
              {hasUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {chat.unread_count > 9 ? '9+' : chat.unread_count}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        
        <ChevronRight color={colors.dark.textSecondary} size={18} style={{ opacity: 0.5 }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MessagesScreen() {
  const { data: chatsData, isLoading, refetch } = useMessengerChats();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const searchBarScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(headerOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const chats = chatsData?.data || [];
  
  const filteredChats = searchQuery.length > 0 
    ? chats.filter((chat: Chat) => {
        const name = chat.chat_info?.name?.toLowerCase() || '';
        const username = chat.chat_info?.username?.toLowerCase() || '';
        const query = searchQuery.toLowerCase();
        return name.includes(query) || username.includes(query);
      })
    : chats;
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [refetch]);

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

  const totalUnread = chats.reduce((acc: number, chat: Chat) => acc + (chat.unread_count || 0), 0);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Messages</Text>
              {totalUnread > 0 && (
                <Text style={styles.headerSubtitle}>{totalUnread} unread</Text>
              )}
            </View>
            <TouchableOpacity style={styles.composeButton}>
              <Edit3 color={colors.dark.text} size={20} />
            </TouchableOpacity>
          </View>

          <Animated.View style={[
            styles.searchBar,
            isSearchFocused && styles.searchBarFocused,
            { transform: [{ scale: searchBarScale }] }
          ]}>
            <Search color={isSearchFocused ? colors.dark.accent : colors.dark.textSecondary} size={18} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor={colors.dark.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
            />
          </Animated.View>
        </Animated.View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={isLoading} 
              onRefresh={() => refetch()}
              tintColor={colors.dark.accent}
            />
          }
        >
          {isLoading && chats.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.dark.accent} />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : filteredChats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <LinearGradient
                colors={[colors.dark.card, colors.dark.surface]}
                style={styles.emptyIconContainer}
              >
                <MessageCircle color={colors.dark.textSecondary} size={48} />
              </LinearGradient>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No conversations found' : 'No messages yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery ? 'Try a different search' : 'Start a conversation with someone'}
              </Text>
            </View>
          ) : (
            <View style={styles.chatsList}>
              {filteredChats.map((chat: Chat, index: number) => (
                <AnimatedChatItem key={chat.id || `chat-${index}`} chat={chat} index={index} />
              ))}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.dark.accent,
    marginTop: 2,
    fontWeight: '500' as const,
  },
  composeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchBarFocused: {
    borderColor: colors.dark.accent,
    backgroundColor: colors.dark.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.dark.text,
  },
  content: {
    flex: 1,
  },
  chatsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: colors.dark.card,
    borderRadius: 16,
  },
  chatItemUnread: {
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.2)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  chatAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  groupBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.dark.accent,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.dark.card,
  },
  groupBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  onlineIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.dark.accent,
    borderWidth: 3,
    borderColor: colors.dark.card,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.dark.text,
    flex: 1,
    marginRight: 8,
  },
  chatNameUnread: {
    fontWeight: '700' as const,
  },
  chatTime: {
    fontSize: 12,
    color: colors.dark.textSecondary,
  },
  chatTimeUnread: {
    color: colors.dark.accent,
    fontWeight: '600' as const,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatMessage: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  chatMessageUnread: {
    color: colors.dark.text,
    fontWeight: '500' as const,
  },
  unreadBadge: {
    backgroundColor: colors.dark.accent,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFF',
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
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
    textAlign: 'center',
  },
});
