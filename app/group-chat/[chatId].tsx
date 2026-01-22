import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Users } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';

import colors from '@/constants/colors';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Message } from '@/types';

interface MessageItem extends Message {
  isMine: boolean;
}

export default function GroupChatScreen() {
  const router = useRouter();
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { currentUser } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const loadChatData = async () => {
      if (!chatId) return;
      
      try {
        setLoading(true);
        console.log('[GroupChat] Loading chat data for:', chatId);
        
        const chatData = await api.get<any>(`/messenger/chat/${chatId}`);
        console.log('[GroupChat] Chat data loaded:', chatData);
        
        const info = chatData?.data?.chat_info || chatData?.chat_info;
        setChatInfo(info);
        
        const response = await api.getChatMessages(chatId);
        console.log('[GroupChat] Messages loaded:', response);
        
        const messagesData = response?.data || [];
        const formattedMessages = messagesData.map((msg: any) => ({
          ...msg,
          isMine: msg.user_id === currentUser?.id,
        }));
        
        setMessages(formattedMessages);
      } catch (error) {
        console.error('[GroupChat] Failed to load chat:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChatData();
  }, [chatId, currentUser?.id]);

  const handleSend = async () => {
    if (!message.trim() || !chatId) {
      return;
    }

    const messageContent = message.trim();
    setMessage('');

    try {
      const tempMessage: MessageItem = {
        id: Date.now(),
        chat_id: chatId,
        user_id: currentUser?.id || 0,
        user: currentUser as any,
        content: messageContent,
        created_at: new Date().toISOString(),
        isMine: true,
      };

      setMessages(prev => [...prev, tempMessage]);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      console.log('[GroupChat] Sending message to chat:', chatId);
      await api.sendMessage(chatId, messageContent);
      console.log('[GroupChat] Message sent successfully');
      
      setTimeout(async () => {
        try {
          const response = await api.getChatMessages(chatId);
          const messagesData = response?.data || [];
          const formattedMessages = messagesData.map((msg: any) => ({
            ...msg,
            isMine: msg.user_id === currentUser?.id,
          }));
          setMessages(formattedMessages);
        } catch (error) {
          console.error('[GroupChat] Failed to refresh messages:', error);
        }
      }, 300);
    } catch (error) {
      console.error('[GroupChat] Failed to send message:', error);
      setMessage(messageContent);
    }
  };

  const renderMessage = ({ item }: { item: MessageItem }) => {
    const userAvatar = item.user?.avatar || 'https://i.pravatar.cc/150';
    const fullAvatar = userAvatar.startsWith('http') 
      ? userAvatar 
      : `https://uservault.net${userAvatar.startsWith('/') ? '' : '/'}${userAvatar}`;

    return (
      <View style={[styles.messageRow, item.isMine && styles.messageRowMine]}>
        {!item.isMine && (
          <Image
            source={{ uri: fullAvatar }}
            style={styles.messageAvatar}
          />
        )}
        <View style={styles.messageContent}>
          {!item.isMine && (
            <Text style={styles.messageSender}>
              {item.user?.name || item.user?.username || 'User'}
            </Text>
          )}
          <View style={[styles.messageBubble, item.isMine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
            <Text style={[styles.messageText, item.isMine && styles.messageTextMine]}>{item.content}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.dark.text} />
        </View>
      </SafeAreaView>
    );
  }

  const groupAvatar = chatInfo?.avatar_url || 'https://i.pravatar.cc/150';
  const fullGroupAvatar = groupAvatar.startsWith('http') 
    ? groupAvatar 
    : `https://uservault.net${groupAvatar.startsWith('/') ? '' : '/'}${groupAvatar}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.dark.text} size={24} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.groupAvatarContainer}>
            <Image
              source={{ uri: fullGroupAvatar }}
              style={styles.headerAvatar}
            />
            <View style={styles.groupIconBadge}>
              <Users color={colors.dark.background} size={12} />
            </View>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{chatInfo?.name || 'Group Chat'}</Text>
            <Text style={styles.headerUsername}>
              {chatInfo?.members_count ? `${chatInfo.members_count} members` : 'Group'}
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users color={colors.dark.textSecondary} size={48} />
              <Text style={styles.emptyText}>No messages</Text>
              <Text style={styles.emptySubtext}>Send the first message to this group!</Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Write a message..."
              placeholderTextColor={colors.dark.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!message.trim()}
            >
              <Send color={colors.dark.background} size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  groupAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  groupIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.dark.accent,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.dark.background,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.dark.text,
  },
  headerUsername: {
    fontSize: 13,
    color: colors.dark.textSecondary,
    marginTop: 2,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageContent: {
    maxWidth: '70%',
  },
  messageSender: {
    fontSize: 12,
    color: colors.dark.textSecondary,
    marginBottom: 4,
    marginLeft: 4,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  messageBubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },
  messageBubbleMine: {
    backgroundColor: colors.dark.accent,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.dark.text,
  },
  messageTextMine: {
    color: colors.dark.background,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
    backgroundColor: colors.dark.background,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: colors.dark.text,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.dark.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
