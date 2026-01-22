import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { 
  User,
  Post, 
  Story, 
  Product, 
  Job, 
  Comment,
  Notification,
  Chat,
  Message,
  PaginatedResponse,
  Category
} from '@/types';

type AnyRecord = Record<string, unknown>;

function extractPaginatedData<T>(response: unknown): PaginatedResponse<T> {
  if (!response || typeof response !== 'object') {
    return { data: [], current_page: 1, last_page: 1, per_page: 15, total: 0 };
  }

  const res = response as AnyRecord;
  
  if (Array.isArray(res)) {
    return { data: res as T[], current_page: 1, last_page: 1, per_page: res.length, total: res.length };
  }

  if (Array.isArray(res.data)) {
    return {
      data: res.data as T[],
      current_page: typeof res.current_page === 'number' ? res.current_page : 1,
      last_page: typeof res.last_page === 'number' ? res.last_page : 1,
      per_page: typeof res.per_page === 'number' ? res.per_page : 15,
      total: typeof res.total === 'number' ? res.total : (res.data as T[]).length,
    };
  }

  if (res.pagination && Array.isArray((res.pagination as AnyRecord).data)) {
    const pagination = res.pagination as AnyRecord;
    return {
      data: pagination.data as T[],
      current_page: typeof pagination.current_page === 'number' ? pagination.current_page : 1,
      last_page: typeof pagination.last_page === 'number' ? pagination.last_page : 1,
      per_page: typeof pagination.per_page === 'number' ? pagination.per_page : 15,
      total: typeof pagination.total === 'number' ? pagination.total : (pagination.data as T[]).length,
    };
  }

  if (res.posts && Array.isArray(res.posts)) {
    return { data: res.posts as T[], current_page: 1, last_page: 1, per_page: (res.posts as T[]).length, total: (res.posts as T[]).length };
  }

  if (res.items && Array.isArray(res.items)) {
    return { data: res.items as T[], current_page: 1, last_page: 1, per_page: (res.items as T[]).length, total: (res.items as T[]).length };
  }

  console.log('[useApi] Could not extract paginated data from:', Object.keys(res));
  return { data: [], current_page: 1, last_page: 1, per_page: 15, total: 0 };
}

function extractArrayData<T>(response: unknown): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response as T[];
  
  const res = response as AnyRecord;
  if (Array.isArray(res.data)) return res.data as T[];
  if (Array.isArray(res.stories)) return res.stories as T[];
  if (Array.isArray(res.items)) return res.items as T[];
  
  console.log('[useApi] Could not extract array data from:', typeof response === 'object' ? Object.keys(res) : typeof response);
  return [];
}

export function usePosts(page: number = 1) {
  return useQuery({
    queryKey: ['posts', page],
    queryFn: async () => {
      console.log('[useApi] Fetching posts page:', page);
      const response = await api.get<unknown>('/posts', { page });
      console.log('[useApi] Posts response:', JSON.stringify(response).slice(0, 500));
      return extractPaginatedData<Post>(response);
    },
  });
}

export function usePost(id: number) {
  return useQuery({
    queryKey: ['posts', id],
    queryFn: () => api.get<Post>(`/posts/${id}`),
    enabled: !!id,
  });
}

