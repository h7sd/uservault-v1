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
  ScrollView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check, ChevronDown, Mail } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import LivewireWebView from '@/components/LivewireWebView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

const PENDING_VERIFICATION_KEY = 'pending_verification_token';

const COUNTRIES = [
  { code: 'DE', name: 'Germany' },
  { code: 'US', name: 'United States' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
];

interface WelcomeOverlayProps {
  visible: boolean;
  username: string;
  onComplete: () => void;
}

function WelcomeOverlay({ visible, username, onComplete }: WelcomeOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(checkScale, {
            toValue: 1,
            friction: 5,
            tension: 80,
            useNativeDriver: true,
          }),
          Animated.timing(textSlide, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
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
      }, 2200);

      return () => clearTimeout(timeout);
    }
  }, [visible, onComplete, fadeAnim, scaleAnim, checkScale, textSlide]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.welcomeOverlay, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.welcomeContent, { transform: [{ scale: scaleAnim }] }]}>
        <Animated.View style={[styles.welcomeCheckCircle, { transform: [{ scale: checkScale }] }]}>
          <Check color="#FFFFFF" size={36} strokeWidth={3} />
        </Animated.View>
        <Animated.Text 
          style={[
            styles.welcomeTitle, 
            { transform: [{ translateY: textSlide }], opacity: fadeAnim }
          ]}
        >
          Welcome to USER VAULT
        </Animated.Text>
        <Animated.Text 
          style={[
            styles.welcomeUsername,
            { transform: [{ translateY: textSlide }], opacity: fadeAnim }
          ]}
        >
          @{username}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

