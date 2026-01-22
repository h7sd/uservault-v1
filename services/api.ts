import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://uservault.net/api';

type UnauthorizedHandler = (reason: { endpoint: string; status: number; bodyText?: string }) => void;

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | Record<string, string | number>>;
  skipAuth?: boolean;
}

interface LoginResponse {
  plainTextToken: string;
  user?: {
    id: number;
    username?: string;
    email?: string;
    [key: string]: any;
  };
}

class ApiService {
  private baseUrl: string;
  private authToken: string | null = null;
  private userId: number | null = null;
  private username: string | null = null;
  private unauthorizedHandler: UnauthorizedHandler | null = null;
  private requestQueue: Map<string, Promise<any>> = new Map();
  private rateLimitDelay: number = 0;
  private lastRequestTime: number = 0;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
    console.log(`[API] auth token ${token ? 'set' : 'cleared'}`);
  }

  setUserId(id: number | null) {
    this.userId = id;
    console.log(`[API] user id set to ${id}`);
  }

  setUsername(username: string | null) {
    this.username = username;
    console.log(`[API] username set to ${username}`);
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  getUserId(): number | null {
    return this.userId;
  }

  getUsername(): string | null {
    return this.username;
  }

  setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
    this.unauthorizedHandler = handler;
  }

  private getHeaders(customHeaders?: HeadersInit): HeadersInit {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    if (customHeaders) {
      Object.assign(headers, customHeaders as Record<string, string>);
    }

    return headers;
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | Record<string, string | number>>): string {
    let url = this.baseUrl;

    if (!url.endsWith('/')) {
      url += '/';
    }

    if (endpoint.startsWith('/')) {
      url += endpoint.substring(1);
    } else {
      url += endpoint;
    }

    if (params) {
      const parts: string[] = [];
      
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        
        if (typeof value === 'object') {
          Object.entries(value).forEach(([subKey, subValue]) => {
            if (subValue !== undefined && subValue !== null) {
              parts.push(`${encodeURIComponent(key)}[${encodeURIComponent(subKey)}]=${encodeURIComponent(String(subValue))}`);
            }
          });
        } else {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
      });

      if (parts.length > 0) {
        url += '?' + parts.join('&');
      }
    }

    return url;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = 100;
    
    if (this.rateLimitDelay > 0) {
      const waitTime = Math.max(this.rateLimitDelay - timeSinceLastRequest, 0);
      if (waitTime > 0) {
        console.log(`[API] Rate limit: waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    } else if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  private getRequestKey(endpoint: string, method: string): string {
    return `${method}:${endpoint}`;
  }

  async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { params, headers: customHeaders, skipAuth, ...fetchOptions } = options;
    const method = (fetchOptions.method ?? 'GET').toUpperCase();
    const url = this.buildUrl(endpoint, params);
    const headers = this.getHeaders(customHeaders);

    const requestKey = this.getRequestKey(url, method);
    
    if (this.requestQueue.has(requestKey)) {
      console.log(`[API] Deduplicating request: ${method} ${url}`);
      return this.requestQueue.get(requestKey)!;
    }

    const requestPromise = this.executeRequest<T>(url, method, headers, fetchOptions, skipAuth, endpoint);
    this.requestQueue.set(requestKey, requestPromise);
    
    try {
      const result = await requestPromise;
      return result;
    } finally {
      setTimeout(() => this.requestQueue.delete(requestKey), 1000);
    }
  }

  private async executeRequest<T>(
    url: string,
    method: string,
    headers: HeadersInit,
    fetchOptions: RequestInit,
    skipAuth: boolean | undefined,
    endpoint: string
  ): Promise<T> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        await this.waitForRateLimit();
        
        console.log(`[API] ${method} ${url}${attempt > 0 ? ` (retry ${attempt})` : ''}`);

        const response = await fetch(url, {
          ...fetchOptions,
          method,
          headers,
        });

        console.log(`[API] response status: ${response.status}`);

        const contentType = response.headers.get('content-type') ?? '';
        const isJson = contentType.includes('application/json');

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, attempt), 10000);
          
          this.rateLimitDelay = waitTime;
          console.log(`[API] Rate limited! Waiting ${waitTime}ms before retry...`);
          
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            attempt++;
            continue;
          } else {
            throw new Error('Rate limit exceeded. Please wait a moment and try again.');
          }
        }

        this.rateLimitDelay = Math.max(0, this.rateLimitDelay - 500);

        if (!response.ok) {
          let bodyText: string | undefined;
          try {
            bodyText = await response.text();
            console.error('[API] error response:', bodyText?.slice(0, 500));
          } catch {
            console.error('[API] could not read error response');
          }

          if (response.status === 401 && !skipAuth) {
            this.unauthorizedHandler?.({ endpoint, status: response.status, bodyText });
          }

          let errorMessage = `API error: ${response.status}`;
          if (isJson && bodyText) {
            try {
              const parsed = JSON.parse(bodyText) as { message?: string; error?: string };
              if (parsed.message) {
                errorMessage = parsed.message;
              } else if (parsed.error) {
                errorMessage = parsed.error;
              }
            } catch {
              // ignore
            }
          }

          throw new Error(errorMessage);
        }

        if (!isJson) {
          const text = await response.text();
          return text as unknown as T;
        }

        const data = (await response.json()) as T;
        return data;
      } catch (error) {
        if (attempt === maxRetries - 1 || !(error instanceof Error && error.message.includes('Rate limit'))) {
          console.error('[API] request failed:', error);
          throw error;
        }
        attempt++;
      }
    }

    throw new Error('Request failed after retries');
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | Record<string, string | number>>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    console.log('[API] attempting login with:', email);

    const deviceName = Platform.OS === 'web' ? 'web app' : `mobile app (${Platform.OS})`;
    const url = `${this.baseUrl}/sanctum/token`;

    console.log('[API] login endpoint:', url);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        email: email,
        password: password,
        device_name: deviceName,
      }),
    });

    console.log('[API] login response status:', response.status);

    const rawText = await response.text();
    console.log('[API] raw login response (first 500 chars):', rawText.substring(0, 500));

    if (!response.ok) {
      console.error('[API] login error response:', rawText);
      throw new Error('Login failed: ' + rawText);
    }

    // Token ist plain text, kein JSON!
    let token: string = rawText.trim();

    // Manchmal kommt es mit Anführungszeichen
    if (token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1);
    }

    if (!token || token.length < 10) {
      console.error('[API] no valid token in response');
      throw new Error('No valid token in response');
    }

    console.log('[API] login successful, token length:', token.length);
    this.setAuthToken(token);

    // ============================================================================
    // WICHTIG: Nutze /bootstrap/bootstrap STATT /auth/user
    // ============================================================================
    let userData: any = null;

    try {
      console.log('[API] ===== FETCHING /bootstrap/bootstrap TO GET USER DATA =====');

      const bootstrapData = await this.get<any>('/bootstrap/bootstrap');
      console.log('[API] /bootstrap/bootstrap RAW response:', JSON.stringify(bootstrapData));

      // Die User-Daten sind unter: data.auth.user
      const authUser = bootstrapData?.data?.auth?.user;
      console.log('[API] authUser extracted:', JSON.stringify(authUser));

      if (!authUser) {
        throw new Error('No user data in bootstrap response');
      }

      // Extract username
      const realUsername = authUser.username;
      if (realUsername && typeof realUsername === 'string' && realUsername.length > 0) {
        this.setUsername(realUsername);
        console.log('[API] ✓ Set username:', realUsername);
      } else {
        console.error('[API] ✗ No username in response!');
      }

      // Extract user ID
      const realId = authUser.id;
      if (realId) {
        const numericId = typeof realId === 'number' ? realId : parseInt(realId, 10);
        if (!isNaN(numericId) && numericId > 0) {
          this.setUserId(numericId);
          console.log('[API] ✓ Set user ID:', numericId);
        }
      } else {
        console.error('[API] ✗ No user ID in response!');
      }

      userData = authUser;

    } catch (error) {
      console.error('[API] ✗✗✗ /bootstrap/bootstrap FAILED ✗✗✗');
      console.error('[API] Error:', error);
      throw new Error('Could not get user info after login: ' + (error instanceof Error ? error.message : String(error)));
    }

    return { plainTextToken: token, user: userData };
  }

  // Main profile endpoint - accepts username (string)
  async getProfile(username: string): Promise<any> {
    console.log('[API] ===== FETCHING PROFILE =====');
    console.log('[API] Username parameter:', username);

    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    const data = await this.get<any>('/profile/profile', { id: username });
    console.log('[API] Profile RAW response:', JSON.stringify(data));

    // Extract profile data
    const profile = data?.data ?? data;
    console.log('[API] Profile extracted:', JSON.stringify(profile).slice(0, 800));
    
    // Debug follower counts
    console.log('[API] Follower data check:');
    console.log('[API]   - followers_count:', profile?.followers_count);
    console.log('[API]   - followersCount:', profile?.followersCount);
    console.log('[API]   - followers:', profile?.followers);
    console.log('[API]   - followers.count:', profile?.followers?.count);
    console.log('[API]   - stats.followers:', profile?.stats?.followers);

    // Extract and store user ID from response
    const responseId = profile?.id;
    if (responseId) {
      const numericId = typeof responseId === 'number' ? responseId : parseInt(responseId, 10);
      if (!isNaN(numericId) && numericId > 0) {
        this.setUserId(numericId);
        console.log('[API] ✓ Updated user ID from profile:', numericId);
      }
    }

    // Store username from response
    const responseUsername = profile?.username;
    if (responseUsername) {
      this.setUsername(responseUsername);
      console.log('[API] ✓ Updated username from profile:', responseUsername);
    }

    return data;
  }

  // Get profile by numeric ID
  async getProfileById(userId: number): Promise<any> {
    console.log('[API] fetching profile for user ID:', userId);

    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    // Wenn wir username für diese userId haben
    if (this.username && this.userId === userId) {
      return this.getProfile(this.username);
    }

    // Hole username von /bootstrap/bootstrap
    try {
      const bootstrapData = await this.get<any>('/bootstrap/bootstrap');
      const authUser = bootstrapData?.data?.auth?.user;

      if (authUser?.username) {
        this.setUsername(authUser.username);
        if (authUser.id) {
          this.setUserId(authUser.id);
        }
        return this.getProfile(authUser.username);
      }
    } catch (e) {
      console.log('[API] /bootstrap/bootstrap failed:', e);
    }

    throw new Error('Could not resolve username for user ID: ' + userId);
  }

  // Get current user profile
  async getCurrentUser(): Promise<any> {
    console.log('[API] fetching current user profile');
    console.log('[API] stored userId:', this.userId, 'username:', this.username);

    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    // Wenn wir schon username haben, nutze /profile/profile
    if (this.username) {
      console.log('[API] using stored username:', this.username);
      try {
        const profileData = await this.getProfile(this.username);
        const resolvedId = profileData?.data?.id ?? profileData?.id;
        if (resolvedId) {
          const numId = typeof resolvedId === 'number' ? resolvedId : parseInt(resolvedId, 10);
          if (!isNaN(numId) && numId > 0) {
            this.setUserId(numId);
          }
        }
        return profileData;
      } catch (e) {
        console.log('[API] profile fetch by username failed:', e);
      }
    }

    // Hole User-Daten von /bootstrap/bootstrap
    console.log('[API] fetching user data from /bootstrap/bootstrap');

    try {
      const bootstrapData = await this.get<any>('/bootstrap/bootstrap');
      const authUser = bootstrapData?.data?.auth?.user;

      if (authUser?.username) {
        this.setUsername(authUser.username);
        console.log('[API] got username from bootstrap:', authUser.username);

        if (authUser.id) {
          const numId = typeof authUser.id === 'number' ? authUser.id : parseInt(authUser.id, 10);
          if (!isNaN(numId) && numId > 0) {
            this.setUserId(numId);
          }
        }

        return this.getProfile(authUser.username);
      }
    } catch (e) {
      console.log('[API] /bootstrap/bootstrap failed:', e);
    }

    throw new Error('Could not resolve user - please login again');
  }

  // Get profile posts - requires numeric user ID
  async getProfilePosts(userId: number, cursor: number = 0, type: string = 'posts'): Promise<any> {
    console.log('[API] fetching profile posts for user ID:', userId);

    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    if (!userId || userId < 1) {
      throw new Error('Valid user ID required for posts');
    }

    const data = await this.get<any>('/profile/profile/posts', {
      id: userId,
      filter: {
        type: type,
        cursor: cursor,
      },
    });

    console.log('[API] profile posts response:', JSON.stringify(data).slice(0, 500));
    return data;
  }

  // Get profile posts by username
  async getProfilePostsByUsername(username: string, cursor: number = 0, type: string = 'posts'): Promise<any> {
    console.log('[API] fetching profile posts for username:', username);

    const profileData = await this.getProfile(username);
    const userId = profileData?.data?.id ?? profileData?.id;
    
    if (!userId) {
      throw new Error('Could not resolve user ID from profile');
    }

    const numericId = typeof userId === 'number' ? userId : parseInt(userId, 10);
    return this.getProfilePosts(numericId, cursor, type);
  }

  // Get current user's posts
  async getCurrentUserPosts(cursor: number = 0, type: string = 'posts'): Promise<any> {
    console.log('[API] getCurrentUserPosts - userId:', this.userId, 'username:', this.username);
    
    // Wenn wir schon eine userId haben, nutze sie
    if (this.userId && this.userId > 0) {
      console.log('[API] using stored userId:', this.userId);
      return this.getProfilePosts(this.userId, cursor, type);
    }
    
    // Wenn wir username haben, hole erst das Profil um die userId zu bekommen
    if (this.username) {
      console.log('[API] fetching profile first to get userId');
      try {
        const profileData = await this.getProfile(this.username);
        const userId = profileData?.data?.id ?? profileData?.id;
        
        if (userId) {
          const numericId = typeof userId === 'number' ? userId : parseInt(userId, 10);
          if (!isNaN(numericId) && numericId > 0) {
            this.setUserId(numericId);
            console.log('[API] got userId from profile:', numericId);
            return this.getProfilePosts(numericId, cursor, type);
          }
        }
      } catch (e) {
        console.error('[API] failed to get profile for posts:', e);
      }
    }
    
    // Als letzten Ausweg, hole User-Daten von bootstrap
    console.log('[API] fetching bootstrap to get user data');
    try {
      const bootstrapData = await this.get<any>('/bootstrap/bootstrap');
      const authUser = bootstrapData?.data?.auth?.user;
      
      if (authUser?.id) {
        const numericId = typeof authUser.id === 'number' ? authUser.id : parseInt(authUser.id, 10);
        if (!isNaN(numericId) && numericId > 0) {
          this.setUserId(numericId);
          if (authUser.username) {
            this.setUsername(authUser.username);
          }
          return this.getProfilePosts(numericId, cursor, type);
        }
      }
    } catch (e) {
      console.error('[API] bootstrap fetch failed:', e);
    }
    
    throw new Error('Could not resolve user ID for fetching posts');
  }

  async getStoriesFeed(): Promise<any> {
    console.log('[API] fetching stories feed');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    const data = await this.get<any>('/stories/feed');
    console.log('[API] Stories feed response:', JSON.stringify(data).slice(0, 500));
    return data;
  }

  async getStoryById(storyUuid: string): Promise<any> {
    console.log('[API] fetching story:', storyUuid);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    const data = await this.get<any>(`/stories/stories/${storyUuid}`);
    console.log('[API] Story response:', JSON.stringify(data).slice(0, 500));
    return data;
  }

  async recordStoryView(frameId: number): Promise<any> {
    console.log('[API] recording story view for frame:', frameId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.post('/stories/views/record', { frame_id: frameId });
  }

  async getTimelineFeed(cursor: number = 0): Promise<any> {
    console.log('[API] fetching timeline feed, cursor:', cursor);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    const data = await this.get<any>('/timeline/feed', {
      filter: { cursor }
    });
    console.log('[API] Timeline feed response:', JSON.stringify(data).slice(0, 500));
    return data;
  }

  async getPostByHashId(hashId: string): Promise<any> {
    console.log('[API] fetching post by hash_id:', hashId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    const data = await this.get<any>(`/timeline/post/${hashId}`);
    console.log('[API] Post response:', JSON.stringify(data).slice(0, 500));
    return data;
  }

  async addPostReaction(postId: number, unifiedId: string = 'like'): Promise<any> {
    console.log('[API] adding reaction to post:', postId, 'reaction:', unifiedId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.post('/timeline/post/reaction/add', { post_id: postId, unified_id: unifiedId });
  }

  async addPostBookmark(postId: number): Promise<any> {
    console.log('[API] bookmarking post:', postId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.post('/timeline/post/bookmarks/add', { id: postId });
  }

  async createPostComment(postId: number, content: string, parentId?: number): Promise<any> {
    console.log('[API] creating comment on post:', postId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    const body: any = { post_id: postId, content };
    if (parentId) {
      body.parent_id = parentId;
    }
    return this.post('/timeline/post/comment/create', body);
  }

  async getPostComments(hashId: string, cursor: number = 0): Promise<any> {
    console.log('[API] fetching comments for post hashId:', hashId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.get(`/timeline/post/${hashId}/comments`, { cursor });
  }

  async addCommentReaction(commentId: number, unifiedId: string = '1f44d'): Promise<any> {
    console.log('[API] adding reaction to comment:', commentId, 'unified:', unifiedId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.post('/timeline/comment/reaction/add', { comment_id: commentId, unified_id: unifiedId });
  }

  async deleteComment(commentId: number): Promise<any> {
    console.log('[API] deleting comment:', commentId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.request('/timeline/post/comment/delete', {
      method: 'DELETE',
      body: JSON.stringify({ id: commentId }),
    });
  }

  async voteOnPoll(pollId: number, choiceIndex: number): Promise<any> {
    console.log('[API] voting on poll:', pollId, 'choice:', choiceIndex);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.post('/timeline/post/poll/vote', { poll_id: pollId, choice_index: choiceIndex });
  }

  async uploadStoryMedia(file: File | Blob): Promise<any> {
    console.log('[API] uploading story media');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('media_file', file);

    const response = await fetch(`${this.baseUrl}/story/editor/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Accept': 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload story media');
    }

    return response.json();
  }

  async createStory(content?: string): Promise<any> {
    console.log('[API] creating story');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.post('/story/editor/create', { content: content || '' });
  }

  async deleteStoryMedia(): Promise<any> {
    console.log('[API] deleting story media');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.delete('/story/editor/media/delete');
  }

  async deleteStoryFrame(frameId: number): Promise<any> {
    console.log('[API] deleting story frame:', frameId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.request('/stories/delete', {
      method: 'DELETE',
      body: JSON.stringify({ frame_id: frameId }),
    });
  }

  async getStoryViews(frameId: number): Promise<any> {
    console.log('[API] fetching story views for frame:', frameId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    const data = await this.get<any>(`/stories/views/${frameId}`);
    console.log('[API] Story views response:', JSON.stringify(data).slice(0, 500));
    return data;
  }

  async searchPeople(query: string, page: number = 1): Promise<any> {
    console.log('[API] searching people:', query, 'page:', page);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.post('/explore/people', {
      filter: {
        query,
        page,
      },
    });
  }

  async explorePosts(page: number = 1, onset: number = 0): Promise<any> {
    console.log('[API] fetching explore posts, page:', page);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.post('/explore/posts', {
      filter: {
        page,
        onset,
      },
    });
  }

  async toggleFollowUser(userId: number): Promise<any> {
    console.log('[API] ===== TOGGLE FOLLOW USER =====');
    console.log('[API] User ID:', userId);
    console.log('[API] User ID type:', typeof userId);
    
    if (!this.authToken) {
      console.error('[API] ✗ Not authenticated');
      throw new Error('Not authenticated');
    }
    
    if (!userId || typeof userId !== 'number' || userId < 1) {
      console.error('[API] ✗ Invalid user ID:', userId);
      throw new Error('Valid user ID is required to follow/unfollow');
    }
    
    console.log('[API] POST /follows/follow/user');
    console.log('[API] Body:', JSON.stringify({ id: userId }));
    
    try {
      const response = await this.post('/follows/follow/user', { id: userId });
      console.log('[API] ✓ Follow toggle success');
      console.log('[API] Response:', JSON.stringify(response));
      return response;
    } catch (error) {
      console.error('[API] ✗ Follow toggle failed:', error);
      throw error;
    }
  }

  async getMessengerChats(cursor: number = 0): Promise<any> {
    console.log('[API] fetching messenger chats');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    const data = await this.get<any>('/messenger/chats', { cursor });
    console.log('[API] messenger chats response:', JSON.stringify(data).slice(0, 500));
    return data;
  }

  async getChatMessages(chatId: string, cursor: number = 0): Promise<any> {
    console.log('[API] fetching chat messages:', chatId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    const data = await this.get<any>(`/messenger/chat/${chatId}/messages`, { cursor });
    console.log('[API] chat messages response:', JSON.stringify(data).slice(0, 500));
    return data;
  }

  async sendMessage(chatId: string | null, content: string, recipientId?: number): Promise<any> {
    console.log('[API] sending message to chat:', chatId, 'recipient:', recipientId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    
    const body: any = { 
      content,
    };
    
    if (chatId && typeof chatId === 'string' && chatId.length > 0) {
      body.chat_id = chatId;
      console.log('[API] POST /messenger/send with chat_id:', chatId);
    } else if (recipientId && typeof recipientId === 'number' && recipientId > 0) {
      body.user_id = recipientId;
      console.log('[API] POST /messenger/send with user_id:', recipientId, '(first message)');
    } else {
      console.error('[API] Invalid chat ID and recipient ID');
      throw new Error('Valid chat ID or user ID is required to send message');
    }
    
    const response = await this.post('/messenger/send', body);
    console.log('[API] send message response:', JSON.stringify(response));
    return response;
  }

  async createChat(recipientId: number): Promise<any> {
    console.log('[API] creating new chat with user:', recipientId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    if (!recipientId || typeof recipientId !== 'number' || recipientId < 1) {
      console.error('[API] Invalid recipient ID:', recipientId);
      throw new Error('Valid recipient ID is required to create chat');
    }
    
    console.log('[API] Creating chat via POST /messenger/chats/launch');
    const launchResponse = await this.post<any>('/messenger/chats/launch', {
      user_id: recipientId,
    });
    
    console.log('[API] Chat launched, response:', JSON.stringify(launchResponse));
    
    let chatId = null;
    if (launchResponse?.data?.chat_id) {
      chatId = launchResponse.data.chat_id;
    } else if (launchResponse?.chat_id) {
      chatId = launchResponse.chat_id;
    }
    
    console.log('[API] Extracted chat_id:', chatId);
    
    return {
      chat_id: chatId,
      data: {
        chat_id: chatId,
        ...launchResponse?.data,
      },
    };
  }

  async getFollowers(userId: number, cursor: number = 0): Promise<any> {
    console.log('[API] fetching followers for user:', userId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    const data = await this.get<any>('/profile/profile/followers', { id: userId, cursor });
    console.log('[API] followers response:', JSON.stringify(data).slice(0, 500));
    return data;
  }

  async getFollowing(userId: number, cursor: number = 0): Promise<any> {
    console.log('[API] fetching following for user:', userId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    const data = await this.get<any>('/profile/profile/followings', { id: userId, cursor });
    console.log('[API] following response:', JSON.stringify(data).slice(0, 500));
    return data;
  }

  async acceptFollowRequest(userId: number): Promise<any> {
    console.log('[API] accepting follow request from user:', userId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.post('/follows/accept/user', { id: userId });
  }

  private extractCookiesFromHeaders(response: Response): string {
    const cookies: string[] = [];
    const setCookieHeaders = response.headers.get('set-cookie');
    
    if (setCookieHeaders) {
      const cookieParts = setCookieHeaders.split(/,(?=[^;]*=)/);
      for (const part of cookieParts) {
        const match = part.match(/^([^=]+)=([^;]+)/);
        if (match) {
          cookies.push(`${match[1].trim()}=${match[2].trim()}`);
        }
      }
    }
    
    return cookies.join('; ');
  }

  private decodeHtmlEntities(str: string): string {
    return str
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  }

  async registerSendCode(email: string): Promise<{ token: string; email: string; message: string }> {
    console.log('[API] ===== REGISTRATION STEP 1: SEND EMAIL (Livewire) =====');
    console.log('[API] Email:', email);

    const signupUrl = 'https://uservault.net/auth/signup';
    console.log('[API] Step 1: GET', signupUrl);

    const signupResponse = await fetch(signupUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    console.log('[API] Signup page status:', signupResponse.status);

    if (!signupResponse.ok) {
      throw new Error('Failed to load signup page');
    }

    const signupHtml = await signupResponse.text();
    console.log('[API] Signup page loaded, length:', signupHtml.length);
    console.log('[API] Page preview:', signupHtml.substring(0, 800));

    let csrfToken = '';
    
    // Try multiple patterns for CSRF token extraction from HTML
    // Pattern 1: Standard Laravel meta tag
    const metaPatterns = [
      /<meta\s+name\s*=\s*["']csrf-token["']\s+content\s*=\s*["']([^"']+)["']/i,
      /<meta\s+content\s*=\s*["']([^"']+)["']\s+name\s*=\s*["']csrf-token["']/i,
      /name\s*=\s*["']csrf-token["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /content\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']csrf-token["']/i,
    ];

    for (const pattern of metaPatterns) {
      const match = signupHtml.match(pattern);
      if (match && match[1] && match[1].length > 20) {
        csrfToken = match[1];
        console.log('[API] Found CSRF token via meta tag');
        break;
      }
    }

    // Pattern 2: Hidden input field
    if (!csrfToken) {
      const inputPatterns = [
        /<input[^>]*name\s*=\s*["']_token["'][^>]*value\s*=\s*["']([^"']+)["']/i,
        /<input[^>]*value\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']_token["']/i,
        /type\s*=\s*["']hidden["'][^>]*name\s*=\s*["']_token["'][^>]*value\s*=\s*["']([^"']+)["']/i,
      ];
      
      for (const pattern of inputPatterns) {
        const match = signupHtml.match(pattern);
        if (match && match[1] && match[1].length > 20) {
          csrfToken = match[1];
          console.log('[API] Found CSRF token via hidden input');
          break;
        }
      }
    }

    // Pattern 3: JavaScript config object (Livewire/Alpine)
    if (!csrfToken) {
      const jsPatterns = [
        /["']?csrf["']?\s*:\s*["']([a-zA-Z0-9]{20,})["']/i,
        /["']?csrfToken["']?\s*:\s*["']([a-zA-Z0-9]{20,})["']/i,
        /csrf_token\s*[=:]\s*["']([a-zA-Z0-9]{20,})["']/i,
        /Livewire\.(?:all\(\)|start).*?csrf.*?["']([a-zA-Z0-9]{20,})["']/is,
        /window\.livewire_token\s*=\s*["']([a-zA-Z0-9]{20,})["']/i,
      ];
      
      for (const pattern of jsPatterns) {
        const match = signupHtml.match(pattern);
        if (match && match[1] && match[1].length > 20) {
          csrfToken = match[1];
          console.log('[API] Found CSRF token via JS config');
          break;
        }
      }
    }

    // Pattern 4: Extract from wire:snapshot JSON (Livewire 3)
    if (!csrfToken) {
      const snapshotMatch = signupHtml.match(/wire:snapshot\s*=\s*["']([^"']+)["']/i);
      if (snapshotMatch && snapshotMatch[1]) {
        try {
          const decodedSnapshot = this.decodeHtmlEntities(snapshotMatch[1]);
          const snapData = JSON.parse(decodedSnapshot);
          // In Livewire 3, the checksum in snapshot serves as CSRF protection
          // But we still need the page's CSRF token for the X-CSRF-TOKEN header
          if (snapData?.memo?.csrf) {
            csrfToken = snapData.memo.csrf;
            console.log('[API] Found CSRF token in wire:snapshot memo');
          }
        } catch (e) {
          console.log('[API] Could not parse snapshot for CSRF:', e);
        }
      }
    }

    // Pattern 5: Look in any script tags for token assignment
    if (!csrfToken) {
      const scriptBlocks = signupHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
      for (const scriptBlock of scriptBlocks) {
        const tokenMatch = scriptBlock.match(/['"]?(?:csrf|_token|csrfToken)['"]?\s*[=:]\s*['"]([a-zA-Z0-9]{30,})['"]/);
        if (tokenMatch && tokenMatch[1]) {
          csrfToken = tokenMatch[1];
          console.log('[API] Found CSRF token in script block');
          break;
        }
      }
    }

    // Pattern 6: Look for any 40+ char alphanumeric token near "csrf" text
    if (!csrfToken) {
      const genericMatch = signupHtml.match(/csrf[^"']*["']([a-zA-Z0-9]{40,})["']/i);
      if (genericMatch && genericMatch[1]) {
        csrfToken = genericMatch[1];
        console.log('[API] Found CSRF token via generic pattern');
      }
    }

    console.log('[API] CSRF token found:', !!csrfToken, 'length:', csrfToken.length);
    
    if (!csrfToken) {
      console.error('[API] No CSRF token found in page!');
      // Log more detailed debugging info
      const headMatch = signupHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      if (headMatch) {
        console.log('[API] Head section:', headMatch[1].substring(0, 3000));
      }
      // Look for meta tags
      const metaTags = signupHtml.match(/<meta[^>]+>/gi);
      console.log('[API] All meta tags:', metaTags?.join('\n'));
      // Look for any forms
      const forms = signupHtml.match(/<form[^>]*>[\s\S]*?<\/form>/gi);
      console.log('[API] Forms found:', forms?.length, forms?.[0]?.substring(0, 500));
      throw new Error('Could not find CSRF token. Please try again.');
    }

    let snapshot = '';
    
    // Try wire:snapshot first
    const snapshotMatch = signupHtml.match(/wire:snapshot=["']([^"']+)["']/);
    if (snapshotMatch && snapshotMatch[1]) {
      snapshot = this.decodeHtmlEntities(snapshotMatch[1]);
      console.log('[API] Found wire:snapshot, length:', snapshot.length);
    }

    // Try wire:initial-data
    if (!snapshot) {
      const initialDataMatch = signupHtml.match(/wire:initial-data=["']([^"']+)["']/);
      if (initialDataMatch && initialDataMatch[1]) {
        snapshot = this.decodeHtmlEntities(initialDataMatch[1]);
        console.log('[API] Found wire:initial-data');
      }
    }

    // Try x-data with Livewire
    if (!snapshot) {
      const xDataMatch = signupHtml.match(/x-data=["']\s*\{[^}]*snapshot\s*:\s*["']([^"']+)["']/);
      if (xDataMatch && xDataMatch[1]) {
        snapshot = this.decodeHtmlEntities(xDataMatch[1]);
        console.log('[API] Found snapshot in x-data');
      }
    }

    if (!snapshot) {
      console.error('[API] No wire:snapshot found!');
      // Look for any wire: attributes
      const wireAttrs = signupHtml.match(/wire:[a-z-]+=["'][^"']+["']/gi);
      console.log('[API] Wire attributes found:', wireAttrs?.slice(0, 5));
      throw new Error('Could not initialize registration form. Please try again.');
    }

    let parsedSnapshot: any;
    try {
      parsedSnapshot = JSON.parse(snapshot);
      console.log('[API] Parsed snapshot, memo.id:', parsedSnapshot?.memo?.id);
      console.log('[API] Parsed snapshot, memo.name:', parsedSnapshot?.memo?.name);
    } catch (e) {
      console.error('[API] Could not parse snapshot:', e);
      console.log('[API] Snapshot preview:', snapshot.substring(0, 500));
      throw new Error('Invalid registration form data. Please try again.');
    }

    const livewireUrl = 'https://uservault.net/livewire/update';
    console.log('[API] Step 2: POST', livewireUrl);

    const livewireBody = {
      components: [
        {
          snapshot: snapshot,
          calls: [
            {
              path: '',
              method: 'submitForm',
              params: []
            }
          ],
          updates: {
            emailAddress: email
          }
        }
      ]
    };

    console.log('[API] Livewire request body prepared');

    const livewireHeaders: Record<string, string> = {
      'Accept': 'application/json, text/html, application/xhtml+xml',
      'Content-Type': 'application/json',
      'X-Livewire': 'true',
      'X-CSRF-TOKEN': csrfToken,
      'Origin': 'https://uservault.net',
      'Referer': 'https://uservault.net/auth/signup',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
    };

    console.log('[API] Sending Livewire request with headers:', Object.keys(livewireHeaders));

    const livewireResponse = await fetch(livewireUrl, {
      method: 'POST',
      credentials: 'include',
      headers: livewireHeaders,
      body: JSON.stringify(livewireBody),
    });

    console.log('[API] Livewire response status:', livewireResponse.status);
    
    const contentType = livewireResponse.headers.get('content-type') || '';
    console.log('[API] Livewire response content-type:', contentType);

    const livewireText = await livewireResponse.text();
    console.log('[API] Livewire response (first 1000):', livewireText.substring(0, 1000));

    if (!livewireResponse.ok) {
      let errorMessage = 'Failed to send verification email';
      
      if (contentType.includes('application/json')) {
        try {
          const errorData = JSON.parse(livewireText);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // ignore
        }
      } else if (livewireText.includes('CSRF token mismatch')) {
        errorMessage = 'Session expired. Please try again.';
      } else if (livewireText.includes('Page Expired') || livewireText.includes('419')) {
        errorMessage = 'Session expired. Please try again.';
      }
      
      throw new Error(errorMessage);
    }

    let token = '';
    try {
      const livewireData = JSON.parse(livewireText);
      console.log('[API] Parsed Livewire response');

      const effects = livewireData?.components?.[0]?.effects;
      
      if (effects?.redirect) {
        console.log('[API] Found redirect:', effects.redirect);
        const tokenMatch = effects.redirect.match(/signup-success\/([^/\?]+)/);
        if (tokenMatch && tokenMatch[1]) {
          token = tokenMatch[1];
          console.log('[API] Extracted token from redirect:', token);
        }
      }

      // Check for errors in the new snapshot
      const newSnapshot = livewireData?.components?.[0]?.snapshot;
      if (newSnapshot) {
        try {
          const snapParsed = JSON.parse(newSnapshot);
          const errors = snapParsed?.memo?.errors;
          if (errors && Object.keys(errors).length > 0) {
            const firstErrorKey = Object.keys(errors)[0];
            const firstError = errors[firstErrorKey];
            if (Array.isArray(firstError) && firstError.length > 0) {
              throw new Error(firstError[0] as string);
            } else if (typeof firstError === 'string') {
              throw new Error(firstError);
            }
          }
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message && !parseErr.message.includes('JSON')) {
            throw parseErr;
          }
        }
      }

      // Also check effects.errors directly
      if (effects?.errors) {
        const errorKeys = Object.keys(effects.errors);
        if (errorKeys.length > 0) {
          const firstError = effects.errors[errorKeys[0]];
          if (Array.isArray(firstError) && firstError.length > 0) {
            throw new Error(firstError[0] as string);
          }
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message && !e.message.includes('JSON')) {
        throw e;
      }
      console.error('[API] Error parsing Livewire response:', e);
    }

    if (!token) {
      const urlTokenMatch = livewireText.match(/signup-success\/([a-zA-Z0-9+\/=]+)/);
      if (urlTokenMatch && urlTokenMatch[1]) {
        token = urlTokenMatch[1];
        console.log('[API] Found token in response text:', token);
      }
    }

    if (!token) {
      console.log('[API] No token found, but request succeeded. User needs to click email link.');
      token = 'pending_email_verification';
    }

    console.log('[API] Registration email sent successfully, token:', token);
    return {
      token,
      email,
      message: 'Verification email sent. Please check your inbox and click the link.',
    };
  }

  async registerVerify(data: {
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
    device_name: string;
  }): Promise<LoginResponse> {
    console.log('[API] verifying registration with token');
    
    // Build query parameters for GET request
    const params = new URLSearchParams();
    params.append('token', data.token);
    params.append('username', data.username);
    params.append('first_name', data.first_name);
    if (data.last_name) params.append('last_name', data.last_name);
    params.append('birth_day', data.birth_day.toString());
    params.append('birth_month', data.birth_month.toString());
    params.append('birth_year', data.birth_year.toString());
    params.append('gender', data.gender);
    params.append('country', data.country);
    if (data.city) params.append('city', data.city);
    params.append('device_name', data.device_name);
    
    const url = `${this.baseUrl}/register/verify?${params.toString()}`;
    console.log('[API] FULL URL:', url);
    console.log('[API] Method: GET');

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${data.token}`,
      },
    });

    console.log('[API] verify response status:', response.status);

    const responseText = await response.text();
    console.log('[API] raw verify response:', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('[API] verification error:', responseText);
      let errorMessage = 'Registration failed';
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.errors) {
          const firstError = Object.values(errorData.errors)[0];
          if (Array.isArray(firstError) && firstError.length > 0) {
            errorMessage = firstError[0] as string;
          }
        }
      } catch {
        errorMessage = responseText;
      }
      throw new Error(errorMessage);
    }

    const registerData = JSON.parse(responseText);
    console.log('[API] verification data:', JSON.stringify(registerData));

    const token = registerData?.data?.token;
    const userData = registerData?.data?.user;

    if (!token) {
      throw new Error('No token received from registration');
    }

    console.log('[API] registration successful, token length:', token.length);
    this.setAuthToken(token);

    if (userData?.username) {
      this.setUsername(userData.username);
    }
    if (userData?.id) {
      this.setUserId(userData.id);
    }

    return { plainTextToken: token, user: userData };
  }

  async forgotPasswordSendCode(email: string): Promise<{ token: string; email: string; message: string }> {
    console.log('[API] ===== FORGOT PASSWORD (Livewire) =====');
    console.log('[API] Email:', email);

    const forgotUrl = 'https://uservault.net/auth/forgot-password';
    console.log('[API] Step 1: GET', forgotUrl);

    const forgotResponse = await fetch(forgotUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    console.log('[API] Forgot page status:', forgotResponse.status);

    if (!forgotResponse.ok) {
      throw new Error('Failed to load forgot password page');
    }

    const forgotHtml = await forgotResponse.text();
    console.log('[API] Forgot page loaded, length:', forgotHtml.length);

    let csrfToken = '';
    let xsrfToken = '';
    
    // Extract XSRF-TOKEN from Set-Cookie header
    const setCookieHeader = forgotResponse.headers.get('set-cookie');
    if (setCookieHeader) {
      const xsrfMatch = setCookieHeader.match(/XSRF-TOKEN=([^;]+)/);
      if (xsrfMatch && xsrfMatch[1]) {
        xsrfToken = decodeURIComponent(xsrfMatch[1]);
        console.log('[API] Found XSRF-TOKEN from cookie');
      }
    }
    
    const csrfPatterns = [
      /<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']csrf-token["']/i,
      /name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]*name=["']csrf-token["']/i,
      /<input[^>]*name=["']_token["'][^>]*value=["']([^"']+)["']/i,
      /<input[^>]*value=["']([^"']+)["'][^>]*name=["']_token["']/i,
      /"csrf"\s*:\s*"([^"]+)"/i,
      /'csrf'\s*:\s*'([^']+)'/i,
      /csrf[_-]?token["']?\s*[=:]\s*["']([^"']+)["']/i,
    ];

    for (const pattern of csrfPatterns) {
      const match = forgotHtml.match(pattern);
      if (match && match[1] && match[1].length > 20) {
        csrfToken = match[1];
        console.log('[API] Found CSRF token in HTML');
        break;
      }
    }

    if (!csrfToken && xsrfToken) {
      csrfToken = xsrfToken;
      console.log('[API] Using XSRF-TOKEN from cookie as CSRF token');
    }

    if (!csrfToken) {
      console.error('[API] No CSRF token found!');
      throw new Error('Could not find CSRF token. Please try again.');
    }

    let snapshot = '';
    
    const snapshotMatch = forgotHtml.match(/wire:snapshot=["']([^"']+)["']/);
    if (snapshotMatch && snapshotMatch[1]) {
      snapshot = this.decodeHtmlEntities(snapshotMatch[1]);
      console.log('[API] Found wire:snapshot');
    }

    if (!snapshot) {
      const initialDataMatch = forgotHtml.match(/wire:initial-data=["']([^"']+)["']/);
      if (initialDataMatch && initialDataMatch[1]) {
        snapshot = this.decodeHtmlEntities(initialDataMatch[1]);
      }
    }

    if (!snapshot) {
      console.error('[API] No wire:snapshot found!');
      throw new Error('Could not initialize forgot password form. Please try again.');
    }

    const livewireUrl = 'https://uservault.net/livewire/update';
    console.log('[API] Step 2: POST', livewireUrl);

    const livewireBody = {
      components: [
        {
          snapshot: snapshot,
          calls: [
            {
              path: '',
              method: 'submitForm',
              params: []
            }
          ],
          updates: {
            emailAddress: email
          }
        }
      ]
    };

    const livewireHeaders: Record<string, string> = {
      'Accept': 'application/json, text/html, application/xhtml+xml',
      'Content-Type': 'application/json',
      'X-Livewire': 'true',
      'X-CSRF-TOKEN': csrfToken,
      'Origin': 'https://uservault.net',
      'Referer': 'https://uservault.net/auth/forgot-password',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
    };

    if (xsrfToken) {
      livewireHeaders['X-XSRF-TOKEN'] = xsrfToken;
    }

    const livewireResponse = await fetch(livewireUrl, {
      method: 'POST',
      credentials: 'include',
      headers: livewireHeaders,
      body: JSON.stringify(livewireBody),
    });

    console.log('[API] Livewire response status:', livewireResponse.status);

    const livewireText = await livewireResponse.text();
    console.log('[API] Livewire response (first 1000):', livewireText.substring(0, 1000));

    if (!livewireResponse.ok) {
      let errorMessage = 'Failed to send reset email';
      const contentType = livewireResponse.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          const errorData = JSON.parse(livewireText);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // ignore
        }
      } else if (livewireText.includes('CSRF token mismatch') || livewireText.includes('Page Expired')) {
        errorMessage = 'Session expired. Please try again.';
      }
      
      throw new Error(errorMessage);
    }

    let token = '';
    try {
      const livewireData = JSON.parse(livewireText);
      const effects = livewireData?.components?.[0]?.effects;
      
      if (effects?.redirect) {
        console.log('[API] Found redirect:', effects.redirect);
        const tokenMatch = effects.redirect.match(/forgot-success\/([^/\?]+)/);
        if (tokenMatch && tokenMatch[1]) {
          token = tokenMatch[1];
        }
      }

      const newSnapshot = livewireData?.components?.[0]?.snapshot;
      if (newSnapshot) {
        try {
          const snapParsed = JSON.parse(newSnapshot);
          const errors = snapParsed?.memo?.errors;
          if (errors && Object.keys(errors).length > 0) {
            const firstErrorKey = Object.keys(errors)[0];
            const firstError = errors[firstErrorKey];
            if (Array.isArray(firstError) && firstError.length > 0) {
              throw new Error(firstError[0] as string);
            } else if (typeof firstError === 'string') {
              throw new Error(firstError);
            }
          }
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message && !parseErr.message.includes('JSON')) {
            throw parseErr;
          }
        }
      }

      if (effects?.errors) {
        const errorKeys = Object.keys(effects.errors);
        if (errorKeys.length > 0) {
          const firstError = effects.errors[errorKeys[0]];
          if (Array.isArray(firstError) && firstError.length > 0) {
            throw new Error(firstError[0] as string);
          }
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message && !e.message.includes('JSON')) {
        throw e;
      }
    }

    if (!token) {
      token = 'pending_email_verification';
    }

    console.log('[API] Forgot password email sent successfully');
    return {
      token,
      email,
      message: 'Password reset email sent. Please check your inbox and click the link.',
    };
  }

  async resetPassword(token: string, password: string, passwordConfirmation: string): Promise<LoginResponse> {
    console.log('[API] resetting password with token');

    const deviceName = Platform.OS === 'web' ? 'web app' : `mobile app (${Platform.OS})`;
    const url = `${this.baseUrl}/password/reset`;
    console.log('[API] FULL URL:', url);
    console.log('[API] Method: POST');

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        password,
        password_confirmation: passwordConfirmation,
        device_name: deviceName,
      }),
    });

    console.log('[API] reset-password response status:', response.status);

    const responseText = await response.text();
    console.log('[API] raw reset-password response:', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('[API] reset-password error:', responseText);
      let errorMessage = 'Password reset failed';
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.errors) {
          const firstError = Object.values(errorData.errors)[0];
          if (Array.isArray(firstError) && firstError.length > 0) {
            errorMessage = firstError[0] as string;
          }
        }
      } catch {
        errorMessage = responseText;
      }
      throw new Error(errorMessage);
    }

    const resetData = JSON.parse(responseText);
    console.log('[API] reset-password success:', JSON.stringify(resetData));

    const authToken = resetData?.data?.token;
    const userData = resetData?.data?.user;

    if (!authToken) {
      throw new Error('No token received from password reset');
    }

    console.log('[API] password reset successful, token length:', authToken.length);
    this.setAuthToken(authToken);

    if (userData?.username) {
      this.setUsername(userData.username);
    }
    if (userData?.id) {
      this.setUserId(userData.id);
    }

    return { plainTextToken: authToken, user: userData };
  }

  async logout(): Promise<void> {
    console.log('[API] logging out');

    try {
      await this.post('/auth/logout');
      console.log('[API] logout endpoint called');
    } catch {
      console.log('[API] logout endpoint failed, clearing locally');
    }

    this.setAuthToken(null);
    this.setUserId(null);
    this.setUsername(null);

    console.log('[API] logged out successfully');
  }

  async getAccountSettings(): Promise<any> {
    console.log('[API] fetching account settings');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.get('/settings/account/settings');
  }

  async updateAccountSettings(data: any): Promise<any> {
    console.log('[API] updating account settings');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.put('/settings/account/update', data);
  }

  async getPrivacySettings(): Promise<any> {
    console.log('[API] fetching privacy settings');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.get('/settings/privacy/settings');
  }

  async updatePrivacySettings(data: any): Promise<any> {
    console.log('[API] updating privacy settings');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.put('/settings/privacy/update', data);
  }

  async getPasswordSettings(): Promise<any> {
    console.log('[API] fetching password settings');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.get('/settings/password/settings');
  }

  async updatePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<any> {
    console.log('[API] updating password');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.put('/settings/password/update', {
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: confirmPassword,
    });
  }

  async getSessions(): Promise<any> {
    console.log('[API] fetching sessions');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.get('/settings/sessions');
  }

  async terminateOtherSessions(): Promise<any> {
    console.log('[API] terminating other sessions');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.delete('/settings/sessions/terminate/other');
  }

  async getLanguages(): Promise<any> {
    console.log('[API] fetching languages');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.get('/settings/languages');
  }

  async switchLanguage(language: string): Promise<any> {
    console.log('[API] switching language to:', language);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.put('/settings/languages/switch', { language });
  }

  async updateTheme(theme: 'light' | 'dark'): Promise<any> {
    console.log('[API] updating theme to:', theme);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.put('/settings/account/theme/update', { theme });
  }

  async getAuthorshipStatus(): Promise<any> {
    console.log('[API] fetching authorship status');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.get('/settings/authorship/settings');
  }

  async requestVerification(): Promise<any> {
    console.log('[API] requesting verification');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.post('/settings/authorship/request');
  }

  async uploadPostMedia(file: File | Blob | any, type: 'image' | 'video'): Promise<any> {
    console.log('[API] uploading post media, type:', type);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();
    const fieldName = type === 'image' ? 'image' : 'video';
    formData.append(fieldName, file);

    const endpoint = type === 'image' 
      ? '/post/editor/media/image/upload'
      : '/post/editor/media/video/upload';

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Accept': 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Upload failed:', errorText);
      throw new Error('Failed to upload media');
    }

    return response.json();
  }

  async createPost(data: { content: string; marks?: any }): Promise<any> {
    console.log('[API] creating post');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.post('/post/editor/create', data);
  }

  async deletePostMedia(): Promise<any> {
    console.log('[API] deleting post media');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.delete('/post/editor/media/delete');
  }

  async getNotifications(type: 'all' | 'mentions' | 'important' = 'all'): Promise<any> {
    console.log('[API] fetching notifications:', type);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.get(`/notifications/${type}`);
  }

  async getUnreadNotificationCount(): Promise<any> {
    console.log('[API] fetching unread notification count');
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.get('/notifications/unread/count');
  }

  async deleteNotification(notificationId: string): Promise<any> {
    console.log('[API] deleting notification:', notificationId);
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }
    return this.request('/notifications/delete', {
      method: 'DELETE',
      body: JSON.stringify({ notification_id: notificationId }),
    });
  }
}

const apiService = new ApiService(API_BASE_URL);

export default apiService;
