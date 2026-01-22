import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { X, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import colors from '@/constants/colors';
import { useUploadStoryMedia, useCreateStory } from '@/hooks/useApi';

export default function CreateStoryScreen() {
  const [content, setContent] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<any>(null);
  const router = useRouter();

  const uploadMediaMutation = useUploadStoryMedia();
  const createStoryMutation = useCreateStory();

  const isLoading = uploadMediaMutation.isPending || createStoryMutation.isPending;

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage(asset.uri);
      
      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        setImageFile(blob);
      } else {
        setImageFile({
          uri: asset.uri,
          name: 'story.jpg',
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        });
      }
    }
  };

  const handleCreateStory = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image or video for your story');
      return;
    }

    try {
      console.log('[CreateStory] Uploading media...');
      await uploadMediaMutation.mutateAsync(imageFile);
      console.log('[CreateStory] Media uploaded successfully');

      console.log('[CreateStory] Creating story...');
      await createStoryMutation.mutateAsync(content.trim() || undefined);
      console.log('[CreateStory] Story created successfully');

      Alert.alert('Success', 'Story created successfully!');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.error('[CreateStory] Error creating story:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create story. Please try again.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.closeButton}>
          <X color={colors.dark.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        <TouchableOpacity
          onPress={handleCreateStory}
          disabled={isLoading || !selectedImage}
          style={[
            styles.postButton,
            (isLoading || !selectedImage) && styles.postButtonDisabled,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.dark.background} />
          ) : (
            <Text style={styles.postButtonText}>Share</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!selectedImage ? (
          <View style={styles.emptyState}>
            <TouchableOpacity onPress={pickImage} style={styles.addMediaButton}>
              <ImageIcon color={colors.dark.accent} size={48} />
              <Text style={styles.addMediaText}>Tap to add photo or video</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} resizeMode="cover" />
              <TouchableOpacity
                onPress={() => {
                  setSelectedImage(null);
                  setImageFile(null);
                }}
                style={styles.removeImageButton}
              >
                <X color={colors.dark.text} size={20} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textInput}
              placeholder="Add a caption (optional)..."
              placeholderTextColor={colors.dark.textSecondary}
              multiline
              value={content}
              onChangeText={setContent}
              maxLength={200}
            />

            <Text style={styles.charCount}>
              {content.length} / 200
            </Text>
          </>
        )}
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
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  addMediaButton: {
    alignItems: 'center',
    gap: 16,
    padding: 40,
  },
  addMediaText: {
    fontSize: 16,
    color: colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
  imagePreviewContainer: {
    marginTop: 16,
    marginHorizontal: 16,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: 9 / 16,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
  },
  textInput: {
    fontSize: 16,
    color: colors.dark.text,
    padding: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    marginTop: 8,
    marginRight: 16,
    fontSize: 14,
    color: colors.dark.textSecondary,
    textAlign: 'right',
  },
});
