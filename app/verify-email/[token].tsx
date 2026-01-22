import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_VERIFICATION_KEY = 'pending_verification_token';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  const handleVerification = useCallback(async (verificationToken: string) => {
    try {
      console.log('[VerifyEmail] Storing token for registration completion');
      
      await AsyncStorage.setItem(PENDING_VERIFICATION_KEY, verificationToken);
      
      setStatus('success');
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setTimeout(() => {
        router.replace({
          pathname: '/register',
          params: { verificationToken: verificationToken }
        });
      }, 1500);
      
    } catch (error) {
      console.error('[VerifyEmail] Error:', error);
      setStatus('error');
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  }, [router]);

  useEffect(() => {
    if (token) {
      console.log('[VerifyEmail] Received token:', token);
      handleVerification(token);
    }
  }, [token, handleVerification]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#0f0f1e', '#0a0a0a']}
        style={styles.gradientBackground}
      />
      
      <View style={styles.content}>
        {status === 'verifying' && (
          <>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.title}>Verifying...</Text>
            <Text style={styles.subtitle}>Please wait while we verify your email</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View style={styles.iconContainer}>
              <Check color="#FFFFFF" size={48} strokeWidth={3} />
            </View>
            <Text style={styles.title}>Email Verified!</Text>
            <Text style={styles.subtitle}>Redirecting to complete registration...</Text>
          </>
        )}

        {status === 'error' && (
          <>
            <View style={[styles.iconContainer, styles.errorIcon]}>
              <X color="#FFFFFF" size={48} strokeWidth={3} />
            </View>
            <Text style={styles.title}>Verification Failed</Text>
            <Text style={styles.subtitle}>Please try again or request a new verification email</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  errorIcon: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
  },
});
