import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  ScrollView,
  Modal,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Eye, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/contexts/AuthContext';

interface WelcomeOverlayProps {
  visible: boolean;
  username: string;
  onComplete: () => void;
}

interface V1NoticePopupProps {
  onDismiss: () => void;
}

function V1NoticePopup({ onDismiss }: V1NoticePopupProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 10,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [slideAnim, opacityAnim]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  return (
    <Animated.View
      style={[
        styles.popupContainer,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.popupContent}>
        <View style={styles.popupHeader}>
          <View style={styles.v1BadgeSmall}>
            <Text style={styles.v1BadgeTextSmall}>v1.0</Text>
          </View>
          <TouchableOpacity onPress={handleDismiss} style={styles.popupCloseBtn}>
            <Text style={styles.popupCloseBtnText}>×</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.popupTitle}>Welcome to Version 1</Text>
        <Text style={styles.popupText}>
          This is the first version of the application. Should you encounter any bugs or errors, please contact us at @h9sd on Discord.
        </Text>
        <Text style={styles.popupSignature}>— The UserServault Team</Text>
      </View>
    </Animated.View>
  );
}

function WelcomeOverlay({ visible, username, onComplete }: WelcomeOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(checkScale, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      const timeout = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => onComplete());
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [visible, onComplete, fadeAnim, scaleAnim, checkScale]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.welcomeOverlay, { opacity: fadeAnim }]}>
      <View style={styles.welcomeOverlayBg} />
      <Animated.View style={[styles.welcomeContent, { transform: [{ scale: scaleAnim }] }]}>
        <Animated.View
          style={[
            styles.welcomeCheckCircle,
            { transform: [{ scale: checkScale }] },
          ]}
        >
          <Check color="#FFFFFF" size={28} strokeWidth={2.5} />
        </Animated.View>
        <Text style={styles.welcomeTitle}>Welcome back</Text>
        <Text style={styles.welcomeUsername}>@{username}</Text>
      </Animated.View>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const [loginOrEmail, setLoginOrEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  const [welcomeUsername, setWelcomeUsername] = useState<string>('');
  const [showPasswordField, setShowPasswordField] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [inputFocused, setInputFocused] = useState<string | null>(null);
  const [showV1Notice, setShowV1Notice] = useState<boolean>(false);

  const { login } = useAuth();
  const router = useRouter();

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const passwordFieldOpacity = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 10,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 12,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(formSlide, {
          toValue: 0,
          friction: 12,
          tension: 55,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeAnim, slideAnim, logoOpacity, logoScale, formSlide]);

  useEffect(() => {
    if (loginOrEmail.trim().length > 0 && !showPasswordField) {
      setShowPasswordField(true);
      Animated.timing(passwordFieldOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [loginOrEmail, showPasswordField, passwordFieldOpacity]);

  const shakeInput = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [shakeAnim]);

  const animateButtonPress = useCallback(() => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.97,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [buttonScale]);

  const handleLogin = async () => {
    if (!loginOrEmail.trim() || !password.trim()) {
      shakeInput();
      setErrorMessage('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    animateButtonPress();

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      console.log('[Login] Attempting login...');
      const result = await login(loginOrEmail.trim(), password);

      if (result.success) {
        console.log('[Login] Success! User:', result.user);
        const username = result.user?.username || loginOrEmail.split('@')[0];
        setWelcomeUsername(username);
        setShowWelcome(true);
      } else {
        console.error('[Login] Failed:', result.error);
        shakeInput();
        setErrorMessage(result.error || 'Login failed');
        Alert.alert('Login failed', result.error || 'Please check your credentials.');
      }
    } catch (error) {
      console.error('[Login] Error:', error);
      shakeInput();
      const message = error instanceof Error ? error.message : 'An error occurred';
      setErrorMessage(message);
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    router.replace('/(tabs)');
    setTimeout(() => {
      setShowV1Notice(true);
    }, 2000);
  };

  const handleCreateAccount = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowRegisterModal(true);
  };

  const handleOpenWebsite = () => {
    Linking.openURL('https://uservault.net/register');
    setShowRegisterModal(false);
  };

  const handleForgotPassword = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Linking.openURL('https://uservault.net/forgot-password');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a0f', '#0d0d14', '#0a0a0f']}
        locations={[0, 0.5, 1]}
        style={styles.gradientBackground}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[styles.headerSection, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <Text style={styles.uvLogo}>UV</Text>
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              <Text style={styles.subtitle}>Sign in to continue</Text>
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={[
              styles.formSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: formSlide }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.createAccountButton}
              onPress={handleCreateAccount}
              activeOpacity={0.7}
            >
              <Text style={styles.createAccountText}>Create new account</Text>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {errorMessage ? (
              <Animated.View
                style={[styles.errorContainer, { transform: [{ translateX: shakeAnim }] }]}
              >
                <Text style={styles.errorText}>{errorMessage}</Text>
              </Animated.View>
            ) : null}

            <View style={styles.inputGroup}>
              <Animated.View
                style={[
                  styles.inputWrapper,
                  { transform: [{ translateX: shakeAnim }] },
                  inputFocused === 'email' && styles.inputWrapperFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="Email or username"
                  placeholderTextColor="#52525b"
                  value={loginOrEmail}
                  onChangeText={(text) => {
                    setLoginOrEmail(text);
                    setErrorMessage('');
                  }}
                  onFocus={() => setInputFocused('email')}
                  onBlur={() => setInputFocused(null)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!isLoading}
                  returnKeyType="next"
                />
              </Animated.View>
            </View>

            {showPasswordField && (
              <Animated.View
                style={[
                  styles.inputGroup,
                  { opacity: passwordFieldOpacity },
                ]}
              >
                <Animated.View
                  style={[
                    styles.inputWrapper,
                    { transform: [{ translateX: shakeAnim }] },
                    inputFocused === 'password' && styles.inputWrapperFocused,
                  ]}
                >
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Password"
                    placeholderTextColor="#52525b"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setErrorMessage('');
                    }}
                    onFocus={() => setInputFocused('password')}
                    onBlur={() => setInputFocused(null)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                    onSubmitEditing={handleLogin}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="#71717a" />
                    ) : (
                      <Eye size={18} color="#71717a" />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>
            )}

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                activeOpacity={0.85}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#6366f1', '#4f46e5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loginButtonGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>Sign In</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotButton}>
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://uservault.net/terms')}
              >
                Terms of Service
              </Text>
              {' and '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://uservault.net/privacy')}
              >
                Privacy Policy
              </Text>
            </Text>
          </Animated.View>
        </KeyboardAvoidingView>
      </ScrollView>

      <WelcomeOverlay
        visible={showWelcome}
        username={welcomeUsername}
        onComplete={handleWelcomeComplete}
      />

      <Modal
        visible={showRegisterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRegisterModal(false)}
      >
        <View style={styles.modalOverlay}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={styles.modalBlur}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Create Account</Text>
                <Text style={styles.modalText}>
                  To create an account, please visit our website:
                </Text>
                <View style={styles.modalSteps}>
                  <View style={styles.modalStepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={styles.modalStep}>Visit uservault.net/register</Text>
                  </View>
                  <View style={styles.modalStepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={styles.modalStep}>Create your account</Text>
                  </View>
                  <View style={styles.modalStepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Text style={styles.modalStep}>Verify your email</Text>
                  </View>
                  <View style={styles.modalStepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>4</Text>
                    </View>
                    <Text style={styles.modalStep}>Return here to sign in</Text>
                  </View>
                </View>
                <View style={styles.modalComingSoon}>
                  <Text style={styles.modalComingSoonText}>
                    In-app registration coming soon!
                  </Text>
                </View>
                <Text style={styles.modalTeamSignature}>— Uservault team</Text>
                <TouchableOpacity style={styles.modalButton} onPress={handleOpenWebsite}>
                  <LinearGradient
                    colors={['#6366f1', '#4f46e5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalButtonGradient}
                  >
                    <Text style={styles.modalButtonText}>Open Website</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowRegisterModal(false)}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          ) : (
            <View style={styles.modalContentAndroid}>
              <Text style={styles.modalTitle}>Create Account</Text>
              <Text style={styles.modalText}>
                To create an account, please visit our website:
              </Text>
              <View style={styles.modalSteps}>
                <View style={styles.modalStepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <Text style={styles.modalStep}>Visit uservault.net/register</Text>
                </View>
                <View style={styles.modalStepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <Text style={styles.modalStep}>Create your account</Text>
                </View>
                <View style={styles.modalStepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Text style={styles.modalStep}>Verify your email</Text>
                </View>
                <View style={styles.modalStepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>4</Text>
                  </View>
                  <Text style={styles.modalStep}>Return here to sign in</Text>
                </View>
              </View>
              <View style={styles.modalComingSoon}>
                <Text style={styles.modalComingSoonText}>In-app registration coming soon!</Text>
              </View>
              <Text style={styles.modalTeamSignature}>— Uservault team</Text>
              <TouchableOpacity style={styles.modalButton} onPress={handleOpenWebsite}>
                <LinearGradient
                  colors={['#6366f1', '#4f46e5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Open Website</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowRegisterModal(false)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

{showV1Notice && (
        <V1NoticePopup onDismiss={() => setShowV1Notice(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 140,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 56,
  },
  uvLogo: {
    fontSize: 68,
    fontWeight: '800' as const,
    color: '#fafafa',
    letterSpacing: -3,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: '#71717a',
    textAlign: 'center',
  },
  formSection: {
    gap: 12,
  },
  createAccountButton: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#27272a',
  },
  createAccountText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fafafa',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#27272a',
  },
  dividerText: {
    color: '#52525b',
    fontSize: 13,
    fontWeight: '500' as const,
    marginHorizontal: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 4,
  },
  inputWrapper: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#27272a',
  },
  inputWrapperFocused: {
    borderColor: '#6366f1',
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#fafafa',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    padding: 6,
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  loginButtonGradient: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  forgotButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#a1a1aa',
  },
  footer: {
    marginTop: 32,
    paddingTop: 24,
    paddingBottom: 40,
  },
  termsText: {
    fontSize: 11,
    color: '#52525b',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#818cf8',
  },
  welcomeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  welcomeOverlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090b',
  },
  welcomeContent: {
    alignItems: 'center',
  },
  welcomeCheckCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fafafa',
    marginBottom: 6,
  },
  welcomeUsername: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#818cf8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBlur: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 340,
  },
  modalContent: {
    padding: 24,
  },
  modalContentAndroid: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fafafa',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  modalSteps: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  modalStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#818cf8',
  },
  modalStep: {
    fontSize: 13,
    color: '#a1a1aa',
    flex: 1,
  },
  modalComingSoon: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  modalComingSoonText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#818cf8',
    textAlign: 'center',
  },
  modalTeamSignature: {
    fontSize: 12,
    color: '#71717a',
    textAlign: 'center',
    marginBottom: 18,
  },
  modalButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  modalButtonGradient: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  modalCloseButton: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#71717a',
  },
  v1Badge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 16,
  },
  v1BadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#818cf8',
    letterSpacing: 0.5,
  },
  v1NoticeText: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  v1Signature: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#71717a',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  v1DismissButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  popupContainer: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    zIndex: 200,
  },
  popupContent: {
    backgroundColor: '#1c1c22',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  v1BadgeSmall: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  v1BadgeTextSmall: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#818cf8',
  },
  popupCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupCloseBtnText: {
    fontSize: 18,
    color: '#71717a',
    fontWeight: '500' as const,
    marginTop: -2,
  },
  popupTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fafafa',
    marginBottom: 8,
  },
  popupText: {
    fontSize: 13,
    color: '#a1a1aa',
    lineHeight: 19,
    marginBottom: 10,
  },
  popupSignature: {
    fontSize: 12,
    color: '#71717a',
    fontWeight: '500' as const,
  },
});
