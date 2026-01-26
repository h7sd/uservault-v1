import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Eye,
  EyeOff,
  X,
  Check,
  Video,
  StopCircle,
  Radio,
  Camera,
  Monitor,
  RotateCcw,
  Zap,
  Users,
  MessageCircle,
  Send,
  Settings,
  ChevronLeft,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { streamingService } from '@/services/streaming';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STREAMING_ACCOUNT_KEY = 'uservault_streaming_account_created';
const STREAMING_TOKEN_KEY = 'uservault_streaming_token';
const STREAMING_EMAIL_KEY = 'uservault_streaming_email';
const STREAMING_PASSWORD_KEY = 'uservault_streaming_password';

type StreamMode = 'select' | 'irl' | 'screen';

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
}

function generatePassword(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const specials = '!@#$%&*';
  
  let password = '';
  for (let i = 0; i < 4; i++) {
    password += letters[Math.floor(Math.random() * letters.length)];
  }
  for (let i = 0; i < 3; i++) {
    password += numbers[Math.floor(Math.random() * numbers.length)];
  }
  password += specials[Math.floor(Math.random() * specials.length)];
  password += letters[Math.floor(Math.random() * letters.length)];
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

const CATEGORIES = [
  'Just Chatting',
  'Gaming',
  'Music',
  'Art',
  'Sports',
  'IRL',
  'Technology',
  'Lifestyle',
];

function StreamTypeSelector({ onSelect }: { onSelect: (mode: StreamMode) => void }) {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.selectorContainer, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.selectorTitle}>Choose Stream Type</Text>
      <Text style={styles.selectorSubtitle}>Select how you want to go live</Text>
      
      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => onSelect('irl')}
          activeOpacity={0.8}
        >
          <View style={styles.optionIconContainer}>
            <Camera color="#FFF" size={40} />
          </View>
          <Text style={styles.optionTitle}>IRL Stream</Text>
          <Text style={styles.optionDescription}>
            Stream live with your camera. Perfect for vlogs, events, and real-life content.
          </Text>
          <View style={styles.optionFeatures}>
            <View style={styles.featureTag}>
              <Video color={colors.dark.accent} size={12} />
              <Text style={styles.featureText}>Camera</Text>
            </View>
            <View style={styles.featureTag}>
              <MessageCircle color={colors.dark.accent} size={12} />
              <Text style={styles.featureText}>Live Chat</Text>
            </View>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => onSelect('screen')}
          activeOpacity={0.8}
        >
          <View style={[styles.optionIconContainer, styles.optionIconScreen]}>
            <Monitor color="#FFF" size={40} />
          </View>
          <Text style={styles.optionTitle}>Screen Broadcast</Text>
          <Text style={styles.optionDescription}>
            Share your screen. Great for gaming, tutorials, and presentations.
          </Text>
          <View style={styles.optionFeatures}>
            <View style={styles.featureTag}>
              <Monitor color={colors.dark.accent} size={12} />
              <Text style={styles.featureText}>Screen Share</Text>
            </View>
            <View style={styles.featureTag}>
              <Settings color={colors.dark.accent} size={12} />
              <Text style={styles.featureText}>RTMP/OBS</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function IRLStreamView({
  title,
  category,
  viewerCount,
  isLive,
  onEndStream,
  onBack,
  chatMessages,
  onSendMessage,
}: {
  title: string;
  category: string;
  viewerCount: number;
  isLive: boolean;
  onEndStream: () => void;
  onBack: () => void;
  chatMessages: ChatMessage[];
  onSendMessage: (message: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);
  const chatListRef = useRef<FlatList>(null);

  const toggleCameraFacing = useCallback(() => {
    setFacing((current: CameraType) => (current === 'back' ? 'front' : 'back'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSendMessage = useCallback(() => {
    if (chatInput.trim()) {
      onSendMessage(chatInput.trim());
      setChatInput('');
    }
  }, [chatInput, onSendMessage]);

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={colors.dark.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Camera color={colors.dark.textSecondary} size={64} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          We need camera permission to start your IRL stream
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.irlContainer}>
      <CameraView style={styles.camera} facing={facing} />
      
      <View style={[styles.irlOverlay, { paddingTop: insets.top }]}>
        <View style={styles.irlHeader}>
          <TouchableOpacity style={styles.irlBackButton} onPress={onBack}>
            <ChevronLeft color="#FFF" size={28} />
          </TouchableOpacity>
          
          <View style={styles.irlHeaderCenter}>
            {isLive && (
              <View style={styles.liveIndicatorSmall}>
                <View style={styles.liveDotSmall} />
                <Text style={styles.liveTextSmall}>LIVE</Text>
              </View>
            )}
            <View style={styles.viewerBadge}>
              <Users color="#FFF" size={14} />
              <Text style={styles.viewerText}>{viewerCount}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <RotateCcw color="#FFF" size={24} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.streamInfoBadge}>
          <Text style={styles.streamTitleText} numberOfLines={1}>{title}</Text>
          <Text style={styles.streamCategoryText}>{category}</Text>
        </View>
        
        {showChat && (
          <View style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <MessageCircle color="#FFF" size={16} />
              <Text style={styles.chatHeaderText}>Live Chat</Text>
              <TouchableOpacity onPress={() => setShowChat(false)}>
                <X color="#FFF" size={18} />
              </TouchableOpacity>
            </View>
            <FlatList
              ref={chatListRef}
              data={chatMessages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.chatMessage}>
                  <Text style={styles.chatUsername}>{item.username}</Text>
                  <Text style={styles.chatMessageText}>{item.message}</Text>
                </View>
              )}
              style={styles.chatList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => chatListRef.current?.scrollToEnd()}
            />
            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                placeholder="Send a message..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={handleSendMessage}
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                <Send color="#FFF" size={18} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {!showChat && (
          <TouchableOpacity 
            style={styles.showChatButton} 
            onPress={() => setShowChat(true)}
          >
            <MessageCircle color="#FFF" size={20} />
          </TouchableOpacity>
        )}
        
        <View style={[styles.irlFooter, { paddingBottom: insets.bottom + 16 }]}>
          {isLive && (
            <TouchableOpacity style={styles.endStreamButtonIRL} onPress={onEndStream}>
              <StopCircle color="#FFF" size={24} />
              <Text style={styles.endStreamText}>End Stream</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default function GoLiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { authToken, currentUser } = useAuth();

  const [streamMode, setStreamMode] = useState<StreamMode>('select');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Just Chatting');
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [copied, setCopied] = useState<'rtmp' | 'key' | 'full' | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [liveRtmpUrl, setLiveRtmpUrl] = useState<string | null>(null);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [streamingToken, setStreamingToken] = useState<string | null>(null);
  const [hasStreamingAccount, setHasStreamingAccount] = useState<boolean | null>(null);
  const [isCheckingAccount, setIsCheckingAccount] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [pendingStreamMode, setPendingStreamMode] = useState<StreamMode | null>(null);
  const [viewerCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', username: 'System', message: 'Welcome to the stream!', timestamp: new Date() },
  ]);
  const [streamingEmail, setStreamingEmail] = useState<string | null>(null);
  const [streamingPassword, setStreamingPassword] = useState<string | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showSavedCredentials, setShowSavedCredentials] = useState(false);

  useEffect(() => {
    const checkStreamingAccount = async () => {
      setIsCheckingAccount(true);
      try {
        const [accountCreated, storedToken, storedEmail, storedPassword] = await Promise.all([
          AsyncStorage.getItem(STREAMING_ACCOUNT_KEY),
          AsyncStorage.getItem(STREAMING_TOKEN_KEY),
          AsyncStorage.getItem(STREAMING_EMAIL_KEY),
          AsyncStorage.getItem(STREAMING_PASSWORD_KEY),
        ]);
        setHasStreamingAccount(accountCreated === 'true');
        if (storedToken) {
          setStreamingToken(storedToken);
        }
        if (storedEmail) {
          setStreamingEmail(storedEmail);
        }
        if (storedPassword) {
          setStreamingPassword(storedPassword);
        }
        console.log('[GoLive] Streaming account status:', accountCreated, 'token:', !!storedToken);
      } catch (error) {
        console.error('[GoLive] Error checking streaming account:', error);
        setHasStreamingAccount(false);
      } finally {
        setIsCheckingAccount(false);
      }
    };
    checkStreamingAccount();
  }, []);

  const createStreamingAccountMutation = useMutation({
    mutationFn: async () => {
      console.log('[GoLive] Starting account creation, currentUser:', currentUser?.username);
      
      if (!currentUser?.username) {
        throw new Error('No user logged in. Please login first.');
      }
      
      const email = `${currentUser.username}@uservault.stream`;
      const password = generatePassword();
      
      console.log('[GoLive] Creating streaming account for:', email);
      console.log('[GoLive] With display_name:', currentUser.name || currentUser.username);
      console.log('[GoLive] With bio:', currentUser.bio || '(empty)');
      console.log('[GoLive] With avatar:', currentUser.avatar || '(none)');
      
      const response = await streamingService.mobileSignup({
        email,
        password,
        username: currentUser.username,
        display_name: currentUser.name || currentUser.username,
        bio: currentUser.bio || '',
        avatar_url: currentUser.avatar,
      });
      
      console.log('[GoLive] Signup response:', JSON.stringify(response));
      
      return { ...response, generatedEmail: email, generatedPassword: password };
    },
    onSuccess: async (data) => {
      console.log('[GoLive] Streaming account created successfully:', JSON.stringify(data));
      try {
        await AsyncStorage.setItem(STREAMING_ACCOUNT_KEY, 'true');
        if (data.access_token) {
          await AsyncStorage.setItem(STREAMING_TOKEN_KEY, data.access_token);
          setStreamingToken(data.access_token);
        }
        if (data.generatedEmail) {
          await AsyncStorage.setItem(STREAMING_EMAIL_KEY, data.generatedEmail);
          setStreamingEmail(data.generatedEmail);
        }
        if (data.generatedPassword) {
          await AsyncStorage.setItem(STREAMING_PASSWORD_KEY, data.generatedPassword);
          setStreamingPassword(data.generatedPassword);
        }
        setHasStreamingAccount(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        queryClient.invalidateQueries({ queryKey: ['mobile-stream-config'] });
        setShowCredentialsModal(true);
        console.log('[GoLive] Showing credentials modal, pending mode:', pendingStreamMode);
      } catch (storageError) {
        console.error('[GoLive] Error saving to storage:', storageError);
      }
      setIsCreatingAccount(false);
    },
    onError: (error) => {
      console.error('[GoLive] Failed to create streaming account:', error);
      setIsCreatingAccount(false);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create streaming account');
    },
  });

  const effectiveToken = streamingToken || authToken;

  const {
    data: mobileConfig,
    isLoading: loadingConfig,
  } = useQuery({
    queryKey: ['mobile-stream-config', effectiveToken],
    queryFn: async () => {
      console.log('[GoLive] Fetching mobile config');
      const result = await streamingService.getMobileConfig(effectiveToken!);
      console.log('[GoLive] Mobile config result:', result);
      return result;
    },
    enabled: !!effectiveToken && hasStreamingAccount === true,
    retry: 1,
  });

  const goLiveMutation = useMutation({
    mutationFn: () =>
      streamingService.mobileGoLive(effectiveToken!, {
        title: title || `${currentUser?.username}'s Stream`,
        category: selectedCategory,
        description,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsLive(true);
      setLiveRtmpUrl(data.rtmp_full);
      setShowSetupModal(false);
      console.log('[GoLive] Stream started successfully:', data);
    },
    onError: (error) => {
      console.log('[GoLive] Error starting stream:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to start stream');
    },
  });

  const endStreamMutation = useMutation({
    mutationFn: () => streamingService.mobileEndStream(effectiveToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsLive(false);
      setLiveRtmpUrl(null);
      setStreamMode('select');
      Alert.alert('Stream Ended', 'Your stream has been ended successfully.');
    },
    onError: (error) => {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to end stream');
    },
  });

  const handleCopy = useCallback(async (text: string, type: 'rtmp' | 'key' | 'full') => {
    await Clipboard.setStringAsync(text);
    setCopied(type);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const { mutateAsync: createStreamingAccountAsync } = createStreamingAccountMutation;

  const handleSelectMode = useCallback(async (mode: StreamMode) => {
    console.log('[GoLive] handleSelectMode called, mode:', mode, 'hasStreamingAccount:', hasStreamingAccount);
    
    if (isCheckingAccount) {
      console.log('[GoLive] Still checking account status, please wait');
      return;
    }
    
    if (!hasStreamingAccount) {
      console.log('[GoLive] No streaming account, creating one...');
      setIsCreatingAccount(true);
      setPendingStreamMode(mode);
      try {
        await createStreamingAccountAsync();
        console.log('[GoLive] Account created, will show credentials first');
      } catch (error) {
        console.error('[GoLive] Account creation failed:', error);
        setPendingStreamMode(null);
        return;
      }
      return;
    }
    setStreamMode(mode);
    setShowSetupModal(true);
  }, [hasStreamingAccount, isCheckingAccount, createStreamingAccountAsync]);

  const { mutate: goLive } = goLiveMutation;

  const handleGoLive = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for your stream');
      return;
    }
    goLive();
  }, [title, goLive]);

  const { mutate: endStream } = endStreamMutation;

  const handleEndStream = useCallback(() => {
    Alert.alert(
      'End Stream?',
      'Are you sure you want to end your live stream?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Stream',
          style: 'destructive',
          onPress: () => endStream(),
        },
      ]
    );
  }, [endStream]);

  const handleSendChatMessage = useCallback((message: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      username: currentUser?.username || 'You',
      message,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, newMessage]);
  }, [currentUser?.username]);

  const handleBack = useCallback(() => {
    if (isLive) {
      handleEndStream();
    } else if (streamMode !== 'select') {
      setStreamMode('select');
      setShowSetupModal(false);
    } else {
      router.back();
    }
  }, [isLive, streamMode, handleEndStream, router]);

  if (streamMode === 'irl' && isLive) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <IRLStreamView
          title={title || `${currentUser?.username}'s Stream`}
          category={selectedCategory}
          viewerCount={viewerCount}
          isLive={isLive}
          onEndStream={handleEndStream}
          onBack={handleBack}
          chatMessages={chatMessages}
          onSendMessage={handleSendChatMessage}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Modal visible={isCreatingAccount || createStreamingAccountMutation.isPending} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Radio color={colors.dark.accent} size={48} />
            </View>
            <Text style={styles.modalTitle}>Setting Up Your Stream</Text>
            <Text style={styles.modalText}>
              Please wait while your streaming account is being created...
            </Text>
            <ActivityIndicator size="large" color={colors.dark.accent} style={styles.modalLoader} />
            <Text style={styles.modalSubtext}>This may take a few seconds</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={showCredentialsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.credentialsModalContent}>
            <View style={styles.modalIconContainer}>
              <Check color={colors.dark.success} size={48} />
            </View>
            <Text style={styles.modalTitle}>Account Created!</Text>
            <Text style={styles.modalText}>
              Your streaming account has been created. Save these credentials to login on the website:
            </Text>
            
            <View style={styles.credentialsBox}>
              <View style={styles.credentialsBoxItem}>
                <Text style={styles.credentialLabelSmall}>Email</Text>
                <View style={styles.credentialValueRow}>
                  <Text style={styles.credentialValueSmall} selectable>{streamingEmail}</Text>
                  <TouchableOpacity onPress={() => handleCopy(streamingEmail || '', 'rtmp')}>
                    {copied === 'rtmp' ? (
                      <Check color={colors.dark.success} size={16} />
                    ) : (
                      <Copy color={colors.dark.accent} size={16} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.credentialsBoxItem}>
                <Text style={styles.credentialLabelSmall}>Password</Text>
                <View style={styles.credentialValueRow}>
                  <Text style={styles.credentialValueSmall} selectable>{streamingPassword}</Text>
                  <TouchableOpacity onPress={() => handleCopy(streamingPassword || '', 'key')}>
                    {copied === 'key' ? (
                      <Check color={colors.dark.success} size={16} />
                    ) : (
                      <Copy color={colors.dark.accent} size={16} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.credentialsBoxItem}>
                <Text style={styles.credentialLabelSmall}>Website</Text>
                <Text style={styles.credentialValueSmall} selectable>stream.uservault.de</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.credentialsCloseButton}
              onPress={() => {
                setShowCredentialsModal(false);
                if (pendingStreamMode) {
                  console.log('[GoLive] Credentials closed, proceeding with mode:', pendingStreamMode);
                  setStreamMode(pendingStreamMode);
                  setShowSetupModal(true);
                  setPendingStreamMode(null);
                }
              }}
            >
              <Text style={styles.credentialsCloseText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSetupModal && !isLive} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.setupModalContainer}
        >
          <View style={[styles.setupModalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.setupModalHeader}>
              <TouchableOpacity onPress={() => setShowSetupModal(false)}>
                <X color={colors.dark.text} size={24} />
              </TouchableOpacity>
              <Text style={styles.setupModalTitle}>
                {streamMode === 'irl' ? 'IRL Stream Setup' : 'Screen Broadcast Setup'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.setupModalScroll} showsVerticalScrollIndicator={false}>
              {(streamMode === 'screen' || streamMode === 'irl') && (
                <View style={styles.rtmpInfoCard}>
                  <View style={styles.rtmpInfoHeader}>
                    {streamMode === 'irl' ? <Camera color={colors.dark.accent} size={20} /> : <Monitor color={colors.dark.accent} size={20} />}
                    <Text style={styles.rtmpInfoTitle}>Streaming Credentials</Text>
                  </View>
                  <Text style={styles.rtmpInfoText}>
                    {streamMode === 'irl' 
                      ? 'Use Larix Broadcaster or similar app on your device to stream with camera:'
                      : 'Use these credentials in your streaming software (OBS, Larix Broadcaster, etc.):'}
                  </Text>
                  
                  <View style={styles.credentialItem}>
                    <Text style={styles.credentialLabel}>RTMP URL</Text>
                    <View style={styles.credentialRow}>
                      {loadingConfig ? (
                        <ActivityIndicator size="small" color={colors.dark.textSecondary} />
                      ) : (
                        <Text style={styles.credentialValue} numberOfLines={1}>
                          {mobileConfig?.rtmp_url || 'rtmp://stream.uservault.de/live'}
                        </Text>
                      )}
                      <TouchableOpacity
                        style={styles.copyButton}
                        onPress={() => handleCopy(mobileConfig?.rtmp_url || 'rtmp://stream.uservault.de/live', 'rtmp')}
                      >
                        {copied === 'rtmp' ? (
                          <Check color={colors.dark.success} size={16} />
                        ) : (
                          <Copy color={colors.dark.accent} size={16} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.credentialItem}>
                    <Text style={styles.credentialLabel}>Stream Key</Text>
                    <View style={styles.credentialRow}>
                      {loadingConfig ? (
                        <ActivityIndicator size="small" color={colors.dark.textSecondary} />
                      ) : (
                        <Text style={styles.credentialValue} numberOfLines={1}>
                          {showStreamKey
                            ? mobileConfig?.stream_key || 'Loading...'
                            : '••••••••••••••••'}
                        </Text>
                      )}
                      <View style={styles.keyActions}>
                        <TouchableOpacity onPress={() => setShowStreamKey(!showStreamKey)}>
                          {showStreamKey ? (
                            <EyeOff color={colors.dark.textSecondary} size={16} />
                          ) : (
                            <Eye color={colors.dark.textSecondary} size={16} />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.copyButton}
                          onPress={() => handleCopy(mobileConfig?.stream_key || '', 'key')}
                        >
                          {copied === 'key' ? (
                            <Check color={colors.dark.success} size={16} />
                          ) : (
                            <Copy color={colors.dark.accent} size={16} />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {liveRtmpUrl && (
                    <View style={styles.credentialItem}>
                      <Text style={styles.credentialLabel}>Full RTMP URL (with key)</Text>
                      <View style={styles.credentialRow}>
                        <Text style={styles.credentialValue} numberOfLines={1}>
                          {showStreamKey ? liveRtmpUrl : liveRtmpUrl.replace(/\/[^/]+$/, '/••••••••')}
                        </Text>
                        <TouchableOpacity
                          style={styles.copyButton}
                          onPress={() => handleCopy(liveRtmpUrl, 'full')}
                        >
                          {copied === 'full' ? (
                            <Check color={colors.dark.success} size={16} />
                          ) : (
                            <Copy color={colors.dark.accent} size={16} />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Stream Title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="What are you streaming today?"
                  placeholderTextColor={colors.dark.textSecondary}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={100}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Tell viewers what to expect..."
                  placeholderTextColor={colors.dark.textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryChip,
                        selectedCategory === cat && styles.categoryChipActive,
                      ]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          selectedCategory === cat && styles.categoryChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.goLiveButton, goLiveMutation.isPending && styles.buttonDisabled]}
              onPress={handleGoLive}
              disabled={goLiveMutation.isPending}
            >
              {goLiveMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Zap color="#FFF" size={22} />
                  <Text style={styles.goLiveButtonText}>Go Live</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Go Live',
          headerStyle: { backgroundColor: colors.dark.background },
          headerTintColor: colors.dark.text,
          headerLeft: () => (
            <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
              <X color={colors.dark.text} size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => hasStreamingAccount && streamingEmail ? (
            <TouchableOpacity onPress={() => setShowSavedCredentials(true)} style={styles.headerButton}>
              <Settings color={colors.dark.accent} size={22} />
            </TouchableOpacity>
          ) : null,
        }}
      />

      {streamMode === 'select' && !isCheckingAccount && (
        <>
          <StreamTypeSelector onSelect={handleSelectMode} />
          {hasStreamingAccount && streamingEmail && (
            <View style={styles.savedCredentialsCard}>
              <View style={styles.savedCredentialsHeader}>
                <Settings color={colors.dark.accent} size={18} />
                <Text style={styles.savedCredentialsTitle}>Website Login</Text>
              </View>
              <View style={styles.savedCredentialItem}>
                <Text style={styles.savedCredentialLabel}>Email:</Text>
                <Text style={styles.savedCredentialValue} selectable>{streamingEmail}</Text>
                <TouchableOpacity onPress={() => handleCopy(streamingEmail, 'rtmp')}>
                  {copied === 'rtmp' ? <Check color={colors.dark.success} size={14} /> : <Copy color={colors.dark.textSecondary} size={14} />}
                </TouchableOpacity>
              </View>
              <View style={styles.savedCredentialItem}>
                <Text style={styles.savedCredentialLabel}>Password:</Text>
                <Text style={styles.savedCredentialValue} selectable>{showStreamKey ? streamingPassword : '••••••••'}</Text>
                <TouchableOpacity onPress={() => setShowStreamKey(!showStreamKey)}>
                  {showStreamKey ? <EyeOff color={colors.dark.textSecondary} size={14} /> : <Eye color={colors.dark.textSecondary} size={14} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleCopy(streamingPassword || '', 'key')}>
                  {copied === 'key' ? <Check color={colors.dark.success} size={14} /> : <Copy color={colors.dark.textSecondary} size={14} />}
                </TouchableOpacity>
              </View>
              <Text style={styles.savedCredentialHint}>Use at stream.uservault.de</Text>
            </View>
          )}
        </>
      )}

      <Modal visible={showSavedCredentials} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.credentialsModalContent}>
            <View style={styles.modalIconContainer}>
              <Settings color={colors.dark.accent} size={48} />
            </View>
            <Text style={styles.modalTitle}>Website Login</Text>
            <Text style={styles.modalText}>
              Use these credentials to login on stream.uservault.de
            </Text>
            
            <View style={styles.credentialsBox}>
              <View style={styles.credentialsBoxItem}>
                <Text style={styles.credentialLabelSmall}>Email</Text>
                <View style={styles.credentialValueRow}>
                  <Text style={styles.credentialValueSmall} selectable>{streamingEmail || 'Not available'}</Text>
                  {streamingEmail && (
                    <TouchableOpacity onPress={() => handleCopy(streamingEmail, 'rtmp')}>
                      {copied === 'rtmp' ? (
                        <Check color={colors.dark.success} size={16} />
                      ) : (
                        <Copy color={colors.dark.accent} size={16} />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              
              <View style={styles.credentialsBoxItem}>
                <Text style={styles.credentialLabelSmall}>Password</Text>
                <View style={styles.credentialValueRow}>
                  <Text style={styles.credentialValueSmall} selectable>{streamingPassword || 'Not available'}</Text>
                  {streamingPassword && (
                    <TouchableOpacity onPress={() => handleCopy(streamingPassword, 'key')}>
                      {copied === 'key' ? (
                        <Check color={colors.dark.success} size={16} />
                      ) : (
                        <Copy color={colors.dark.accent} size={16} />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.credentialsCloseButton}
              onPress={() => setShowSavedCredentials(false)}
            >
              <Text style={styles.credentialsCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isCheckingAccount && streamMode === 'select' && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.dark.accent} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {streamMode === 'screen' && isLive && (
        <View style={styles.screenLiveContainer}>
          <View style={styles.screenLiveContent}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            
            <View style={styles.screenStreamInfo}>
              <Monitor color={colors.dark.accent} size={64} />
              <Text style={styles.screenStreamTitle}>{title}</Text>
              <Text style={styles.screenStreamCategory}>{selectedCategory}</Text>
              
              <View style={styles.viewerCountLarge}>
                <Users color={colors.dark.textSecondary} size={20} />
                <Text style={styles.viewerCountText}>{viewerCount} viewers</Text>
              </View>
            </View>

            <View style={styles.rtmpReminder}>
              <Text style={styles.rtmpReminderText}>
                Stream your screen using the RTMP URL in your broadcasting app
              </Text>
              <TouchableOpacity
                style={styles.copyFullUrlButton}
                onPress={() => handleCopy(liveRtmpUrl || '', 'full')}
              >
                <Copy color="#FFF" size={16} />
                <Text style={styles.copyFullUrlText}>Copy Stream URL</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.screenLiveFooter, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.endStreamButton, endStreamMutation.isPending && styles.buttonDisabled]}
              onPress={handleEndStream}
              disabled={endStreamMutation.isPending}
            >
              {endStreamMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <StopCircle color="#FFF" size={22} />
                  <Text style={styles.endStreamButtonText}>End Stream</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  headerButton: {
    padding: 8,
  },
  selectorContainer: {
    flex: 1,
    padding: 24,
  },
  selectorTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.dark.text,
    marginBottom: 8,
  },
  selectorSubtitle: {
    fontSize: 16,
    color: colors.dark.textSecondary,
    marginBottom: 32,
  },
  optionsContainer: {
    gap: 20,
  },
  optionCard: {
    backgroundColor: colors.dark.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  optionIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionIconScreen: {
    backgroundColor: colors.dark.accent,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.dark.text,
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  optionFeatures: {
    flexDirection: 'row',
    gap: 12,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dark.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  featureText: {
    fontSize: 12,
    color: colors.dark.text,
    fontWeight: '500' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.dark.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.dark.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 15,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalLoader: {
    marginTop: 16,
  },
  modalSubtext: {
    fontSize: 12,
    color: colors.dark.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  setupModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  setupModalContent: {
    backgroundColor: colors.dark.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  setupModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  setupModalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  setupModalScroll: {
    padding: 20,
  },
  rtmpInfoCard: {
    backgroundColor: colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.dark.accent + '30',
  },
  rtmpInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rtmpInfoTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  rtmpInfoText: {
    fontSize: 13,
    color: colors.dark.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  credentialItem: {
    marginBottom: 16,
  },
  credentialLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  credentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dark.background,
    padding: 12,
    borderRadius: 10,
  },
  credentialValue: {
    flex: 1,
    fontSize: 13,
    color: colors.dark.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    padding: 6,
  },
  keyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.dark.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.dark.text,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryChip: {
    backgroundColor: colors.dark.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  categoryChipActive: {
    backgroundColor: colors.dark.accent,
    borderColor: colors.dark.accent,
  },
  categoryChipText: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
  categoryChipTextActive: {
    color: '#FFF',
  },
  goLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#E53935',
    paddingVertical: 16,
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 8,
  },
  goLiveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  irlContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  irlOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  irlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  irlBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  irlHeaderCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveIndicatorSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E53935',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  liveDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  liveTextSmall: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  viewerText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamInfoBadge: {
    position: 'absolute',
    top: 100,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: SCREEN_WIDTH * 0.6,
  },
  streamTitleText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  streamCategoryText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  chatContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  chatHeaderText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
    marginLeft: 8,
  },
  chatList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  chatMessage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 4,
  },
  chatUsername: {
    color: colors.dark.accent,
    fontSize: 13,
    fontWeight: '600' as const,
    marginRight: 6,
  },
  chatMessageText: {
    color: '#FFF',
    fontSize: 13,
    flex: 1,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#FFF',
    fontSize: 14,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.dark.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  showChatButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  irlFooter: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  endStreamButtonIRL: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(229, 57, 53, 0.9)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
  },
  endStreamText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dark.background,
    padding: 40,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.dark.text,
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 15,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: colors.dark.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  backButtonText: {
    color: colors.dark.textSecondary,
    fontSize: 15,
  },
  screenLiveContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  screenLiveContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E53935',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    marginBottom: 32,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
  },
  liveText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  screenStreamInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  screenStreamTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.dark.text,
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  screenStreamCategory: {
    fontSize: 16,
    color: colors.dark.textSecondary,
    marginBottom: 16,
  },
  viewerCountLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewerCountText: {
    fontSize: 16,
    color: colors.dark.textSecondary,
  },
  rtmpReminder: {
    backgroundColor: colors.dark.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '100%',
  },
  rtmpReminderText: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  copyFullUrlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dark.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  copyFullUrlText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  screenLiveFooter: {
    padding: 16,
  },
  endStreamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#424242',
    paddingVertical: 16,
    borderRadius: 14,
  },
  endStreamButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  credentialsModalContent: {
    backgroundColor: colors.dark.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  credentialsBox: {
    width: '100%',
    backgroundColor: colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  credentialsBoxItem: {
    marginBottom: 12,
  },
  credentialLabelSmall: {
    fontSize: 11,
    color: colors.dark.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  credentialValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  credentialValueSmall: {
    fontSize: 14,
    color: colors.dark.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  credentialsCloseButton: {
    backgroundColor: colors.dark.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    width: '100%',
    alignItems: 'center',
  },
  credentialsCloseText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  savedCredentialsCard: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: colors.dark.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  savedCredentialsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  savedCredentialsTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  savedCredentialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  savedCredentialLabel: {
    fontSize: 13,
    color: colors.dark.textSecondary,
    width: 70,
  },
  savedCredentialValue: {
    fontSize: 13,
    color: colors.dark.text,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  savedCredentialHint: {
    fontSize: 11,
    color: colors.dark.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.dark.textSecondary,
  },
});
