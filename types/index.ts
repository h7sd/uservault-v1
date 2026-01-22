export interface User {
  id: number;
  username: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  avatar?: string;
  cover?: string;
  bio?: string;
  website?: string;
  location?: string;
  country?: string;
  gender?: string;
  ip_address?: string;
  verified?: boolean;
  verified_at?: string;
  type: 'author' | 'reader';
  followers_count: number;
  following_count: number;
  posts_count: number;
  created_at: string;
  last_seen?: string;
  is_temporary?: boolean;
}

export interface Post {
  id: number;
  hash_id: string;
  content: string;
  type: 'text' | 'media' | 'poll';
  text_language?: string;
  relations: {
    user: {
      id: number;
      username: string;
      first_name?: string;
      last_name?: string;
      avatar_url: string;
      verified: boolean;
    };
    reactions?: any[];
    comments?: {
      id: number;
      user: {
        avatar_url: string;
      };
    }[];
    media?: {
      id: number;
      source_url: string;
      type: 'IMAGE' | 'VIDEO';
      thumbnail_url?: string;
      extension?: string;
      metadata?: {
        duration?: number;
        is_portrait?: boolean;
      };
      lqip_base64?: string;
    }[];
  };
  views_count: {
    raw: number;
    formatted: string;
  };
  comments_count: {
    raw: number;
    formatted: string;
  };
  date: {
    iso: string;
    time_ago: string;
    timestamp: number;
  };
  meta: {
    permissions: {
      can_like: boolean;
      can_comment: boolean;
      can_edit: boolean;
      can_delete: boolean;
      can_report: boolean;
    };
    activity: {
      bookmarked: boolean;
    };
    is_sensitive: boolean;
    is_ai_generated: boolean;
  };
}

export interface Media {
  id: number;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  duration?: number;
}

export interface StoryFrame {
  id: number;
  type: 'IMAGE' | 'VIDEO';
  content?: string;
  media?: {
    url: string;
    thumbnail_url?: string;
  };
  duration_seconds: number;
  views_count: {
    raw: number;
    formatted: string;
  };
  date?: {
    time_ago: string;
  };
  activity?: {
    is_seen: boolean;
  };
}

export interface Story {
  story_uuid: string;
  content?: string;
  is_seen: boolean;
  is_owner: boolean;
  expires_at?: string;
  relations: {
    user: {
      name: string;
      avatar_url: string;
    };
    frames?: StoryFrame[];
  };
  views_count?: number;
}

export interface Product {
  id: number;
  seller_id: number;
  seller: User;
  title: string;
  description: string;
  price: number;
  currency: string;
  category_id: number;
  category: Category;
  images: string[];
  condition?: 'new' | 'like_new' | 'used';
  status: 'active' | 'inactive' | 'sold';
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'product' | 'job';
  parent_id?: number;
  usage_count: number;
}

export interface Job {
  id: number;
  employer_id: number;
  employer: User;
  title: string;
  description: string;
  category_id: number;
  category: Category;
  salary_min?: number;
  salary_max?: number;
  currency: string;
  location?: string;
  type?: 'full_time' | 'part_time' | 'contract' | 'freelance';
  status: 'active' | 'closed';
  applications_count: number;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  user_id: number;
  user: User;
  post_id: number;
  content: string;
  likes_count: number;
  created_at: string;
  liked?: boolean;
}

export interface Notification {
  id: number;
  type: string;
  data: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

export interface Chat {
  id: number;
  chat_id?: string;
  type?: 'private' | 'group';
  participants: User[];
  chat_info?: {
    id?: number;
    name: string;
    username?: string;
    avatar_url: string;
    verified?: boolean;
    is_group?: boolean;
    members_count?: number;
  };
  last_message?: Message | {
    content: string;
    created_at: string;
  };
  messages?: Message[];
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  chat_id: number | string | null;
  user_id: number;
  user: User;
  content: string;
  media?: string;
  created_at: string;
  read_at?: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