export function useTimeline(page: number = 1) {
  const { isLoading: authLoading, authToken } = useAuth();

  return useQuery({
    queryKey: ['timeline', page],
    queryFn: async () => {
      console.log('[useApi] Fetching timeline page:', page);

      const endpoints = ['/timeline', '/posts'];

      for (const endpoint of endpoints) {
        try {
          const response = await api.get<unknown>(endpoint, { page });
          console.log(`[useApi] ${endpoint} response:`, JSON.stringify(response).slice(0, 500));
          const result = extractPaginatedData<Post>(response);
          if (result.data.length > 0) {
            return result;
          }
        } catch (e) {
          console.log(`[useApi] ${endpoint} failed:`, e);
        }
      }

      return { data: [], current_page: 1, last_page: 1, per_page: 15, total: 0 };
    },
    enabled: !authLoading && !!authToken,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useStories() {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      console.log('[useApi] Fetching stories');
      try {
        const response = await api.get<unknown>('/stories');
        console.log('[useApi] Stories response:', JSON.stringify(response).slice(0, 500));
        return extractArrayData<Story>(response);
      } catch (e) {
        console.log('[useApi] Stories fetch failed:', e);
        return [];
      }
    },
    enabled: !authLoading && !!authToken,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useUsers(page: number = 1) {
  return useQuery({
    queryKey: ['users', page],
    queryFn: async () => {
      console.log('[useApi] Fetching users page:', page);
      const response = await api.get<unknown>('/users', { page });
      return extractPaginatedData<User>(response);
    },
  });
}

export function useUser(id: number | string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => api.get<User>(`/users/${id}`),
    enabled: !!id,
  });
}

export function useUserProfile(username: string | null) {
  const { isLoading: authLoading, authToken } = useAuth();
  const apiHasToken = !!api.getAuthToken();
  const isReady = !authLoading && (!!authToken || apiHasToken);

  return useQuery({
    queryKey: ['profile', 'user', username],
    queryFn: async () => {
      console.log('[useApi] Fetching user profile for:', username);
      
      if (!api.getAuthToken()) {
        throw new Error('Not authenticated');
      }

      if (!username) {
        throw new Error('No username provided');
      }

      const response = await api.getProfile(username);
      console.log('[useApi] User profile response received');
      return response;
    },
    enabled: isReady && !!username,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useUserProfilePosts(username: string | null, page: number = 1) {
  const { isLoading: authLoading, authToken } = useAuth();
  const apiHasToken = !!api.getAuthToken();
  const isReady = !authLoading && (!!authToken || apiHasToken);

  return useQuery({
    queryKey: ['profile', 'user', username, 'posts', page],
    queryFn: async () => {
      console.log('[useApi] Fetching user profile posts for:', username);
      
      if (!api.getAuthToken()) {
        throw new Error('Not authenticated');
      }

      if (!username) {
        throw new Error('No username provided');
      }

      const cursor = (page - 1) * 15;
      const response = await api.getProfilePostsByUsername(username, cursor, 'posts');
      console.log('[useApi] User profile posts response:', JSON.stringify(response).slice(0, 500));
      return extractPaginatedData<Post>(response);
    },
    enabled: isReady && !!username,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useUserPosts(userId: number | string, page: number = 1) {
  return useQuery({
    queryKey: ['users', userId, 'posts', page],
    queryFn: async () => {
      console.log('[useApi] Fetching user posts for:', userId);
      const response = await api.get<unknown>(`/users/${userId}/posts`, { page });
      return extractPaginatedData<Post>(response);
    },
    enabled: !!userId,
  });
}

export function useCurrentUserProfile() {
  const { isLoading: authLoading, authToken, currentUser } = useAuth();

  const apiHasToken = !!api.getAuthToken();
  const isReady = !authLoading && (!!authToken || apiHasToken);

  console.log('[useApi] useCurrentUserProfile check:', {
    authLoading,
    hasToken: apiHasToken,
    isReady,
  });

  return useQuery({
    queryKey: ['profile', 'current', currentUser?.id],
    queryFn: async () => {
      console.log('[useApi] Fetching current user profile...');

      if (!api.getAuthToken()) {
        throw new Error('Not authenticated');
      }

      const response = await api.getCurrentUser();
      console.log('[useApi] Profile response received');
      return response;
    },
    enabled: isReady,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useCurrentUserPosts(page: number = 1) {
  const { isLoading: authLoading, authToken, isAuthenticated } = useAuth();
  
  const apiHasToken = !!api.getAuthToken();
  const isReady = !authLoading && (!!authToken || isAuthenticated || apiHasToken);
  
  return useQuery({
    queryKey: ['profile', 'posts', page, api.getUserId()],
    queryFn: async () => {
      console.log('[useApi] Fetching current user posts, page:', page);
      
      if (!api.getAuthToken()) {
        throw new Error('Not authenticated');
      }
      
      const cursor = (page - 1) * 15;
      const response = await api.getCurrentUserPosts(cursor, 'posts');
      console.log('[useApi] Profile posts response:', JSON.stringify(response).slice(0, 500));
      return extractPaginatedData<Post>(response);
    },
    enabled: isReady,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useProducts(page: number = 1, categoryId?: number) {
  return useQuery({
    queryKey: ['products', page, categoryId],
    queryFn: async () => {
      console.log('[useApi] Fetching products page:', page);
      const response = await api.get<unknown>('/marketplace', { 
        page,
        ...(categoryId && { category_id: categoryId })
      });
      return extractPaginatedData<Product>(response);
    },
  });
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => api.get<Product>(`/marketplace/${id}`),
    enabled: !!id,
  });
}

export function useJobs(page: number = 1, categoryId?: number) {
  return useQuery({
    queryKey: ['jobs', page, categoryId],
    queryFn: () => api.get<PaginatedResponse<Job>>('/jobs', {
      page,
      ...(categoryId && { category_id: categoryId })
    }),
  });
}

export function useJob(id: number) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => api.get<Job>(`/jobs/${id}`),
    enabled: !!id,
  });
}

export function useCategories(type?: 'product' | 'job') {
  return useQuery({
    queryKey: ['categories', type],
    queryFn: async () => {
      console.log('[useApi] Fetching categories, type:', type);
      const response = await api.get<unknown>('/categories', type ? { type } : undefined);
      console.log('[useApi] Categories response:', JSON.stringify(response).slice(0, 500));
      return extractArrayData<Category>(response);
    },
  });
}

export function usePostComments(postId: number, page: number = 1) {
  return useQuery({
    queryKey: ['posts', postId, 'comments', page],
    queryFn: () => api.get<PaginatedResponse<Comment>>(`/posts/${postId}/comments`, { page }),
    enabled: !!postId,
  });
}

export function useNotifications(page: number = 1) {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['notifications', page],
    queryFn: async () => {
      console.log('[useApi] Fetching notifications page:', page);
      const response = await api.get<unknown>('/notifications', { page });
      return extractPaginatedData<Notification>(response);
    },
    enabled: !authLoading && !!authToken,
  });
}

export function useChats(page: number = 1) {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['chats', page],
    queryFn: async () => {
      console.log('[useApi] Fetching chats page:', page);
      const response = await api.get<unknown>('/messenger', { page });
      return extractPaginatedData<Chat>(response);
    },
    enabled: !authLoading && !!authToken,
  });
}

export function useChatMessages(chatId: number, page: number = 1) {
  return useQuery({
    queryKey: ['chats', chatId, 'messages', page],
    queryFn: async () => {
      console.log('[useApi] Fetching chat messages for:', chatId);
      const response = await api.get<unknown>(`/messenger/${chatId}/messages`, { page });
      return extractPaginatedData<Message>(response);
    },
    enabled: !!chatId,
  });
}

export function useBookmarkPost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (postId: number) => api.addPostBookmark(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { postId: number; content: string; parentId?: number }) => 
      api.createPostComment(data.postId, data.content, data.parentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', variables.postId, 'comments'] });
    },
  });
}

export function usePostCommentsApi(hashId: string | null, cursor: number = 0) {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['post', hashId, 'comments', cursor],
    queryFn: async () => {
      if (!hashId) throw new Error('No post hash ID');
      console.log('[useApi] Fetching comments for post hashId:', hashId);
      const response = await api.getPostComments(hashId, cursor);
      console.log('[useApi] Comments response:', JSON.stringify(response).slice(0, 500));
      return response;
    },
    enabled: !authLoading && !!authToken && !!hashId,
  });
}

