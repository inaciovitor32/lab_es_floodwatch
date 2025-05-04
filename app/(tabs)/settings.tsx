import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, useColorScheme } from 'react-native';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';

const COLORS = {
  primary: '#007AFF',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  lightGray: '#f2f2f2',
  darkGray: '#8e8e93',
  white: '#ffffff',
  black: '#000000',
};

export default function Settings() {
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  useEffect(() => {
    checkPermission();
  }, []);

  async function checkPermission() {
    setIsLoading(true);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);
    } catch (error) {
      console.error("Erro ao verificar permissão:", error);
      setPermissionStatus(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function requestPermission() {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
    } catch (error) {
      console.error("Erro ao solicitar permissão:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const renderContent = () => {
    if (isLoading) {
      return <ActivityIndicator size="large" color={COLORS.primary} />;
    }

    const isGranted = permissionStatus === Location.PermissionStatus.GRANTED;
    const statusText = isGranted
      ? 'Permissão de localização concedida!'
      : 'Permissão de localização necessária.';
    const statusColor = isGranted ? COLORS.success : COLORS.warning;
    const iconName = isGranted ? 'check-circle' : 'alert-circle';

    return (
      <>
        <Feather name={iconName} size={60} color={statusColor} style={styles.icon} />

        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusText}
        </Text>

        {!isGranted && (
          <>
            <Text style={styles.infoText}>
              Precisamos da sua localização para fornecer recursos relevantes.
            </Text>
            <TouchableOpacity style={styles.button} onPress={requestPermission} activeOpacity={0.7}>
              <Text style={styles.buttonText}>Solicitar Permissão</Text>
            </TouchableOpacity>
          </>
        )}
      </>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.safeTopBar, isDarkMode && { backgroundColor: '#000000' }]} />
      <View style={styles.container}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    padding: 20,
  },
  safeTopBar: {
    height: Platform.OS === 'android' ? 30 : 0,
    backgroundColor: 'white',
    zIndex: 1,
  },
  icon: {
    marginBottom: 20,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
