import type { User, Post, Story } from '@/types';

export const currentUser: User = {
  id: 1,
  username: 'fynn',
  name: 'Fynn',
  email: 'admin@uservault.net',
  avatar: 'https://i.pravatar.cc/150?img=12',
  bio: 'DEV/ADMIN on uservault.net ~ German ~ 21',
  verified: true,
  type: 'author',
  followers_count: 1243,
  following_count: 432,
  posts_count: 89,
  created_at: '2026-01-15T00:00:00Z',
};

export const users: User[] = [
  {
    id: 2,
    username: 'leon',
    name: 'Leon',
    email: 'leon@example.com',
    avatar: 'https://i.pravatar.cc/150?img=13',
    verified: false,
    type: 'reader',
    followers_count: 523,
    following_count: 234,
    posts_count: 45,
    created_at: '2026-01-14T00:00:00Z',
  },
  {
    id: 3,
    username: 'desmond',
    name: 'Desmond',
    email: 'desmond@example.com',
    avatar: 'https://i.pravatar.cc/150?img=14',
    verified: true,
    type: 'author',
    followers_count: 892,
    following_count: 567,
    posts_count: 67,
    created_at: '2026-01-13T00:00:00Z',
  },
  {
    id: 4,
    username: 'theo',
    name: 'theo nta',
    email: 'theo@example.com',
    avatar: 'https://i.pravatar.cc/150?img=15',
    verified: false,
    type: 'reader',
    followers_count: 324,
    following_count: 189,
    posts_count: 34,
    created_at: '2026-01-12T00:00:00Z',
  },
];

export const stories: Story[] = [
  {
    story_uuid: '550e8400-e29b-41d4-a716-446655440001',
    is_seen: false,
    is_owner: false,
    relations: {
      user: {
        name: 'Fynn',
        avatar_url: 'https://i.pravatar.cc/150?img=12',
      },
    },
    views_count: 0,
    expires_at: '2026-01-16T00:00:00Z',
  },
  {
    story_uuid: '550e8400-e29b-41d4-a716-446655440002',
    is_seen: false,
    is_owner: false,
    relations: {
      user: {
        name: 'Leon',
        avatar_url: 'https://i.pravatar.cc/150?img=13',
      },
    },
    views_count: 0,
    expires_at: '2026-01-16T00:00:00Z',
  },
  {
    story_uuid: '550e8400-e29b-41d4-a716-446655440003',
    is_seen: true,
    is_owner: false,
    relations: {
      user: {
        name: 'Desmond',
        avatar_url: 'https://i.pravatar.cc/150?img=14',
      },
    },
    views_count: 0,
    expires_at: '2026-01-16T00:00:00Z',
  },
  {
    story_uuid: '550e8400-e29b-41d4-a716-446655440004',
    is_seen: false,
    is_owner: false,
    relations: {
      user: {
        name: 'theo nta',
        avatar_url: 'https://i.pravatar.cc/150?img=15',
      },
    },
    views_count: 0,
    expires_at: '2026-01-16T00:00:00Z',
  },
];

export const posts: Post[] = [
  {
    id: 1,
    hash_id: 'abc123xyz1',
    content: 'Just launched USER VAULT! Check out this amazing platform for social networking and e-commerce. 🚀',
    type: 'media',
    relations: {
      user: {
        id: 3,
        username: 'desmond',
        first_name: 'Desmond',
        last_name: '',
        avatar_url: 'https://i.pravatar.cc/150?img=14',
        verified: true,
      },
      media: [
        {
          id: 1,
          source_url: 'https://picsum.photos/600/600?random=10',
          type: 'IMAGE',
        },
      ],
    },
    views_count: { raw: 1234, formatted: '1.2K' },
    comments_count: { raw: 45, formatted: '45' },
    date: {
      iso: '2026-01-15T10:00:00Z',
      time_ago: '5h ago',
      timestamp: 1737802800,
    },
    meta: {
      permissions: {
        can_like: true,
        can_comment: true,
        can_edit: false,
        can_delete: false,
        can_report: true,
      },
      activity: {
        bookmarked: false,
      },
      is_sensitive: false,
      is_ai_generated: false,
    },
  },
  {
    id: 2,
    hash_id: 'abc123xyz2',
    content: 'Beautiful sunset today in Germany 🌅',
    type: 'media',
    relations: {
      user: {
        id: 2,
        username: 'leon',
        first_name: 'Leon',
        last_name: '',
        avatar_url: 'https://i.pravatar.cc/150?img=13',
        verified: false,
      },
      media: [
        {
          id: 2,
          source_url: 'https://picsum.photos/600/600?random=11',
          type: 'IMAGE',
        },
      ],
    },
    views_count: { raw: 856, formatted: '856' },
    comments_count: { raw: 23, formatted: '23' },
    date: {
      iso: '2026-01-15T07:00:00Z',
      time_ago: '8h ago',
      timestamp: 1737792000,
    },
    meta: {
      permissions: {
        can_like: true,
        can_comment: true,
        can_edit: false,
        can_delete: false,
        can_report: true,
      },
      activity: {
        bookmarked: true,
      },
      is_sensitive: false,
      is_ai_generated: false,
    },
  },
  {
    id: 3,
    hash_id: 'abc123xyz3',
    content: 'Working on some exciting new features for the marketplace! Stay tuned 💼',
    type: 'text',
    relations: {
      user: {
        id: 4,
        username: 'theo',
        first_name: 'theo',
        last_name: 'nta',
        avatar_url: 'https://i.pravatar.cc/150?img=15',
        verified: false,
      },
    },
    views_count: { raw: 489, formatted: '489' },
    comments_count: { raw: 12, formatted: '12' },
    date: {
      iso: '2026-01-15T04:00:00Z',
      time_ago: '11h ago',
      timestamp: 1737781200,
    },
    meta: {
      permissions: {
        can_like: true,
        can_comment: true,
        can_edit: false,
        can_delete: false,
        can_report: true,
      },
      activity: {
        bookmarked: false,
      },
      is_sensitive: false,
      is_ai_generated: false,
    },
  },
  {
    id: 4,
    hash_id: 'abc123xyz4',
    content: 'Admin life: reviewing 162 users and counting! This platform is growing fast 📈',
    type: 'media',
    relations: {
      user: {
        id: 1,
        username: 'fynn',
        first_name: 'Fynn',
        last_name: '',
        avatar_url: 'https://i.pravatar.cc/150?img=12',
        verified: true,
      },
      media: [
        {
          id: 3,
          source_url: 'https://picsum.photos/600/600?random=12',
          type: 'IMAGE',
        },
      ],
    },
    views_count: { raw: 2445, formatted: '2.4K' },
    comments_count: { raw: 78, formatted: '78' },
    date: {
      iso: '2026-01-14T12:00:00Z',
      time_ago: '1d ago',
      timestamp: 1737723600,
    },
    meta: {
      permissions: {
        can_like: true,
        can_comment: true,
        can_edit: true,
        can_delete: true,
        can_report: false,
      },
      activity: {
        bookmarked: true,
      },
      is_sensitive: false,
      is_ai_generated: false,
    },
  },
];