export function useLikeComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { commentId: number; unifiedId?: string }) => 
      api.addCommentReaction(data.commentId, data.unifiedId || '1f44d'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post'] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (commentId: number) => api.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

export function useRecordStoryView() {
  return useMutation({
    mutationFn: (frameId: number) => api.recordStoryView(frameId),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { chatId: number; content: string; media?: string }) => 
      api.post(`/messenger/${data.chatId}/messages`, { 
        content: data.content,
        media: data.media 
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chats', variables.chatId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}

export function useExplorePosts(page: number = 1) {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['explore', 'posts', page],
    queryFn: async () => {
      console.log('[useApi] Fetching explore posts page:', page);
      const response = await api.post<unknown>('/explore/posts', {
        filter: {
          page,
        }
      });
      console.log('[useApi] Explore posts response:', JSON.stringify(response).slice(0, 500));
      return extractPaginatedData<Post>(response);
    },
    enabled: !authLoading && !!authToken,
  });
}

export function useSearchPeople(query: string, page: number = 1) {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['explore', 'people', query, page],
    queryFn: async () => {
      console.log('[useApi] Searching people:', query, 'page:', page);
      const response = await api.post<unknown>('/explore/people', {
        filter: {
          query,
          page,
        }
      });
      console.log('[useApi] Search people response:', JSON.stringify(response).slice(0, 500));
      return extractPaginatedData<User>(response);
    },
    enabled: !authLoading && !!authToken && query.length >= 1,
  });
}

export function useMarketplaceProducts(page: number = 1, categoryId?: number) {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['marketplace', 'products', page, categoryId],
    queryFn: async () => {
      console.log('[useApi] Fetching marketplace products page:', page);
      
      const endpoints = [
        '/marketplace/products',
        '/marketplace',
        '/products',
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await api.get<unknown>(endpoint, {
            page,
            ...(categoryId && { category_id: categoryId }),
          });
          
          if (typeof response === 'string' && response.includes('<!DOCTYPE html>')) {
            console.log(`[useApi] ${endpoint} returned HTML, trying next endpoint...`);
            continue;
          }
          
          console.log('[useApi] Marketplace products response:', JSON.stringify(response).slice(0, 500));
          return extractPaginatedData<Product>(response);
        } catch (e) {
          console.log(`[useApi] ${endpoint} failed:`, e);
        }
      }
      
      console.log('[useApi] All marketplace endpoints failed, returning empty');
      return { data: [], current_page: 1, last_page: 1, per_page: 15, total: 0 };
    },
    enabled: !authLoading && !!authToken,
  });
}

