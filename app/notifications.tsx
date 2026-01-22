import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Heart, MessageCircle, UserPlus, X } from 'lucide-react-native';
import colors from '@/constants/colors';
import { useNotificationsApi, useDeleteNotification } from '@/hooks/useApi';
import VerifiedBadge from '@/components/VerifiedBadge';

interface Notification {
  id: string;
  message: string;
  type: string;
  actor: {
    id: number;
    name: string;
    username: string;
    avatar_url?: string;
    verified: boolean;
  };
  entity?: {
    id: number;
    type: string;
    hash_id?: string;
  };
  is_read: boolean;
  metadata?: {
    reaction_unified_id?: string;
    reaction_image_url?: string;
  };
  date: {
    time_ago: string;
    timestamp: number;
  };
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'new_follower':
    case 'follow_request':
    case 'follow_accept':
      return <UserPlus color={colors.dark.accent} size={20} />;
    case 'post_reacted':
    case 'comment_reacted':
      return <Heart color="#EF4444" size={20} fill="#EF4444" />;
    case 'post_commented':
    case 'comment_mention':
      return <MessageCircle color={colors.dark.accent} size={20} />;
    default:
      return <Heart color={colors.dark.accent} size={20} />;
  }
}

function NotificationItem({ notification, onDelete }: { notification: Notification; onDelete: (id: string) => void }) {
  const router = useRouter();
  
  const normalizeUrl = (url: string | undefined): string => {
    if (!url) return 'https://i.pravatar.cc/150';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `https://uservault.net${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const avatarUrl = normalizeUrl(notification.actor.avatar_url);

  const handlePress = () => {
    if (notification.type.includes('follow')) {
      router.push(`/user/${notification.actor.username}`);
    } else if (notification.entity?.hash_id) {
      router.push(`/modal?postId=${notification.entity.hash_id}`);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.notificationItem, !notification.is_read && styles.notificationItemUnread]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.notificationAvatar}>
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        <View style={styles.notificationIconBadge}>
          <NotificationIcon type={notification.type} />
        </View>
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View style={styles.notificationUser}>
            <Text style={styles.notificationUserName}>{notification.actor.name}</Text>
            {notification.actor.verified && <VerifiedBadge size={14} />}
          </View>
          <Text style={styles.notificationTime}>{notification.date.time_ago}</Text>
        </View>
        <Text style={styles.notificationMessage}>{notification.message}</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
      >
        <X color={colors.dark.textSecondary} size={18} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<'all' | 'mentions' | 'important'>('all');
  const { data: notificationsData, isLoading, refetch } = useNotificationsApi(selectedTab);
  const deleteMutation = useDeleteNotification();
  const [refreshing, setRefreshing] = useState(false);

  const notifications = notificationsData?.data || [];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (e) {
      console.error('[Notifications] Refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = (notificationId: string) => {
    deleteMutation.mutate(notificationId);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={colors.dark.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'all' && styles.tabActive]}
          onPress={() => setSelectedTab('all')}
        >
          <Text style={[styles.tabText, selectedTab === 'all' && styles.tabTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'mentions' && styles.tabActive]}
          onPress={() => setSelectedTab('mentions')}
        >
          <Text style={[styles.tabText, selectedTab === 'mentions' && styles.tabTextActive]}>
            Mentions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'important' && styles.tabActive]}
          onPress={() => setSelectedTab('important')}
        >
          <Text style={[styles.tabText, selectedTab === 'important' && styles.tabTextActive]}>
            Important
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.dark.text} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.dark.text} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        ) : (
          notifications.map((notification: Notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onDelete={handleDelete}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.dark.text,
  },
  headerSpacer: {
    width: 44,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.dark.accent,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.dark.textSecondary,
  },
  tabTextActive: {
    color: colors.dark.text,
  },
  content: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.dark.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
    gap: 12,
  },
  notificationItemUnread: {
    backgroundColor: 'rgba(29, 155, 240, 0.05)',
  },
  notificationAvatar: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.dark.card,
  },
  notificationIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.dark.background,
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notificationUserName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  notificationTime: {
    fontSize: 13,
    color: colors.dark.textSecondary,
  },
  notificationMessage: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    lineHeight: 20,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.dark.textSecondary,
  },
});
