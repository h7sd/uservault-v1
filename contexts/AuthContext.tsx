import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import api from '@/services/api';
import streamingService from '@/services/streaming';
import type { User } from '@/types';

const CURRENT_USER_KEY = 'uservault_current_user';
const AUTH_TOKEN_KEY = 'uservault_auth_token';
const USERNAME_KEY = 'uservault_username';
const USER_ID_KEY = 'uservault_user_id';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null;
}

function normalizeUser(input: unknown): User | null {
  if (!isRecord(input)) return null;



  let id: number | null = null;
  const idCandidates = ['id', 'user_id', 'userId'];
  for (const key of idCandidates) {
    const val = input[key];
    if (typeof val === 'number' && !isNaN(val) && val > 0) {
      id = val;
      break;
    } else if (typeof val === 'string' && val.length > 0) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) {
        id = parsed;
        break;
      }
    }
  }

  const emailCandidates = ['email', 'mail'];
  let email = 'unknown@example.com';
  for (const key of emailCandidates) {
    if (typeof input[key] === 'string' && input[key].includes('@')) {
      email = input[key] as string;
      break;
    }
  }

  const type: 'author' | 'reader' = input.type === 'author' || input.type === 'reader' ? input.type : 'reader';

  const nameCandidates = ['name', 'full_name', 'fullName', 'display_name', 'first_name'];
  let name = '';
  for (const key of nameCandidates) {
    if (typeof input[key] === 'string' && (input[key] as string).length > 0) {
      name = input[key] as string;
      break;
    }
  }
  if (!name) {
    const firstName = typeof input.first_name === 'string' ? input.first_name : '';
    const lastName = typeof input.last_name === 'string' ? input.last_name : '';
    name = [firstName, lastName].filter(Boolean).join(' ').trim() || 'User';
  }

  const usernameCandidates = ['username', 'user_name', 'handle', 'slug', 'nickname'];
  let username: string | null = null;
  for (const key of usernameCandidates) {
    if (typeof input[key] === 'string' && (input[key] as string).length > 0) {
      username = input[key] as string;
      break;
    }
  }
  if (!username && email && email !== 'unknown@example.com') {
    username = email.split('@')[0];
  }
  if (!username && id !== null) {
    username = `user_${id}`;
  }

  if (id === null || isNaN(id)) {
    console.log('[Auth] ✗ normalizeUser FAILED - missing or invalid id');
    return null;
  }

  if (!username) {
    console.log('[Auth] ✗ normalizeUser FAILED - could not derive username');
    return null;
  }

  const getCount = (keys: string[]): number => {
    for (const key of keys) {
      const val = input[key];
      if (typeof val === 'number') {
        return val;
      }
      if (typeof val === 'string') {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
      if (isRecord(val)) {
        if (typeof (val as AnyRecord).raw === 'number') {
          return (val as AnyRecord).raw as number;
        }
        if (typeof (val as AnyRecord).formatted === 'string') {
          const parsed = parseInt((val as AnyRecord).formatted as string, 10);
          if (!isNaN(parsed)) {
            return parsed;
          }
        }
      }
    }
    return 0;
  };

  const followers_count = getCount(['followers_count', 'followersCount', 'followers', 'followers.count']);
  const following_count = getCount(['following_count', 'followingCount', 'following', 'followings_count', 'following.count']);
  const posts_count = getCount(['posts_count', 'postsCount', 'publications_count', 'posts.count']);

  const dateCandidates = ['created_at', 'createdAt', 'join_date', 'joined_at'];
  let created_at = new Date().toISOString();
  for (const key of dateCandidates) {
    const val = input[key];
    if (typeof val === 'string' && val.length > 0) {
      created_at = val;
      break;
    }
    if (isRecord(val) && typeof (val as AnyRecord).raw === 'string') {
      created_at = (val as AnyRecord).raw as string;
      break;
    }
    if (isRecord(val) && typeof (val as AnyRecord).iso === 'string') {
      created_at = (val as AnyRecord).iso as string;
      break;
    }
  }

  const avatarCandidates = ['avatar', 'avatar_url', 'avatarUrl', 'profile_image', 'profile_photo_url', 'photo'];
  let avatar: string | undefined;
  for (const key of avatarCandidates) {
    if (typeof input[key] === 'string' && (input[key] as string).length > 0) {
      avatar = input[key] as string;
      break;
    }
  }

  const coverCandidates = ['cover', 'cover_url', 'coverUrl', 'cover_image', 'banner', 'banner_url'];
  let cover: string | undefined;
  for (const key of coverCandidates) {
    if (typeof input[key] === 'string' && (input[key] as string).length > 0) {
      cover = input[key] as string;
      break;
    }
  }

  const bio = typeof input.bio === 'string' && input.bio.length > 0 ? input.bio : 
    (typeof input.about === 'string' && input.about.length > 0 ? input.about : undefined);
  
  const website = typeof input.website === 'string' && input.website.length > 0 ? input.website : undefined;
  
  const location = typeof input.location === 'string' && input.location.length > 0 ? input.location : 
    (typeof input.city === 'string' && input.city.length > 0 ? input.city : undefined);

  const user: User = {
    id,
    username,
    name,
    first_name: typeof input.first_name === 'string' ? input.first_name : undefined,
    last_name: typeof input.last_name === 'string' ? input.last_name : undefined,
    email,
    avatar,
    cover,
    bio,
    website,
    location,
    country: typeof input.country === 'string' ? input.country : undefined,
    verified: typeof input.verified === 'boolean' ? input.verified : (input.verified === 1 || input.verified === '1'),
    type,
    followers_count,
    following_count,
    posts_count,
    created_at,
  };

  return user;
}