export function useMarketplaceProduct(productId: number) {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['marketplace', 'product', productId],
    queryFn: async () => {
      console.log('[useApi] Fetching marketplace product:', productId);
      const response = await api.get<unknown>(`/marketplace/product/${productId}`);
      console.log('[useApi] Marketplace product response:', JSON.stringify(response).slice(0, 500));
      return response;
    },
    enabled: !authLoading && !!authToken && !!productId,
  });
}

export function useToggleProductBookmark() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (productId: number) => 
      api.post('/bookmarks/product/toggle', { id: productId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

export function useMessengerChats() {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['messenger', 'chats'],
    queryFn: async () => {
      console.log('[useApi] Fetching messenger chats');
      const response = await api.getMessengerChats(0);
      console.log('[useApi] Messenger chats FULL response:', JSON.stringify(response));
      
      if (!response || typeof response !== 'object') {
        console.log('[useApi] Invalid response:', response);
        return { data: [] };
      }
      
      const res = response as any;
      console.log('[useApi] Response keys:', Object.keys(res));
      
      if (Array.isArray(res)) {
        console.log('[useApi] Response is array, length:', res.length);
        return { data: res };
      }
      
      if (Array.isArray(res.data)) {
        console.log('[useApi] Found data array, length:', res.data.length);
        return { data: res.data };
      }
      
      console.log('[useApi] Could not find chats array in response');
      return { data: [] };
    },
    enabled: !authLoading && !!authToken,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useChatMessagesById(chatId: number | null) {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['messenger', 'chat', chatId, 'messages'],
    queryFn: async () => {
      if (!chatId) throw new Error('No chat ID');
      console.log('[useApi] Fetching chat messages for:', chatId);
      const response = await api.get<unknown>(`/messenger/chat/${chatId}/messages`);
      console.log('[useApi] Chat messages response:', JSON.stringify(response).slice(0, 500));
      return extractPaginatedData<Message>(response);
    },
    enabled: !authLoading && !!authToken && !!chatId,
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { chatId: number; message: string }) => 
      api.post(`/messenger/chat/${data.chatId}/send`, { message: data.message }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messenger', 'chat', variables.chatId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['messenger', 'chats'] });
    },
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId: number) => 
      api.post('/messenger/chat/create', { user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messenger', 'chats'] });
    },
  });
}

