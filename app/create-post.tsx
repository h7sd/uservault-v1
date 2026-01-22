import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Image as ImageIcon, Video as VideoIcon } from 'lucide-react-native';

import colors from '@/constants/colors';
import { useCreatePost, useUploadPostImage, useUploadPostVideo } from '@/hooks/useApi';

export default function CreatePostScreen() {
  const [content, setContent] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<any>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{ mediaUri?: string; mediaType?: string }>();

  useEffect(() => {
    const loadPassedMedia = async () => {
      if (params.mediaUri && params.mediaType) {
        setSelectedImage(params.mediaUri);
        setMediaType(params.mediaType as 'image' | 'video');
        
        if (Platform.OS === 'web') {
          try {
            const response = await fetch(params.mediaUri);
            const blob = await response.blob();
            setImageFile(blob);
          } catch (e) {
            console.log('[CreatePost] Failed to load media blob:', e);
          }
        } else {
          const extension = params.mediaType === 'video' ? 'mp4' : 'jpg';
          const mimeType = params.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
          setImageFile({
            uri: params.mediaUri,
            name: `media.${extension}`,
            type: mimeType,
          });
        }
      }
    };
    loadPassedMedia();
  }, [params.mediaUri, params.mediaType]);

  const createPostMutation = useCreatePost();
  const uploadImageMutation = useUploadPostImage();
  const uploadVideoMutation = useUploadPostVideo();

  const isLoading = createPostMutation.isPending || uploadImageMutation.isPending || uploadVideoMutation.isPending;



  const handleCreatePost = async () => {
    if (!content.trim() && !selectedImage) {
      Alert.alert('Error', 'Please add some content or an image');
      return;
    }

    try {
      console.log('[CreatePost] Creating post with content:', content);

      if (imageFile && mediaType) {
        if (mediaType === 'image') {
          console.log('[CreatePost] Uploading image first...');
          await uploadImageMutation.mutateAsync(imageFile);
          console.log('[CreatePost] Image uploaded successfully');
        } else if (mediaType === 'video') {
          console.log('[CreatePost] Uploading video first...');
          await uploadVideoMutation.mutateAsync(imageFile);
          console.log('[CreatePost] Video uploaded successfully');
        }
      }

      console.log('[CreatePost] Creating post...');
      await createPostMutation.mutateAsync({
        content: content.trim(),
        marks: {
          is_ai_generated: false,
          is_sensitive: false,
        },
      });

      console.log('[CreatePost] Post created successfully');
      Alert.alert('Success', 'Post created successfully!');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.error('[CreatePost] Error creating post:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create post. Please try again.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.closeButton}>
          <X color={colors.dark.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity
          onPress={handleCreatePost}
          disabled={isLoading || (!content.trim() && !selectedImage)}
          style={[
            styles.postButton,
            (isLoading || (!content.trim() && !selectedImage)) && styles.postButtonDisabled,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.dark.background} />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TextInput
          style={styles.textInput}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.dark.textSecondary}
          multiline
          value={content}
          onChangeText={setContent}
          autoFocus
          maxLength={2000}
        />

        {selectedImage && (
          <View style={styles.imagePreviewContainer}>
            {mediaType === 'video' ? (
              <View style={styles.videoPreview}>
                <VideoIcon color={colors.dark.text} size={64} />
                <Text style={styles.videoPreviewText}>Video selected</Text>
              </View>
            ) : (
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} resizeMode="cover" />
            )}
            <TouchableOpacity
              onPress={() => {
                setSelectedImage(null);
                setImageFile(null);
                setMediaType(null);
              }}
              style={styles.removeImageButton}
            >
              <X color={colors.dark.text} size={20} />
            </TouchableOpacity>
          </View>
        )}



        <Text style={styles.charCount}>
          {content.length} / 2000
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.dark.text,
  },
  postButton: {
    backgroundColor: colors.dark.accent,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: colors.dark.background,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  textInput: {
    fontSize: 16,
    color: colors.dark.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  imagePreviewContainer: {
    marginTop: 16,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  videoPreview: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: colors.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  videoPreviewText: {
    fontSize: 16,
    color: colors.dark.text,
    fontWeight: '600' as const,
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
  },
  actions: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
    paddingTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  actionText: {
    fontSize: 16,
    color: colors.dark.text,
    fontWeight: '500' as const,
  },
  charCount: {
    marginTop: 16,
    fontSize: 14,
    color: colors.dark.textSecondary,
    textAlign: 'right',
  },
});