function extractCurrentUser(payload: unknown): User | null {
  
  const direct = normalizeUser(payload);
  if (direct) return direct;

  if (!isRecord(payload)) return null;

  const candidates = [
    payload.user,
    payload.data,
    payload.profile,
    isRecord(payload.data) ? (payload.data as AnyRecord).user : null,
  ];

  for (const candidate of candidates) {
    if (candidate) {
      const normalized = normalizeUser(candidate);
      if (normalized) return normalized;
    }
  }

  return null;
}

export const [AuthContext, useAuth] = createContextHook(() => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [, setStoredUsername] = useState<string | null>(null);

  const clearSession = useCallback(async (reason?: string) => {
    console.log('[Auth] Clearing session', reason ? `(${reason})` : '');
    await AsyncStorage.multiRemove([CURRENT_USER_KEY, AUTH_TOKEN_KEY, USERNAME_KEY, USER_ID_KEY]);
    api.setAuthToken(null);
    api.setUserId(null);
    api.setUsername(null);
    setAuthToken(null);
    setCurrentUser(null);
    setStoredUsername(null);
  }, []);

  const fetchUserProfile = useCallback(async (username: string): Promise<User | null> => {
    console.log('[Auth] Fetching user profile for:', username);
    
    try {
      const profileData = await api.getProfile(username);
      console.log('[Auth] Profile data received');
      
      const user = extractCurrentUser(profileData);
      if (user) {
        console.log('[Auth] User extracted successfully:', user.id, user.username);
        api.setUserId(user.id);
        api.setUsername(user.username);
        return user;
      }
    } catch (error) {
      console.error('[Auth] Failed to fetch profile:', error);
    }
    
    return null;
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const [storedUser, storedToken, savedUsername, savedUserId] = await Promise.all([
        AsyncStorage.getItem(CURRENT_USER_KEY),
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(USERNAME_KEY),
        AsyncStorage.getItem(USER_ID_KEY),
      ]);

      console.log('[Auth] loadUser - token:', !!storedToken, 'userId:', savedUserId, 'username:', savedUsername);

      if (!storedToken) {
        console.log('[Auth] No stored token found');
        setIsLoading(false);
        return;
      }

      console.log('[Auth] Found stored token');
      setAuthToken(storedToken);
      api.setAuthToken(storedToken);

      // Restore user ID first (most reliable)
      if (savedUserId) {
        const numericId = parseInt(savedUserId, 10);
        if (!isNaN(numericId) && numericId > 0) {
          console.log('[Auth] Restored user ID from storage:', numericId);
          api.setUserId(numericId);
        }
      }

      if (savedUsername) {
        setStoredUsername(savedUsername);
        api.setUsername(savedUsername);
      }

      // Try to restore user from storage first
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          const user = extractCurrentUser(parsed);
          if (user) {
            console.log('[Auth] Restored user from storage:', user.id, user.username);
            setCurrentUser(user);
            api.setUserId(user.id);
            api.setUsername(user.username);
          }
        } catch {
          console.log('[Auth] Could not parse stored user');
        }
      }

      // Refresh profile using username (API requires username for profile lookup)
      const usernameToFetch = api.getUsername();
      
      if (usernameToFetch) {
        try {
          console.log('[Auth] Refreshing profile with username:', usernameToFetch);
          const freshUser = await fetchUserProfile(usernameToFetch);
          if (freshUser) {
            setCurrentUser(freshUser);
            await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(freshUser));
            await AsyncStorage.setItem(USER_ID_KEY, String(freshUser.id));
            await AsyncStorage.setItem(USERNAME_KEY, freshUser.username);
            console.log('[Auth] Successfully fetched and stored user by username, ID:', freshUser.id);
          }
        } catch (error) {
          console.warn('[Auth] Could not refresh profile by username:', error);
        }
      } else {
        console.log('[Auth] No username available to refresh profile');
      }
    } catch (e) {
      console.error('[Auth] Error loading user:', e);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    api.setUnauthorizedHandler(({ endpoint, status }) => {
      console.error('[Auth] Unauthorized:', endpoint, status);
      if (!endpoint.includes('/profile')) {
        clearSession('unauthorized');
      }
    });

    return () => {
      api.setUnauthorizedHandler(null);
    };
  }, [clearSession]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const registerSendCode = useCallback(async (email: string) => {
    try {
      console.log('[Auth] Sending registration code to:', email);
      const result = await api.registerSendCode(email);
      console.log('[Auth] Registration code sent successfully');
      return { success: true, token: result.token, email: result.email, message: result.message };
    } catch (error) {
      console.error('[Auth] Send code error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send verification code',
      };
    }
  }, []);

  const mobileSignup = useCallback(async (data: {
    email: string;
    password: string;
    username: string;
    display_name?: string;
    bio?: string;
  }) => {
    try {
      console.log('[Auth] Mobile signup for:', data.email);
      
      const response = await streamingService.mobileSignup({
        email: data.email,
        password: data.password,
        username: data.username,
        display_name: data.display_name,
        bio: data.bio,
      });
      
      if (!response.success || !response.access_token) {
        return { success: false, error: 'Signup failed - no token received' };
      }

      console.log('[Auth] Mobile signup successful, storing token...');
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.access_token);
      setAuthToken(response.access_token);
      api.setAuthToken(response.access_token);

      const username = response.user?.username || data.username;
      api.setUsername(username);
      await AsyncStorage.setItem(USERNAME_KEY, username);
      setStoredUsername(username);

      const user: User = {
        id: Date.now(),
        username: username,
        name: response.user?.display_name || data.display_name || data.username,
        email: data.email,
        bio: response.user?.bio || data.bio,
        type: 'reader',
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        created_at: new Date().toISOString(),
      };

      setCurrentUser(user);
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      
      console.log('[Auth] Mobile signup complete, user:', username);
      return { 
        success: true, 
        user,
        streaming: response.streaming,
      };
    } catch (error) {
      console.error('[Auth] Mobile signup error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Signup failed',
      };
    }
  }, []);

  const registerVerify = useCallback(async (data: {
    token: string;
    username: string;
    first_name: string;
    last_name?: string;
    birth_day: number;
    birth_month: number;
    birth_year: number;
    gender: 'male' | 'female' | 'not-specified';
    country: string;
    city?: string;
  }) => {
    try {
      console.log('[Auth] Verifying registration with token');

      const deviceName = `mobile app (${Platform.OS})`;
      const { plainTextToken: token, user: registerUser } = await api.registerVerify({
        ...data,
        device_name: deviceName,
      });
      
      if (!token) {
        return { success: false, error: 'No token received' };
      }

      console.log('[Auth] Token received, storing...');
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      setAuthToken(token);

      let user: User | null = null;
      let resolvedId: number | null = null;
      let resolvedUsername: string | null = null;

      if (registerUser?.id) {
        const id = typeof registerUser.id === 'number' ? registerUser.id : parseInt(registerUser.id, 10);
        if (!isNaN(id) && id > 0) {
          resolvedId = id;
          api.setUserId(resolvedId);
          await AsyncStorage.setItem(USER_ID_KEY, String(resolvedId));
          console.log('[Auth] Got user ID from register response:', resolvedId);
          
          if (registerUser.username && typeof registerUser.username === 'string') {
            resolvedUsername = registerUser.username;
            api.setUsername(resolvedUsername);
            await AsyncStorage.setItem(USERNAME_KEY, resolvedUsername);
            setStoredUsername(resolvedUsername);
            console.log('[Auth] Got username from register response:', resolvedUsername);
          }
        }
      }

      if (resolvedUsername) {
        console.log('[Auth] Fetching profile with username:', resolvedUsername);
        user = await fetchUserProfile(resolvedUsername);
      }
      
      if (user) {
        setCurrentUser(user);
        await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        await AsyncStorage.setItem(USER_ID_KEY, String(user.id));
        await AsyncStorage.setItem(USERNAME_KEY, user.username);
        api.setUserId(user.id);
        api.setUsername(user.username);
        console.log('[Auth] Registration successful:', user.id, user.username);
        return { success: true, user };
      }

      const fallbackUser: User = {
        id: resolvedId ?? Date.now(),
        username: resolvedUsername ?? data.username,
        name: data.first_name,
        first_name: data.first_name,
        last_name: data.last_name,
        email: '',
        type: 'reader',
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        created_at: new Date().toISOString(),
        is_temporary: true,
      };
      
      setCurrentUser(fallbackUser);
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(fallbackUser));
      if (resolvedId) {
        await AsyncStorage.setItem(USER_ID_KEY, String(resolvedId));
      }
      console.log('[Auth] Using fallback user with ID:', fallbackUser.id);
      return { success: true, user: fallbackUser };

    } catch (error) {
      console.error('[Auth] Registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  }, [fetchUserProfile]);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      console.log('[Auth] Sending password reset code to:', email);
      const result = await api.forgotPasswordSendCode(email);
      console.log('[Auth] Password reset code sent successfully');
      return { success: true, token: result.token, email: result.email, message: result.message };
    } catch (error) {
      console.error('[Auth] Forgot password error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send reset link',
      };
    }
  }, []);

  const resetPassword = useCallback(async (token: string, password: string, passwordConfirmation: string) => {
    try {
      console.log('[Auth] Resetting password with token');
      const { plainTextToken: authToken, user: resetUser } = await api.resetPassword(token, password, passwordConfirmation);
      
      if (!authToken) {
        return { success: false, error: 'No token received' };
      }

      console.log('[Auth] Token received, storing...');
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, authToken);
      setAuthToken(authToken);

      let user: User | null = null;
      let resolvedUsername: string | null = null;

      if (resetUser?.username && typeof resetUser.username === 'string') {
        resolvedUsername = resetUser.username;
        api.setUsername(resolvedUsername);
        await AsyncStorage.setItem(USERNAME_KEY, resolvedUsername);
        setStoredUsername(resolvedUsername);
      }

      if (resetUser?.id) {
        const id = typeof resetUser.id === 'number' ? resetUser.id : parseInt(resetUser.id, 10);
        if (!isNaN(id) && id > 0) {
          api.setUserId(id);
          await AsyncStorage.setItem(USER_ID_KEY, String(id));
        }
      }

      if (resolvedUsername) {
        user = await fetchUserProfile(resolvedUsername);
      }

      if (user) {
        setCurrentUser(user);
        await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        await AsyncStorage.setItem(USER_ID_KEY, String(user.id));
        await AsyncStorage.setItem(USERNAME_KEY, user.username);
        return { success: true, user };
      }

      return { success: false, error: 'Could not load user profile' };
    } catch (error) {
      console.error('[Auth] Reset password error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password reset failed',
      };
    }
  }, [fetchUserProfile]);

  const login = async (emailOrLogin: string, password: string) => {
    try {
      console.log('[Auth] Logging in with:', emailOrLogin);

      const { plainTextToken: token, user: loginUser } = await api.login(emailOrLogin, password);
      
      if (!token) {
        return { success: false, error: 'No token received' };
      }

      console.log('[Auth] Token received, storing...');
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
      setAuthToken(token);

      let user: User | null = null;
      let resolvedId: number | null = null;
      let resolvedUsername: string | null = null;

      // Check if login already returned user data with ID and username
      if (loginUser?.id) {
        const id = typeof loginUser.id === 'number' ? loginUser.id : parseInt(loginUser.id, 10);
        if (!isNaN(id) && id > 0) {
          resolvedId = id;
          api.setUserId(resolvedId);
          await AsyncStorage.setItem(USER_ID_KEY, String(resolvedId));
          console.log('[Auth] Got user ID from login response:', resolvedId);
          
          if (loginUser.username && typeof loginUser.username === 'string') {
            resolvedUsername = loginUser.username;
            api.setUsername(resolvedUsername);
            await AsyncStorage.setItem(USERNAME_KEY, resolvedUsername);
            setStoredUsername(resolvedUsername);
            console.log('[Auth] Got username from login response:', resolvedUsername);
          }
        }
      }

      // FIRST: Try /auth/user endpoint to get the REAL username (not derived from email)
      // This is critical because email prefix != username in the system
      if (!resolvedUsername || !resolvedId) {
        try {
          console.log('[Auth] Fetching user info from /auth/user to get real username...');
          const authUserData = await api.get<any>('/auth/user');
          console.log('[Auth] /auth/user response:', JSON.stringify(authUserData).slice(0, 500));
          
          const userData = authUserData?.data ?? authUserData;
          if (userData?.id) {
            const id = typeof userData.id === 'number' ? userData.id : parseInt(userData.id, 10);
            if (!isNaN(id) && id > 0) {
              resolvedId = id;
              api.setUserId(resolvedId);
              await AsyncStorage.setItem(USER_ID_KEY, String(resolvedId));
              console.log('[Auth] Got user ID from /auth/user:', resolvedId);
            }
          }
          if (userData?.username && typeof userData.username === 'string') {
            resolvedUsername = userData.username;
            api.setUsername(userData.username);
            await AsyncStorage.setItem(USERNAME_KEY, userData.username);
            setStoredUsername(userData.username);
            console.log('[Auth] Got REAL username from /auth/user:', userData.username);
          }
        } catch (e) {
          console.log('[Auth] /auth/user failed:', e);
        }
      }

      // Now fetch the full profile using the REAL username from /auth/user
      if (resolvedUsername) {
        console.log('[Auth] Fetching profile with real username:', resolvedUsername);
        try {
          const profileData = await api.getProfile(resolvedUsername);
          console.log('[Auth] Profile response:', JSON.stringify(profileData).slice(0, 500));
          
          const profileUser = profileData?.data ?? profileData;
          if (profileUser?.id) {
            const id = typeof profileUser.id === 'number' ? profileUser.id : parseInt(profileUser.id, 10);
            if (!isNaN(id) && id > 0) {
              resolvedId = id;
              api.setUserId(resolvedId);
              await AsyncStorage.setItem(USER_ID_KEY, String(resolvedId));
              console.log('[Auth] Got user ID from profile:', resolvedId);
            }
          }
          user = extractCurrentUser(profileData);
        } catch (e) {
          console.log('[Auth] Profile fetch failed:', e);
        }
      }

      // Fetch full profile using resolved username if we don't have user yet
      if (!user && resolvedUsername) {
        console.log('[Auth] Fetching full profile with username:', resolvedUsername);
        user = await fetchUserProfile(resolvedUsername);
      }
      
      if (user) {
        setCurrentUser(user);
        await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        await AsyncStorage.setItem(USER_ID_KEY, String(user.id));
        await AsyncStorage.setItem(USERNAME_KEY, user.username);
        api.setUserId(user.id);
        api.setUsername(user.username);
        console.log('[Auth] Login successful:', user.id, user.username);
        return { success: true, user };
      }

      // Fallback user if profile fetch fails
      const derivedUsername = emailOrLogin.includes('@') ? emailOrLogin.split('@')[0] : emailOrLogin;
      const fallbackUser: User = {
        id: resolvedId ?? Date.now(),
        username: resolvedUsername ?? derivedUsername,
        name: resolvedUsername ?? derivedUsername,
        email: emailOrLogin,
        type: 'reader',
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        created_at: new Date().toISOString(),
        is_temporary: true,
      };
      
      setCurrentUser(fallbackUser);
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(fallbackUser));
      if (resolvedId) {
        await AsyncStorage.setItem(USER_ID_KEY, String(resolvedId));
      }
      console.log('[Auth] Using fallback user with ID:', fallbackUser.id);
      return { success: true, user: fallbackUser };

    } catch (error) {
      console.error('[Auth] Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  };

  const logout = useCallback(async () => {
    try {
      console.log('[Auth] Logging out...');
      await api.logout();
    } catch (error) {
      console.error('[Auth] Logout API error:', error);
    }
    await clearSession('logout');
  }, [clearSession]);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    setCurrentUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated)).catch(console.error);
      return updated;
    });
  }, []);

  const isAuthenticated = useMemo(() => !!currentUser && !!authToken, [currentUser, authToken]);

  return {
    currentUser,
    isLoading,
    authToken,
    login,
    registerSendCode,
    registerVerify,
    mobileSignup,
    forgotPassword,
    resetPassword,
    logout,
    updateUser,
    isAuthenticated,
  };
});
