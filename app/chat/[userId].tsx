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
import { ArrowLeft, Send } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';

import colors from '@/constants/colors';
import { useUserProfile, useMessengerChats } from '@/hooks/useApi';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Message } from '@/types';

interface MessageItem extends Message {
  isMine: boolean;
}

export default function ChatScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { currentUser } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const username = userId || '';
  const { data: profileData, isLoading: profileLoading, error: profileError } = useUserProfile(username);
  const { data: chatsData, refetch: refetchChats } = useMessengerChats();
  const [chatId, setChatId] = React.useState<string | null>(null);
  const [creatingChat, setCreatingChat] = React.useState(false);
  const chatInitialized = React.useRef(false);
  const loadingMessagesRef = React.useRef(false);
  const messagesLoadedRef = React.useRef(false);

  const otherUser = React.useMemo(() => {
    if (!profileData) return null;
    const data = profileData?.data ?? profileData;
    return data;
  }, [profileData]);
  
  const otherUserId = React.useMemo(() => {
    if (!otherUser) return null;
    if (typeof otherUser.id === 'number') return otherUser.id;
    if (typeof otherUser.id === 'string') {
      const parsed = parseInt(otherUser.id, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return null;
  }, [otherUser]);

  let otherUserAvatar = otherUser?.avatar_url || otherUser?.avatar || 'https://i.pravatar.cc/150';
  if (otherUserAvatar && !otherUserAvatar.startsWith('http://') && !otherUserAvatar.startsWith('https://')) {
    otherUserAvatar = `https://uservault.net${otherUserAvatar.startsWith('/') ? '' : '/'}${otherUserAvatar}`;
  }

  useEffect(() => {
    if (chatsData?.data && otherUserId && !chatInitialized.current) {
      const existingChat = chatsData.data.find((chat: any) => {
        const chatUserId = chat.chat_info?.id;
        const match = chatUserId === otherUserId;
        console.log('[Chat] Checking chat:', chat.chat_id, 'userId:', chatUserId, 'match:', match);
        return match;
      });
      
      if (existingChat) {
        const chatIdValue = existingChat.chat_id || existingChat.id;
        console.log('[Chat] Found existing chat:', chatIdValue);
        setChatId(String(chatIdValue));
        chatInitialized.current = true;
      } else {
        console.log('[Chat] No existing chat found for userId:', otherUserId);
      }
    }
  }, [chatsData?.data, otherUserId]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!chatId || loadingMessagesRef.current || messagesLoadedRef.current) return;
      
      try {
        loadingMessagesRef.current = true;
        console.log('[Chat] Loading messages for chatId:', chatId);
        const response = await api.getChatMessages(chatId);
        console.log('[Chat] Messages loaded:', response);
        
        const messagesData = response?.data || [];
        const formattedMessages = messagesData.map((msg: any) => ({
          ...msg,
          isMine: msg.user_id === currentUser?.id,
        }));
        
        console.log('[Chat] Setting', formattedMessages.length, 'messages');
        setMessages(formattedMessages);
        messagesLoadedRef.current = true;
      } catch (error) {
        console.error('[Chat] Failed to load messages:', error);
      } finally {
        loadingMessagesRef.current = false;
      }
    };

    if (chatId) {
      messagesLoadedRef.current = false;
      loadMessages();
    }
  }, [chatId, currentUser?.id]);

  const handleSend = async () => {
    if (!message.trim() || !otherUserId) {
      console.log('[Chat] Cannot send - message:', !!message.trim(), 'userId:', otherUserId);
      return;
    }

    const messageContent = message.trim();
    setMessage('');

    try {
      let currentChatId = chatId;
      
      if (!currentChatId || typeof currentChatId !== 'string' || currentChatId.length === 0) {
        console.log('[Chat] No chat exists, launching chat with user_id:', otherUserId);
        setCreatingChat(true);
        
        try {
          console.log('[Chat] Step 1: Launching chat via POST /messenger/chats/launch');
          const launchResponse = await api.createChat(otherUserId);
          console.log('[Chat] Chat launched, response:', JSON.stringify(launchResponse, null, 2));
          
          let newChatId = null;
          
          if (launchResponse?.data?.chat_id) {
            newChatId = launchResponse.data.chat_id;
          } else if (launchResponse?.chat_id) {
            newChatId = launchResponse.chat_id;
          }
          
          console.log('[Chat] Extracted chat_id:', newChatId);
          
          if (!newChatId) {
            throw new Error('Failed to get chat_id from launch response');
          }
          
          const chatIdStr = String(newChatId);
          setChatId(chatIdStr);
          currentChatId = chatIdStr;
          chatInitialized.current = true;
          console.log('[Chat] ✓ Chat launched with ID:', chatIdStr);
          
          await refetchChats();
          setCreatingChat(false);
        } catch (createError) {
          console.error('[Chat] Failed to launch chat:', createError);
          setCreatingChat(false);
          setMessage(messageContent);
          throw createError;
        }
      }
      
      const tempMessage: MessageItem = {
        id: Date.now(),
        chat_id: currentChatId,
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
      
      console.log('[Chat] Step 2: Sending message with chat_id:', currentChatId);
      await api.sendMessage(currentChatId, messageContent);
      console.log('[Chat] ✓ Message sent successfully');
      
      setTimeout(async () => {
        try {
          const response = await api.getChatMessages(currentChatId);
          const messagesData = response?.data || [];
          const formattedMessages = messagesData.map((msg: any) => ({
            ...msg,
            isMine: msg.user_id === currentUser?.id,
          }));
          setMessages(formattedMessages);
          console.log('[Chat] Messages refreshed after send');
        } catch (error) {
          console.error('[Chat] Failed to refresh messages:', error);
        }
        refetchChats();
      }, 300);
    } catch (error) {
      console.error('[Chat] Failed to send message:', error);
      setCreatingChat(false);
      setMessage(messageContent);
    }
  };

  const renderMessage = ({ item }: { item: MessageItem }) => (
    <View style={[styles.messageRow, item.isMine && styles.messageRowMine]}>
      {!item.isMine && (
        <Image
          source={{ uri: otherUserAvatar }}
          style={styles.messageAvatar}
        />
      )}
      <View style={[styles.messageBubble, item.isMine ? styles.messageBubbleMine : styles.messageBubbleOther]}>
        <Text style={[styles.messageText, item.isMine && styles.messageTextMine]}>{item.content}</Text>
      </View>
    </View>
  );

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.dark.text} />
        </View>
      </SafeAreaView>
    );
  }

  if (profileError && !profileData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color={colors.dark.text} size={24} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerName}>User Not Found</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>User not found</Text>
          <Text style={styles.emptySubtext}>This user may no longer exist</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color={colors.dark.text} size={24} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image
            source={{ uri: otherUserAvatar }}
            style={styles.headerAvatar}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{otherUser?.name || 'User'}</Text>
            <Text style={styles.headerUsername}>@{otherUser?.username || username}</Text>
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
              <Text style={styles.emptyText}>No messages</Text>
              <Text style={styles.emptySubtext}>Send the first message!</Text>
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
              disabled={!message.trim() || creatingChat}
            >
              {creatingChat ? (
                <ActivityIndicator size="small" color={colors.dark.background} />
              ) : (
                <Send color={colors.dark.background} size={20} />
              )}
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
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
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
  messageBubble: {
    maxWidth: '70%',
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