export function useTimelineApi(cursor: number = 0) {
  const { isLoading: authLoading, authToken } = useAuth();

  return useQuery({
    queryKey: ['timeline', 'feed', cursor],
    queryFn: async () => {
      console.log('[useApi] Fetching timeline feed, cursor:', cursor);
      const response = await api.getTimelineFeed(cursor);
      console.log('[useApi] Timeline feed response:', JSON.stringify(response).slice(0, 500));
      return response;
    },
    enabled: !authLoading && !!authToken,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useStoriesApi() {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['stories', 'feed'],
    queryFn: async () => {
      console.log('[useApi] Fetching stories feed');
      try {
        const response = await api.getStoriesFeed();
        console.log('[useApi] Stories feed response:', JSON.stringify(response).slice(0, 500));
        return response;
      } catch (e) {
        console.log('[useApi] Stories feed fetch failed:', e);
        return { data: [] };
      }
    },
    enabled: !authLoading && !!authToken,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useFollowUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId: number) => {
      console.log('[useApi] useFollowUser - calling toggleFollowUser with userId:', userId);
      return api.toggleFollowUser(userId);
    },
    onSuccess: (data, userId) => {
      console.log('[useApi] useFollowUser - success, invalidating queries');
      console.log('[useApi] Response data:', JSON.stringify(data));
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
    onError: (error) => {
      console.error('[useApi] useFollowUser - error:', error);
    },
  });
}

export function useUnfollowUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId: number) => {
      console.log('[useApi] useUnfollowUser - calling toggleFollowUser with userId:', userId);
      return api.toggleFollowUser(userId);
    },
    onSuccess: (data, userId) => {
      console.log('[useApi] useUnfollowUser - success, invalidating queries');
      console.log('[useApi] Response data:', JSON.stringify(data));
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
    onError: (error) => {
      console.error('[useApi] useUnfollowUser - error:', error);
    },
  });
}

export function useSendMessageToUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { recipientId: number; content: string }) => 
      api.sendMessage(null, data.content, data.recipientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messenger'] });
    },
  });
}

export function useStoryById(storyUuid: string | null) {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['stories', 'story', storyUuid],
    queryFn: async () => {
      if (!storyUuid) throw new Error('No story UUID');
      console.log('[useApi] Fetching story by UUID:', storyUuid);
      const response = await api.getStoryById(storyUuid);
      console.log('[useApi] Story response:', JSON.stringify(response).slice(0, 500));
      return response;
    },
    enabled: !authLoading && !!authToken && !!storyUuid,
  });
}

export function useUploadStoryMedia() {
  return useMutation({
    mutationFn: (file: File | Blob) => api.uploadStoryMedia(file),
  });
}

