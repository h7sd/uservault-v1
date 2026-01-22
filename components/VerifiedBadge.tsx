import React, { useState } from 'react';
import { TouchableOpacity, Modal, View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Calendar, MapPin, CheckCircle2 } from 'lucide-react-native';
import colors from '@/constants/colors';

interface VerifiedBadgeProps {
  size?: number;
  verifiedDate?: string;
  joinedDate?: string;
  location?: string;
}

export default function VerifiedBadge({ size = 20, verifiedDate, joinedDate, location }: VerifiedBadgeProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
    } catch {
      return null;
    }
  };

  const handlePress = () => {
    console.log('[VerifiedBadge] Pressed - verifiedDate:', verifiedDate);
    console.log('[VerifiedBadge] Pressed - joinedDate:', joinedDate);
    console.log('[VerifiedBadge] Pressed - location:', location);
    setModalVisible(true);
  };

  const formattedJoinedDate = formatDate(joinedDate);
  const formattedVerifiedDate = formatDate(verifiedDate);
  
  console.log('[VerifiedBadge] Formatted joinedDate:', formattedJoinedDate);
  console.log('[VerifiedBadge] Formatted verifiedDate:', formattedVerifiedDate);

  return (
    <>
      <TouchableOpacity 
        onPress={handlePress}
        style={{ width: size, height: size }}
        activeOpacity={0.7}
      >
        <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
          <Path
            d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"
            fill="#1D9BF0"
          />
        </Svg>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                {formattedVerifiedDate && (
                  <View style={styles.infoRow}>
                    <CheckCircle2 color={"#1D9BF0"} size={20} />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Verified</Text>
                      <Text style={styles.infoValue}>{formattedVerifiedDate}</Text>
                    </View>
                  </View>
                )}

                {formattedJoinedDate && (
                  <View style={styles.infoRow}>
                    <Calendar color={colors.dark.textSecondary} size={20} />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Date joined</Text>
                      <Text style={styles.infoValue}>{formattedJoinedDate}</Text>
                    </View>
                  </View>
                )}

                {location && (
                  <View style={styles.infoRow}>
                    <MapPin color={colors.dark.textSecondary} size={20} />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Account based in</Text>
                      <Text style={styles.infoValue}>{location}</Text>
                    </View>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    minWidth: 280,
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 14,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.dark.textSecondary,
    fontWeight: '500' as const,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: colors.dark.text,
    fontWeight: '600' as const,
  },
});
