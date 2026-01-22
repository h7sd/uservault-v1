import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { 
  Platform, 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Lock, 
  Eye, 
  Globe, 
  HelpCircle, 
  Shield, 
  Palette, 
  CheckCircle,
  Users,
  X,
  ChevronRight,
} from 'lucide-react-native';

import colors from '@/constants/colors';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
  disabled?: boolean;
}

function SettingItem({ icon, title, subtitle, onPress, showArrow = true, rightElement, disabled }: SettingItemProps) {
  return (
    <TouchableOpacity 
      style={[styles.settingItem, disabled && styles.settingItemDisabled]}
      onPress={onPress}
      disabled={!onPress || disabled}
      activeOpacity={0.7}
    >
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          {icon}
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement || (showArrow && onPress && <ChevronRight color={colors.dark.textSecondary} size={20} />)}
    </TouchableOpacity>
  );
}

export default function ModalScreen() {
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    account_privacy: false,
    email_privacy: false,
    phone_privacy: false,
    birthdate_privacy: false,
    country_privacy: false,
    city_privacy: false,
    mentions: true,
    followers: true,
    direct_messages: true,
    story_replies: true,
    group_invites: true,
    payment_transfers: true,
  });
  
  const [verificationStatus, setVerificationStatus] = useState<'not_requested' | 'pending' | 'authorized'>('not_requested');
  const [sessions, setSessions] = useState<any[]>([]);
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    loadSettings().catch((error) => {
      console.error('[Settings] Failed to load settings on mount:', error);
    });
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      console.log('[Settings] Loading settings...');
      
      const [privacy, authorship, sessionsData] = await Promise.all([
        api.getPrivacySettings().catch((err) => {
          console.log('[Settings] Privacy settings fetch failed:', err);
          return null;
        }),
        api.getAuthorshipStatus().catch((err) => {
          console.log('[Settings] Authorship fetch failed:', err);
          return null;
        }),
        api.getSessions().catch((err) => {
          console.log('[Settings] Sessions fetch failed:', err);
          return null;
        }),
      ]);

      console.log('[Settings] Privacy response:', privacy);

      if (privacy?.data) {
        const privacyData = privacy.data;
        setPrivacySettings({
          account_privacy: privacyData.account_privacy ?? false,
          email_privacy: privacyData.email_privacy ?? false,
          phone_privacy: privacyData.phone_privacy ?? false,
          birthdate_privacy: privacyData.birthdate_privacy ?? false,
          country_privacy: privacyData.country_privacy ?? false,
          city_privacy: privacyData.city_privacy ?? false,
          mentions: privacyData.mentions ?? true,
          followers: privacyData.followers ?? true,
          direct_messages: privacyData.direct_messages ?? true,
          story_replies: privacyData.story_replies ?? true,
          group_invites: privacyData.group_invites ?? true,
          payment_transfers: privacyData.payment_transfers ?? true,
        });
        console.log('[Settings] Privacy settings loaded successfully');
      } else {
        console.log('[Settings] No privacy data received, using defaults');
      }

      if (authorship?.data?.status) {
        setVerificationStatus(authorship.data.status);
        console.log('[Settings] Verification status:', authorship.data.status);
      }

      if (sessionsData?.data) {
        const sessions = Array.isArray(sessionsData.data) ? sessionsData.data : [];
        setSessions(sessions);
        console.log('[Settings] Sessions loaded:', sessions.length);
      }
    } catch (error) {
      console.error('[Settings] Failed to load settings:', error);
    } finally {
      setLoading(false);
      console.log('[Settings] Loading complete');
    }
  };

  const updatePrivacySetting = async (key: keyof typeof privacySettings, value: boolean) => {
    const previousSettings = { ...privacySettings };
    const newSettings = { ...privacySettings, [key]: value };
    setPrivacySettings(newSettings);

    try {
      console.log('[Settings] Updating privacy setting:', key, '=', value);
      console.log('[Settings] Sending all settings:', newSettings);
      await api.updatePrivacySettings(newSettings);
      console.log('[Settings] Privacy setting updated successfully');
    } catch (error) {
      console.error('[Settings] Failed to update privacy:', error);
      setPrivacySettings(previousSettings);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to update privacy settings';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleRequestVerification = async () => {
    if (verificationStatus === 'authorized') {
      Alert.alert('Already Verified', 'Your account is already verified!');
      return;
    }

    if (verificationStatus === 'pending') {
      Alert.alert('Pending', 'Your verification request is already pending.');
      return;
    }

    Alert.alert(
      'Request Verification',
      'Do you want to request account verification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: async () => {
            try {
              await api.requestVerification();
              setVerificationStatus('pending');
              Alert.alert('Success', 'Verification request submitted!');
            } catch (error) {
              console.error('[Settings] Failed to request verification:', error);
              Alert.alert('Error', 'Failed to submit verification request');
            }
          },
        },
      ]
    );
  };

  const handleTerminateOtherSessions = () => {
    Alert.alert(
      'Terminate Other Sessions',
      'This will log you out of all other devices. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Terminate',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.terminateOtherSessions();
              Alert.alert('Success', 'All other sessions have been terminated');
              loadSettings();
            } catch (error) {
              console.error('[Settings] Failed to terminate sessions:', error);
              Alert.alert('Error', 'Failed to terminate sessions');
            }
          },
        },
      ]
    );
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (passwordForm.new !== passwordForm.confirm) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (passwordForm.new.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setPasswordLoading(true);
    try {
      await api.updatePassword(passwordForm.current, passwordForm.new, passwordForm.confirm);
      Alert.alert('Success', 'Password updated successfully');
      setShowPasswordModal(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (error) {
      console.error('[Settings] Failed to update password:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const getVerificationText = () => {
    switch (verificationStatus) {
      case 'authorized':
        return 'Verified';
      case 'pending':
        return 'Pending';
      default:
        return 'Not verified';
    }
  };

  const getVerificationColor = () => {
    switch (verificationStatus) {
      case 'authorized':
        return colors.dark.accent;
      case 'pending':
        return '#FFA500';
      default:
        return colors.dark.textSecondary;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.dark.accent} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon={<CheckCircle color={getVerificationColor()} size={20} />}
                title="Verification"
                subtitle={getVerificationText()}
                onPress={verificationStatus !== 'authorized' ? handleRequestVerification : undefined}
                showArrow={verificationStatus !== 'authorized'}
              />
              <SettingItem
                icon={<Shield color={colors.dark.accent} size={20} />}
                title="Change Password"
                subtitle="Update your password"
                onPress={() => setShowPasswordModal(true)}
              />
              <SettingItem
                icon={<Users color={colors.dark.accent} size={20} />}
                title="Active Sessions"
                subtitle={`${sessions.length} active sessions`}
                onPress={sessions.length > 1 ? handleTerminateOtherSessions : undefined}
                showArrow={sessions.length > 1}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon={<Lock color={colors.dark.accent} size={20} />}
                title="Private Account"
                subtitle="Only approved followers can see your posts"
                showArrow={false}
                rightElement={
                  <Switch
                    value={privacySettings.account_privacy}
                    onValueChange={(value) => updatePrivacySetting('account_privacy', value)}
                    trackColor={{ false: colors.dark.border, true: colors.dark.accent }}
                  />
                }
              />
              <SettingItem
                icon={<Eye color={colors.dark.accent} size={20} />}
                title="Hide Email"
                subtitle="Keep your email private"
                showArrow={false}
                rightElement={
                  <Switch
                    value={privacySettings.email_privacy}
                    onValueChange={(value) => updatePrivacySetting('email_privacy', value)}
                    trackColor={{ false: colors.dark.border, true: colors.dark.accent }}
                  />
                }
              />
              <SettingItem
                icon={<Eye color={colors.dark.accent} size={20} />}
                title="Hide Phone"
                subtitle="Keep your phone private"
                showArrow={false}
                rightElement={
                  <Switch
                    value={privacySettings.phone_privacy}
                    onValueChange={(value) => updatePrivacySetting('phone_privacy', value)}
                    trackColor={{ false: colors.dark.border, true: colors.dark.accent }}
                  />
                }
              />
              <SettingItem
                icon={<Eye color={colors.dark.accent} size={20} />}
                title="Hide Birthday"
                subtitle="Keep your birthday private"
                showArrow={false}
                rightElement={
                  <Switch
                    value={privacySettings.birthdate_privacy}
                    onValueChange={(value) => updatePrivacySetting('birthdate_privacy', value)}
                    trackColor={{ false: colors.dark.border, true: colors.dark.accent }}
                  />
                }
              />
              <SettingItem
                icon={<Globe color={colors.dark.accent} size={20} />}
                title="Hide Country"
                subtitle="Keep your country private"
                showArrow={false}
                rightElement={
                  <Switch
                    value={privacySettings.country_privacy}
                    onValueChange={(value) => updatePrivacySetting('country_privacy', value)}
                    trackColor={{ false: colors.dark.border, true: colors.dark.accent }}
                  />
                }
              />
              <SettingItem
                icon={<Globe color={colors.dark.accent} size={20} />}
                title="Hide City"
                subtitle="Keep your city private"
                showArrow={false}
                rightElement={
                  <Switch
                    value={privacySettings.city_privacy}
                    onValueChange={(value) => updatePrivacySetting('city_privacy', value)}
                    trackColor={{ false: colors.dark.border, true: colors.dark.accent }}
                  />
                }
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon={<Palette color={colors.dark.accent} size={20} />}
                title="Theme"
                subtitle="Dark mode"
                disabled
              />
              <SettingItem
                icon={<Globe color={colors.dark.accent} size={20} />}
                title="Language"
                subtitle="English"
                disabled
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            <View style={styles.sectionContent}>
              <SettingItem
                icon={<HelpCircle color={colors.dark.accent} size={20} />}
                title="Help Center"
                subtitle="Get help and support"
                disabled
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>USER VAULT v1.0.0</Text>
            <Text style={styles.footerSubtext}>@{currentUser?.username || 'user'}</Text>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)} style={styles.closeButton}>
                <X color={colors.dark.text} size={24} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordForm.current}
                  onChangeText={(text) => setPasswordForm({ ...passwordForm, current: text })}
                  secureTextEntry
                  placeholder="Enter current password"
                  placeholderTextColor={colors.dark.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordForm.new}
                  onChangeText={(text) => setPasswordForm({ ...passwordForm, new: text })}
                  secureTextEntry
                  placeholder="Enter new password"
                  placeholderTextColor={colors.dark.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordForm.confirm}
                  onChangeText={(text) => setPasswordForm({ ...passwordForm, confirm: text })}
                  secureTextEntry
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.dark.textSecondary}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, passwordLoading && styles.submitButtonDisabled]}
                onPress={handleChangePassword}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <ActivityIndicator size="small" color={colors.dark.background} />
                ) : (
                  <Text style={styles.submitButtonText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: colors.dark.text,
    letterSpacing: -0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.dark.textSecondary,
    paddingHorizontal: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: colors.dark.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.dark.border,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  settingItemDisabled: {
    opacity: 0.5,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.dark.text,
  },
  settingSubtitle: {
    fontSize: 13,
    color: colors.dark.textSecondary,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    color: colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
  footerSubtext: {
    fontSize: 12,
    color: colors.dark.textSecondary,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.dark.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.dark.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.dark.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.dark.text,
  },
  submitButton: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.dark.background,
  },
});
