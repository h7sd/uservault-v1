const STREAM_API_BASE = 'https://dkmrkrgklonjjibljibg.supabase.co/functions/v1/stream-api';

export interface StreamInfo {
  id: string;
  user_id: string;
  username: string;
  stream_key: string;
  title: string;
  category: string;
  description: string;
  is_live: boolean;
  viewer_count: number;
  started_at: string | null;
  thumbnail_url: string | null;
  rtmp_url: string;
  hls_url: string | null;
  avatar_url?: string;
}

export interface LiveStream {
  id: string;
  user_id: string;
  username: string;
  title: string;
  category: string;
  description: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string | null;
  hls_url: string;
  avatar_url?: string;
}

export interface MobileStreamConfig {
  rtmp_url: string;
  rtmp_full: string;
  whip_url: string;
  stream_key: string;
  hls_url: string;
}

export interface MobileGoLiveResponse {
  success: boolean;
  rtmp_full: string;
  stream_key: string;
  stream_id?: string;
  message?: string;
}

export interface MobileSignupRequest {
  email: string;
  password: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}

export interface MobileSignupResponse {
  success: boolean;
  access_token: string;
  user: {
    username: string;
    display_name: string;
    bio: string;
  };
  streaming: {
    rtmp_full: string;
    stream_key: string;
  };
}

export interface MobileUpdateProfileRequest {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}

export interface MobileUpdateProfileResponse {
  success: boolean;
  user: {
    username: string;
    display_name: string;
    bio: string;
    avatar_url?: string;
  };
}

class StreamingService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    authToken?: string | null
  ): Promise<T> {
    const url = `${STREAM_API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    console.log(`[Streaming] ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const text = await response.text();
    console.log(`[Streaming] Response status: ${response.status}`);
    console.log(`[Streaming] Response: ${text.slice(0, 500)}`);

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = JSON.parse(text);
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // ignore
      }
      throw new Error(errorMessage);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  async getStreamInfo(authToken: string): Promise<StreamInfo> {
    console.log('[Streaming] Getting stream info');
    return this.request<StreamInfo>('/info', { method: 'GET' }, authToken);
  }

  async regenerateStreamKey(authToken: string): Promise<{ stream_key: string }> {
    console.log('[Streaming] Regenerating stream key');
    return this.request<{ stream_key: string }>(
      '/regenerate-key',
      { method: 'POST' },
      authToken
    );
  }

  async startStream(
    authToken: string,
    data: { title: string; category?: string; description?: string }
  ): Promise<StreamInfo> {
    console.log('[Streaming] Starting stream:', data.title);
    return this.request<StreamInfo>(
      '/start',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      authToken
    );
  }

  async stopStream(authToken: string): Promise<{ success: boolean }> {
    console.log('[Streaming] Stopping stream');
    return this.request<{ success: boolean }>(
      '/stop',
      { method: 'POST' },
      authToken
    );
  }

  async getMobileConfig(authToken: string): Promise<MobileStreamConfig> {
    console.log('[Streaming] Getting mobile config');
    return this.request<MobileStreamConfig>('/mobile-config', { method: 'GET' }, authToken);
  }

  async mobileGoLive(
    authToken: string,
    data: { title: string; category?: string; description?: string }
  ): Promise<MobileGoLiveResponse> {
    console.log('[Streaming] Mobile go live:', data.title);
    return this.request<MobileGoLiveResponse>(
      '/mobile-go-live',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      authToken
    );
  }

  async mobileEndStream(authToken: string): Promise<{ success: boolean }> {
    console.log('[Streaming] Mobile end stream');
    return this.request<{ success: boolean }>(
      '/mobile-end-stream',
      { method: 'POST' },
      authToken
    );
  }

  async updateStream(
    authToken: string,
    data: { title?: string; category?: string; description?: string }
  ): Promise<StreamInfo> {
    console.log('[Streaming] Updating stream');
    return this.request<StreamInfo>(
      '/update',
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      authToken
    );
  }

  async getLiveStreams(): Promise<LiveStream[]> {
    console.log('[Streaming] Getting live streams');
    const response = await this.request<{ streams: LiveStream[] } | LiveStream[]>('/live', {
      method: 'GET',
    });
    if (Array.isArray(response)) {
      return response;
    }
    return response.streams || [];
  }

  async getStream(params: { id?: string; username?: string }): Promise<LiveStream | null> {
    console.log('[Streaming] Getting stream:', params);
    const query = params.id ? `?id=${params.id}` : `?username=${params.username}`;
    try {
      return await this.request<LiveStream>(`/get${query}`, { method: 'GET' });
    } catch {
      return null;
    }
  }

  async sendHeartbeat(streamId: string): Promise<void> {
    console.log('[Streaming] Sending heartbeat for stream:', streamId);
    await this.request<void>(
      '/heartbeat',
      {
        method: 'POST',
        body: JSON.stringify({ stream_id: streamId }),
      }
    );
  }

  async validateKey(streamKey: string): Promise<{ valid: boolean; user_id?: string }> {
    console.log('[Streaming] Validating stream key');
    return this.request<{ valid: boolean; user_id?: string }>(
      '/validate-key',
      {
        method: 'POST',
        body: JSON.stringify({ stream_key: streamKey }),
      }
    );
  }

  async mobileSignup(data: MobileSignupRequest): Promise<MobileSignupResponse> {
    console.log('[Streaming] Mobile signup for:', data.email);
    return this.request<MobileSignupResponse>(
      '/mobile-signup',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async mobileUpdateProfile(
    authToken: string,
    data: MobileUpdateProfileRequest
  ): Promise<MobileUpdateProfileResponse> {
    console.log('[Streaming] Mobile update profile');
    return this.request<MobileUpdateProfileResponse>(
      '/mobile-update-profile',
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      authToken
    );
  }

  getRtmpUrl(): string {
    return 'rtmp://stream.uservault.net/live';
  }
}

export const streamingService = new StreamingService();
export default streamingService;