export default function RegisterScreen() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState<string>('');
  const [verificationToken, setVerificationToken] = useState<string>('');
  
  
  const [username, setUsername] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [birthDay, setBirthDay] = useState<string>('');
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [birthYear, setBirthYear] = useState<string>('');
  const [gender, setGender] = useState<'male' | 'female' | 'not-specified'>('not-specified');
  const [country] = useState<string>('DE');
  const [city, setCity] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  const [welcomeUsername, setWelcomeUsername] = useState<string>('');
  
  const { registerVerify, registerSendCode } = useAuth();
  const [webViewTrigger, setWebViewTrigger] = useState(false);
  const useWebView = Platform.OS !== 'web';
  const router = useRouter();
  const params = useLocalSearchParams<{ verificationToken?: string }>();

  useEffect(() => {
    const checkForPendingToken = async () => {
      if (params.verificationToken) {
        console.log('[Register] Received token from deep link:', params.verificationToken);
        setVerificationToken(params.verificationToken);
        setStep(3);
        await AsyncStorage.removeItem(PENDING_VERIFICATION_KEY);
        return;
      }

      try {
        const storedToken = await AsyncStorage.getItem(PENDING_VERIFICATION_KEY);
        if (storedToken) {
          console.log('[Register] Found stored verification token:', storedToken);
          setVerificationToken(storedToken);
          setStep(3);
          await AsyncStorage.removeItem(PENDING_VERIFICATION_KEY);
        }
      } catch (error) {
        console.error('[Register] Error checking stored token:', error);
      }
    };

    checkForPendingToken();
  }, [params.verificationToken]);

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      console.log('[Register] Deep link received:', event.url);
      const successMatch = event.url.match(/signup-success\/([^\/?]+)/) || 
                           event.url.match(/verify-email\/([^\/?]+)/);
      if (successMatch && successMatch[1]) {
        console.log('[Register] Token from deep link:', successMatch[1]);
        setVerificationToken(successMatch[1]);
        setStep(3);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && step === 2) {
        console.log('[Register] App became active, checking for stored token...');
        try {
          const storedToken = await AsyncStorage.getItem(PENDING_VERIFICATION_KEY);
          if (storedToken) {
            console.log('[Register] Found token after returning:', storedToken);
            setVerificationToken(storedToken);
            setStep(3);
            await AsyncStorage.removeItem(PENDING_VERIFICATION_KEY);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        } catch (error) {
          console.error('[Register] Error checking token on app resume:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [step]);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const shakeInput = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.96,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleWebViewSuccess = useCallback((token: string) => {
    console.log('[Register] WebView success! Token:', token);
    setIsLoading(false);
    setWebViewTrigger(false);
    setVerificationToken(token);
    setStep(2);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const handleWebViewError = useCallback((error: string) => {
    console.error('[Register] WebView error:', error);
    setIsLoading(false);
    setWebViewTrigger(false);
    setErrorMessage(error);
    Alert.alert('Error', error);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []);

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes('@')) {
      shakeInput();
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    animateButtonPress();
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (useWebView && Platform.OS !== 'web') {
      console.log('[Register] Using WebView for registration...');
      setWebViewTrigger(true);
    } else {
      console.log('[Register] Using direct API for web registration...');
      try {
        const result = await registerSendCode(email.trim());
        console.log('[Register] API registerSendCode result:', result);
        
        if (result.success && result.token) {
          console.log('[Register] Email sent successfully, token:', result.token);
          setVerificationToken(result.token);
          setStep(2);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } else {
          console.error('[Register] API error:', result.error);
          setErrorMessage(result.error || 'Failed to send verification email');
          shakeInput();
        }
      } catch (error) {
        console.error('[Register] Exception:', error);
        const message = error instanceof Error ? error.message : 'Failed to send verification email';
        setErrorMessage(message);
        shakeInput();
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRegister = async () => {
    console.log('[Register] Step 2: Complete registration');
    
    if (!username.trim() || !firstName.trim()) {
      console.log('[Register] Validation failed: missing required fields');
      shakeInput();
      setErrorMessage('Please fill in all required fields');
      return;
    }

    const day = parseInt(birthDay, 10);
    const month = parseInt(birthMonth, 10);
    const year = parseInt(birthYear, 10);

    if (!birthDay || !birthMonth || !birthYear || isNaN(day) || isNaN(month) || isNaN(year)) {
      console.log('[Register] Validation failed: invalid birth date');
      shakeInput();
      setErrorMessage('Please enter a valid birth date');
      return;
    }

    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > new Date().getFullYear() - 13) {
      console.log('[Register] Validation failed: birth date out of range');
      shakeInput();
      setErrorMessage('Invalid birth date. You must be at least 13 years old.');
      return;
    }

    console.log('[Register] All validations passed, starting registration...');
    setIsLoading(true);
    setErrorMessage('');
    animateButtonPress();
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    try {
      console.log('[Register] Calling registerVerify with token');
      
      const result = await registerVerify({
        token: verificationToken,
        username: username.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        birth_day: day,
        birth_month: month,
        birth_year: year,
        gender,
        country,
        city: city.trim() || undefined,
      });
      
      console.log('[Register] registerVerify returned:', result);
      
      if (result.success) {
        console.log('[Register] Success! User:', result.user);
        const displayUsername = result.user?.username || username;
        console.log('[Register] Setting welcome username:', displayUsername);
        setWelcomeUsername(displayUsername);
        setShowWelcome(true);
      } else {
        console.error('[Register] Failed:', result.error);
        shakeInput();
        const errorMsg = result.error || 'Registration failed';
        setErrorMessage(errorMsg);
        Alert.alert('Registration failed', errorMsg);
      }
    } catch (error) {
      console.error('[Register] Exception caught:', error);
      shakeInput();
      const message = error instanceof Error ? error.message : 'An error occurred';
      setErrorMessage(message);
      Alert.alert('Error', message);
    } finally {
      console.log('[Register] Setting isLoading to false');
      setIsLoading(false);
    }
  };

  const handleWelcomeComplete = () => {
    console.log('[Register] Welcome complete, navigating...');
    setShowWelcome(false);
    router.replace('/(tabs)');
  };

  if (step === 2) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#0f0f1e', '#0a0a0a']}
          style={styles.gradientBackground}
        />
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        >
          <KeyboardAvoidingView
            style={styles.content}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Animated.View 
              style={[
                styles.headerSection,
                { 
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <View style={styles.logoContainer}>
                <Text style={styles.uvLogo}>UV</Text>
              </View>
              
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>We sent a verification link to</Text>
              <Text style={styles.emailDisplay}>{email}</Text>
            </Animated.View>

            <Animated.View 
              style={[
                styles.formSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <View style={styles.emailVerificationBox}>
                <Mail color="#8B5CF6" size={64} />
                <Text style={styles.verificationTitle}>Verify your email</Text>
                <Text style={styles.verificationText}>
                  Please click the verification link in your email to continue.
                </Text>
                <Text style={styles.verificationSubtext}>
                  After clicking the link, come back here and tap &quot;Continue&quot; below.
                </Text>
              </View>

              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={styles.registerButton}
                  onPress={() => {
                    setStep(3);
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.registerButtonText}>I&apos;ve verified my email</Text>
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
                <Text style={styles.backLink}>Use a different email</Text>
              </TouchableOpacity>
            </Animated.View>
          </KeyboardAvoidingView>
        </ScrollView>
      </View>
    );
  }

  if (step === 1) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#0f0f1e', '#0a0a0a']}
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
            <Animated.View 
              style={[
                styles.headerSection,
                { 
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <View style={styles.logoContainer}>
                <Text style={styles.uvLogo}>UV</Text>
              </View>
              
              <Text style={styles.title}>Create Account</Text>
            </Animated.View>

            <Animated.View 
              style={[
                styles.formSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <View style={styles.infoBox}>
                <Mail color="#8B5CF6" size={56} />
                <Text style={styles.infoTitle}>Website Registration Required</Text>
                <Text style={styles.infoText}>
                  To create an account, please visit our website first:
                </Text>
                <Text style={styles.infoSteps}>
                  1. Go to uservault.net and create your account{"\n"}
                  2. Verify your email address{"\n"}
                  3. Come back here and sign in
                </Text>
                <View style={styles.comingSoonBox}>
                  <Text style={styles.comingSoonText}>
                    We are working on fixing in-app registration as fast as possible!
                  </Text>
                </View>

                <Text style={styles.teamSignatureInBox}>— Uservault team</Text>
              </View>

              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={styles.registerButton}
                  onPress={() => router.back()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.registerButtonText}>Go to Sign In</Text>
                </TouchableOpacity>
              </Animated.View>


            </Animated.View>
          </KeyboardAvoidingView>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#0f0f1e', '#0a0a0a']}
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
          <Animated.View 
            style={[
              styles.headerSection,
              { 
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.logoContainer}>
              <Text style={styles.uvLogo}>UV</Text>
            </View>
            
            <Text style={styles.title}>Complete your profile</Text>
            <Text style={styles.subtitle}>Step 3: Fill in your details</Text>
          </Animated.View>

          <Animated.View 
            style={[
              styles.formSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {errorMessage ? (
              <Animated.View 
                style={[styles.errorContainer, { transform: [{ translateX: shakeAnim }] }]}
              >
                <Text style={styles.errorText}>{errorMessage}</Text>
              </Animated.View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username *</Text>
              <Animated.View style={[styles.inputWrapper, { transform: [{ translateX: shakeAnim }] }]}>
                <TextInput
                  style={styles.input}
                  placeholder="username"
                  placeholderTextColor="#6B7280"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    setErrorMessage('');
                  }}
                  autoCapitalize="none"
                  editable={!isLoading}
                  returnKeyType="next"
                />
              </Animated.View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.inputLabel}>First Name *</Text>
                <Animated.View style={[styles.inputWrapper, { transform: [{ translateX: shakeAnim }] }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="First"
                    placeholderTextColor="#6B7280"
                    value={firstName}
                    onChangeText={(text) => {
                      setFirstName(text);
                      setErrorMessage('');
                    }}
                    editable={!isLoading}
                    returnKeyType="next"
                  />
                </Animated.View>
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <Animated.View style={[styles.inputWrapper, { transform: [{ translateX: shakeAnim }] }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Last"
                    placeholderTextColor="#6B7280"
                    value={lastName}
                    onChangeText={setLastName}
                    editable={!isLoading}
                    returnKeyType="next"
                  />
                </Animated.View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Birth Date *</Text>
              <View style={styles.row}>
                <Animated.View style={[styles.inputWrapper, styles.birthInput, { transform: [{ translateX: shakeAnim }] }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="DD"
                    placeholderTextColor="#6B7280"
                    value={birthDay}
                    onChangeText={setBirthDay}
                    keyboardType="number-pad"
                    maxLength={2}
                    editable={!isLoading}
                  />
                </Animated.View>
                <Animated.View style={[styles.inputWrapper, styles.birthInput, { transform: [{ translateX: shakeAnim }] }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="MM"
                    placeholderTextColor="#6B7280"
                    value={birthMonth}
                    onChangeText={setBirthMonth}
                    keyboardType="number-pad"
                    maxLength={2}
                    editable={!isLoading}
                  />
                </Animated.View>
                <Animated.View style={[styles.inputWrapper, styles.birthInputYear, { transform: [{ translateX: shakeAnim }] }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY"
                    placeholderTextColor="#6B7280"
                    value={birthYear}
                    onChangeText={setBirthYear}
                    keyboardType="number-pad"
                    maxLength={4}
                    editable={!isLoading}
                  />
                </Animated.View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gender *</Text>
              <View style={styles.genderRow}>
                <TouchableOpacity
                  style={[styles.genderButton, gender === 'male' && styles.genderButtonActive]}
                  onPress={() => setGender('male')}
                  disabled={isLoading}
                >
                  <Text style={[styles.genderButtonText, gender === 'male' && styles.genderButtonTextActive]}>
                    Male
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.genderButton, gender === 'female' && styles.genderButtonActive]}
                  onPress={() => setGender('female')}
                  disabled={isLoading}
                >
                  <Text style={[styles.genderButtonText, gender === 'female' && styles.genderButtonTextActive]}>
                    Female
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.genderButton, gender === 'not-specified' && styles.genderButtonActive]}
                  onPress={() => setGender('not-specified')}
                  disabled={isLoading}
                >
                  <Text style={[styles.genderButtonText, gender === 'not-specified' && styles.genderButtonTextActive]}>
                    Other
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Country *</Text>
              <View style={styles.selectWrapper}>
                <Text style={styles.selectText}>{COUNTRIES.find(c => c.code === country)?.name}</Text>
                <ChevronDown color="#6B7280" size={20} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>City</Text>
              <Animated.View style={[styles.inputWrapper, { transform: [{ translateX: shakeAnim }] }]}>
                <TextInput
                  style={styles.input}
                  placeholder="City"
                  placeholderTextColor="#6B7280"
                  value={city}
                  onChangeText={setCity}
                  editable={!isLoading}
                  returnKeyType="next"
                />
              </Animated.View>
            </View>

            

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[
                  styles.registerButton,
                  isLoading && styles.registerButtonLoading,
                ]}
                onPress={handleRegister}
                activeOpacity={0.85}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.registerButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity onPress={() => setStep(2)} style={styles.backButton}>
              <Text style={styles.backLink}>Back to verification</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </ScrollView>

      <WelcomeOverlay 
        visible={showWelcome} 
        username={welcomeUsername}
        onComplete={handleWelcomeComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  headerSection: {
    marginBottom: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  uvLogo: {
    fontSize: 48,
    fontWeight: '800' as const,
    color: '#8B5CF6',
    letterSpacing: -2,
    textShadowColor: 'rgba(139, 92, 246, 0.9)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    lineHeight: 22,
    textAlign: 'center',
  },
  emailDisplay: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#8B5CF6',
    marginTop: 8,
    textAlign: 'center',
  },
  emailVerificationBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginVertical: 24,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  verificationTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  verificationText: {
    fontSize: 15,
    color: '#D1D5DB',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  verificationSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
    textAlign: 'center',
  },
  formSection: {
    gap: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  emailIconContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  inputGroup: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: '#2D2D30',
    borderRadius: 12,
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  birthInput: {
    flex: 1,
  },
  birthInputYear: {
    flex: 1.5,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#2D2D30',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonActive: {
    backgroundColor: '#1D9BF0',
    borderColor: '#1D9BF0',
  },
  genderButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#9CA3AF',
  },
  genderButtonTextActive: {
    color: '#000000',
  },
  selectWrapper: {
    backgroundColor: '#2D2D30',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  selectText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  registerButton: {
    height: 56,
    backgroundColor: '#1D9BF0',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#1D9BF0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  registerButtonLoading: {
    opacity: 0.8,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000000',
  },
  backButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  backLink: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '400' as const,
  },
  welcomeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  welcomeContent: {
    alignItems: 'center',
  },
  welcomeCheckCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  welcomeUsername: {
    fontSize: 18,
    fontWeight: '500' as const,
    color: '#A1A1AA',
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  infoBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 15,
    color: '#D1D5DB',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  infoSteps: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 24,
    textAlign: 'left',
    alignSelf: 'stretch',
    paddingHorizontal: 8,
  },
  comingSoonBox: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  comingSoonText: {
    fontSize: 13,
    color: '#A78BFA',
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  teamSignatureInBox: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
    marginTop: 16,
    textAlign: 'center' as const,
  },
});