export function useCreateStory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (content?: string) => api.createStory(content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}

export function useDeleteStoryMedia() {
  return useMutation({
    mutationFn: () => api.deleteStoryMedia(),
  });
}

export function useDeleteStoryFrame() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (frameId: number) => api.deleteStoryFrame(frameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}

export function useLikePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { postId: number; unifiedId: string }) => {
      console.log('[useApi] Adding reaction to post:', data.postId, 'unified:', data.unifiedId);
      
      const response = await api.post('/timeline/post/reaction/add', {
        post_id: data.postId,
        unified_id: data.unifiedId,
      });
      
      console.log('[useApi] Reaction added successfully:', response);
      return response;
    },
    onSuccess: () => {
      console.log('[useApi] Invalidating timeline queries');
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error) => {
      console.error('[useApi] Failed to add reaction:', error);
    },
  });
}

export function useStoryViews(frameId: number | null) {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['stories', 'views', frameId],
    queryFn: async () => {
      if (!frameId) throw new Error('No frame ID');
      console.log('[useApi] Fetching story views for frame:', frameId);
      const response = await api.getStoryViews(frameId);
      console.log('[useApi] Story views response:', JSON.stringify(response).slice(0, 500));
      return extractArrayData<any>(response);
    },
    enabled: !authLoading && !!authToken && !!frameId,
  });
}

export function useUploadPostImage() {
  return useMutation({
    mutationFn: (file: File | Blob | any) => api.uploadPostMedia(file, 'image'),
  });
}

export function useUploadPostVideo() {
  return useMutation({
    mutationFn: (file: File | Blob | any) => api.uploadPostMedia(file, 'video'),
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { content: string; marks?: any }) => api.createPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useDeletePostMedia() {
  return useMutation({
    mutationFn: () => api.deletePostMedia(),
  });
}

export function useFollowers(userId: number | null, cursor: number = 0) {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['followers', userId, cursor],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      console.log('[useApi] Fetching followers for user:', userId);
      const response = await api.getFollowers(userId, cursor);
      console.log('[useApi] Followers response:', JSON.stringify(response).slice(0, 500));
      return extractArrayData<User>(response);
    },
    enabled: !authLoading && !!authToken && !!userId,
  });
}

export function useFollowing(userId: number | null, cursor: number = 0) {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['following', userId, cursor],
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      console.log('[useApi] Fetching following for user:', userId);
      const response = await api.getFollowing(userId, cursor);
      console.log('[useApi] Following response:', JSON.stringify(response).slice(0, 500));
      return extractArrayData<User>(response);
    },
    enabled: !authLoading && !!authToken && !!userId,
  });
}

export function useAcceptFollowRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId: number) => api.acceptFollowRequest(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useNotificationsApi(type: 'all' | 'mentions' | 'important' = 'all') {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['notifications', type],
    queryFn: async () => {
      console.log('[useApi] Fetching notifications:', type);
      try {
        const response = await api.getNotifications(type);
        console.log('[useApi] Notifications response:', JSON.stringify(response).slice(0, 500));
        return response;
      } catch (e) {
        console.log('[useApi] Notifications fetch failed:', e);
        return { data: [] };
      }
    },
    enabled: !authLoading && !!authToken,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useUnreadNotificationCount() {
  const { isLoading: authLoading, authToken } = useAuth();
  
  return useQuery({
    queryKey: ['notifications', 'unread', 'count'],
    queryFn: async () => {
      console.log('[useApi] Fetching unread notification count');
      try {
        const response = await api.getUnreadNotificationCount();
        console.log('[useApi] Unread count response:', JSON.stringify(response));
        return response;
      } catch (e) {
        console.log('[useApi] Unread count fetch failed:', e);
        return { data: { formatted: '0', raw: 0 } };
      }
    },
    enabled: !authLoading && !!authToken,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (notificationId: string) => api.deleteNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
