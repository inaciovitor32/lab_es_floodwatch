import React, { useMemo } from 'react'
import { useState, useEffect, useCallback } from 'react';
import { Platform, Text, View, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Button, FlatList, ListRenderItem, TextInput, Image, useColorScheme } from 'react-native';
import MapView, { Marker, Region, UrlTile, PROVIDER_GOOGLE } from 'react-native-maps'; // Import PROVIDER_GOOGLE
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { User } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, Firestore, CollectionReference, Query, QuerySnapshot, DocumentData } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';

import { db, auth } from '../../firebaseConfig';

const markerTypes: string[] = [
  'Alagamento',
  'Danos à Rede Elétrica',
  'Desmoronamento',
  'Deslizamento',
  'Enxurrada',
  'Queda de Árvore'
];

const markerStyleMap: { [key: string]: { color: string, icon: keyof typeof MaterialIcons.glyphMap } } = {
  'Alagamento': { color: '#007bff', icon: 'water' },
  'Danos à Rede Elétrica': { color: '#ffc107', icon: 'electric-bolt' },
  'Desmoronamento': { color: '#dc3545', icon: 'report' },
  'Deslizamento': { color: '#a0522d', icon: 'terrain' },
  'Enxurrada': { color: '#0056b3', icon: 'storm' },
  'Queda de Árvore': { color: '#28a745', icon: 'forest' },
};

interface FirebaseMarker {
  id: string;
  userId: string;
  type: string;
  latitude: number;
  longitude: number;
  message?: string;
  imageBase64?: string;
  timestamp?: any;
}

interface Cluster {
  id: string;
  isCluster: true;
  latitude: number;
  longitude: number;
  markers: FirebaseMarker[];
  count: number;
}

function isCluster(item: FirebaseMarker | Cluster): item is Cluster {
  return (item as Cluster).isCluster === true;
}

function getDistanceApprox(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dx = lon1 - lon2;
  const dy = lat1 - lat2;
  return Math.sqrt(dx * dx + dy * dy);
}

const CLUSTER_PROXIMITY_THRESHOLD = 0.005;

function clusterMarkers(markers: FirebaseMarker[], distanceThreshold: number): (FirebaseMarker | Cluster)[] {
  if (!markers || markers.length === 0) return [];

  const clusteredMarkers: (FirebaseMarker | Cluster)[] = [];
  const processedMarkerIds = new Set<string>();

  for (let i = 0; i < markers.length; i++) {
    const currentMarker = markers[i];
    if (processedMarkerIds.has(currentMarker.id)) continue;

    const clusterGroup: FirebaseMarker[] = [currentMarker];
    processedMarkerIds.add(currentMarker.id);

    for (let j = i + 1; j < markers.length; j++) {
      const compareMarker = markers[j];
      if (processedMarkerIds.has(compareMarker.id)) continue;

      const distance = getDistanceApprox(
        currentMarker.latitude,
        currentMarker.longitude,
        compareMarker.latitude,
        compareMarker.longitude
      );

      if (distance < distanceThreshold) {
        clusterGroup.push(compareMarker);
        processedMarkerIds.add(compareMarker.id);
      }
    }

    if (clusterGroup.length > 1) {
      let avgLat = 0;
      let avgLon = 0;
      clusterGroup.forEach(m => {
        avgLat += m.latitude;
        avgLon += m.longitude;
      });
      avgLat /= clusterGroup.length;
      avgLon /= clusterGroup.length;

      clusteredMarkers.push({
        id: `cluster_${currentMarker.id}`,
        isCluster: true,
        latitude: avgLat,
        longitude: avgLon,
        markers: clusterGroup,
        count: clusterGroup.length,
      });
    } else {
      clusteredMarkers.push(currentMarker);
    }
  }

  return clusteredMarkers;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export default function Index() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedMarkerType, setSelectedMarkerType] = useState<string | null>(null);
  const [rawMarkers, setRawMarkers] = useState<FirebaseMarker[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loadingMarkers, setLoadingMarkers] = useState<boolean>(true);
  const [addingMarker, setAddingMarker] = useState<boolean>(false);
  const [markerMessage, setMarkerMessage] = useState<string>('');
  const [markerImage, setMarkerImage] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<FirebaseMarker | null>(null);

  const [displayMarkers, setDisplayMarkers] = useState<(FirebaseMarker | Cluster)[]>([]);
  const [clusterModalVisible, setClusterModalVisible] = useState<boolean>(false);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);

  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const handleClusterPress = useCallback((cluster: Cluster) => {
    setSelectedCluster(cluster);
    setClusterModalVisible(true);
  }, []);

  const handleClusterItemPress = useCallback((marker: FirebaseMarker) => {
    setSelectedMarker(marker);
    setClusterModalVisible(false);
    setSelectedCluster(null);
  }, []);

  useEffect(() => {
    async function prepareApp(): Promise<void> {
      if (Platform.OS === 'android' && !Device.isDevice) {
        setErrorMsg('Oops, isso não funciona em emulador Android do Snack. Teste num aparelho real!');
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permissão de localização negada.');
        return;
      }

      try {
        const currentLocation: Location.LocationObject = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
      } catch (locError: any) {
        console.error('Erro ao obter localização:', locError);
        setErrorMsg('Erro ao obter localização.');
      }
    }

    prepareApp();

    const unsubscribeAuth = auth.onAuthStateChanged((firebaseUser: User | null) => {
      console.log('Auth state change:', firebaseUser?.uid);
      setUser(firebaseUser);
      if (!firebaseUser) {
        setRawMarkers([]);
        setDisplayMarkers([]);
        setLoadingMarkers(true);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    let unsubscribeFirestore: () => void = () => { };

    if (user) {
      console.log(`User with UID ${user.uid} is available. Setting up Firestore listener.`);
      setLoadingMarkers(true);
      const markersCollection: CollectionReference<DocumentData> = collection(db as Firestore, 'markers');
      const q: Query<DocumentData> = query(markersCollection, orderBy('timestamp', 'desc'));

      unsubscribeFirestore = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
        console.log('Firestore snapshot received. Docs:', snapshot.docs.length);

        const fetchedMarkers: FirebaseMarker[] = snapshot.docs
          .map(doc => ({
            id: doc.id,
            userId: doc.data().userId,
            type: doc.data().type,
            latitude: doc.data().latitude,
            longitude: doc.data().longitude,
            message: doc.data().message,
            imageBase64: doc.data().imageBase64,
            timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : null,
          }))
          .filter(marker => marker.timestamp && isToday(marker.timestamp));

        setRawMarkers(fetchedMarkers);
        setLoadingMarkers(false);
        console.log('Raw markers state updated:', fetchedMarkers.length);
      }, (firestoreError: Error) => {
        console.error('Erro ao carregar marcadores:', firestoreError);
        setErrorMsg('Erro ao carregar marcadores.');
        setRawMarkers([]);
        setDisplayMarkers([]);
        setLoadingMarkers(false);
      });
    } else {
      console.log('User not available. Clearing markers and showing loading.');
      setRawMarkers([]);
      setDisplayMarkers([]);
      setLoadingMarkers(true);
    }

    return () => {
      console.log('Cleaning up Firestore listener.');
      unsubscribeFirestore();
    };
  }, [user]);

  useEffect(() => {
    console.log('Running clustering logic...');
    const clustered = clusterMarkers(rawMarkers, CLUSTER_PROXIMITY_THRESHOLD);
    setDisplayMarkers(clustered);
    console.log('Clustering complete. Display markers:', clustered.length);
  }, [rawMarkers]);

  async function handleAddMarker(): Promise<void> {
    if (!selectedMarkerType || !user) {
      console.warn('Tentou adicionar marcador sem tipo ou sem usuário autenticado.');
      return;
    }

    setAddingMarker(true);

    try {
      const currentLocation: Location.LocationObject = await Location.getCurrentPositionAsync({});

      const newMarkerData = {
        userId: user.uid,
        type: selectedMarkerType,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        message: markerMessage || '',
        imageBase64: markerImage || '',
        timestamp: new Date(),
      };

      const docRef = await addDoc(collection(db as Firestore, 'markers'), newMarkerData);

      console.log('Marker added successfully with ID:', docRef.id);
      setSelectedMarkerType(null);
      setMarkerMessage('');
      setMarkerImage(null);
      setModalVisible(false);

    } catch (firebaseError: any) {
      console.error('Erro ao adicionar marcador:', firebaseError);
      setErrorMsg(`Erro ao adicionar marcador: ${firebaseError.message || 'Erro desconhecido'}`);
    } finally {
      setAddingMarker(false);
    }
  }

  const renderMarkerTypeItem: ListRenderItem<string> = ({ item }) => {
    const styleInfo = markerStyleMap[item] || { color: 'gray', icon: 'help' };
    const isSelected = selectedMarkerType === item;

    return (
      <TouchableOpacity
        style={[
          styles.markerTypeButton,
          isSelected && styles.selectedMarkerTypeButton,
          addingMarker && styles.markerTypeButtonDisabled
        ]}
        onPress={() => setSelectedMarkerType(item)}
        disabled={addingMarker}
      >
        <View style={styles.markerTypeButtonContent}>
          <MaterialIcons
            name={styleInfo.icon}
            size={20}
            color={isSelected ? 'white' : styleInfo.color}
          />
          <Text style={[
            styles.markerTypeButtonText,
            isSelected && styles.markerTypeButtonTextSelected
          ]}>
            {item}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setMarkerImage(result.assets[0].base64 || null);
    }
  }

  const renderClusterListItem: ListRenderItem<FirebaseMarker> = ({ item }) => {
    const styleInfo = markerStyleMap[item.type] || { color: 'gray', icon: 'help' };
    return (
      <TouchableOpacity style={styles.clusterListItem} onPress={() => handleClusterItemPress(item)}>
        <MaterialIcons name={styleInfo.icon} size={24} color={styleInfo.color} style={styles.clusterListItemIcon} />
        <View style={styles.clusterListItemTextContainer}>
          <Text style={styles.clusterListItemType}>{item.type}</Text>
          {item.message ? <Text style={styles.clusterListItemMessage} numberOfLines={1}>{item.message}</Text> : null}
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#ccc" />
      </TouchableOpacity>
    );
  };

  if (errorMsg) {
    return (
      <View style={styles.centered}>
        <Text style={styles.paragraph}>{errorMsg}</Text>
      </View>
    );
  }

  if (!location || loadingMarkers || !user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.paragraph}>
          {!location ? 'Obtendo localização...' : !user ? 'Autenticando usuário...' : 'Carregando marcadores...'}
        </Text>
      </View>
    );
  }

  const initialMapRegion: Region = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.safeTopBar, isDarkMode && { backgroundColor: '#000000' }]} />
      <View style={styles.container}>
        <MapView
          style={styles.map}
          initialRegion={initialMapRegion}
          showsUserLocation={true}
          toolbarEnabled={false}
          provider={PROVIDER_GOOGLE}
        >
          {displayMarkers.map(item => {
            if (isCluster(item)) {
              return (
                <Marker
                  key={item.id}
                  coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                  onPress={() => handleClusterPress(item)}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.clusterMarkerContainer}>
                    <Text style={styles.clusterMarkerText}>{item.count}</Text>
                  </View>
                </Marker>
              );
            } else {
              const styleInfo = markerStyleMap[item.type] || { color: 'gray', icon: 'help' };
              return (
                <Marker
                  key={item.id}
                  coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                  title={item.type}
                  anchor={{ x: 0.5, y: 1 }}
                  onPress={() => setSelectedMarker(item)}
                >
                  <View style={[styles.customMarkerContainer, { backgroundColor: styleInfo.color }]}>
                    <MaterialIcons
                      name={styleInfo.icon}
                      size={24}
                      color="white"
                    />
                  </View>
                </Marker>
              );
            }
          })}
        </MapView>

        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => {
            setModalVisible(true);
            setSelectedMarkerType(null);
            setMarkerMessage('');
            setMarkerImage(null);
          }}
          disabled={addingMarker}
        >
          {addingMarker ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.floatingButtonText}>+</Text>
          )}
        </TouchableOpacity>

        <Modal
          animationType="fade"
          transparent
          visible={modalVisible}
          onRequestClose={() => {
            if (!addingMarker) {
              setModalVisible(false);
              setSelectedMarkerType(null);
              setMarkerMessage('');
              setMarkerImage(null);
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Reportar Ocorrência</Text>

              <FlatList<string>
                data={markerTypes}
                renderItem={renderMarkerTypeItem}
                keyExtractor={(item) => item}
                numColumns={1}
                contentContainerStyle={{ paddingBottom: 10 }}
              />

              <TextInput
                style={styles.messageInput}
                placeholder="Escreva uma mensagem sobre a ocorrência (opcional)..."
                multiline
                numberOfLines={3}
                value={markerMessage}
                onChangeText={setMarkerMessage}
                editable={!addingMarker}
              />

              <View style={styles.imageSection}>
                <Button title="Selecionar Imagem" onPress={pickImage} disabled={addingMarker} />
                {markerImage && (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${markerImage}` }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                )}
              </View>

              <View style={styles.modalButtons}>
                <Button
                  title="Cancelar"
                  color="#dc3545"
                  onPress={() => {
                    setModalVisible(false);
                    setSelectedMarkerType(null);
                    setMarkerMessage('');
                    setMarkerImage(null);
                  }}
                  disabled={addingMarker}
                />
                <View style={styles.addButtonContainer}>
                  {addingMarker ? (
                    <ActivityIndicator size="small" color="#007bff" />
                  ) : (
                    <Button
                      title="Adicionar"
                      onPress={handleAddMarker}
                      disabled={!selectedMarkerType || addingMarker}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={selectedMarker !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedMarker(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {selectedMarker && (
                <>
                  <Text style={styles.modalTitle}>{selectedMarker.type}</Text>
                  <Text style={styles.paragraph}>{selectedMarker.message || 'Sem mensagem adicionada.'}</Text>
                  {selectedMarker.imageBase64 ? (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${selectedMarker.imageBase64}` }}
                      style={styles.detailImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.noImageText}>Sem imagem adicionada.</Text>
                  )}
                  <View style={styles.modalButtons}>
                    <Button title="Fechar" onPress={() => setSelectedMarker(null)} />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={clusterModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setClusterModalVisible(false);
            setSelectedCluster(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Ocorrências na Região ({selectedCluster?.count})</Text>
              {selectedCluster && (
                <FlatList
                  data={selectedCluster.markers}
                  renderItem={renderClusterListItem}
                  keyExtractor={(item) => item.id}
                  style={styles.clusterList}
                />
              )}
              <View style={styles.modalButtons}>
                <Button
                  title="Fechar"
                  onPress={() => {
                    setClusterModalVisible(false);
                    setSelectedCluster(null);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeTopBar: {
    height: Platform.OS === 'android' ? 30 : 0,
    backgroundColor: 'white',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  paragraph: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 15,
    color: '#6c757d',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  attributionContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: 3,
    borderRadius: 3,
  },
  attributionText: {
    fontSize: 10,
    color: '#333',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#007bff',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  floatingButtonText: {
    color: 'white',
    fontSize: 30,
    lineHeight: 34,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '85%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#343a40',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 25,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  addButtonContainer: {
    minWidth: 80,
    alignItems: 'center',
  },
  markerTypeButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginVertical: 4,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  markerTypeButtonDisabled: {
    opacity: 0.5,
  },
  markerTypeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedMarkerTypeButton: {
    backgroundColor: '#007bff',
    borderColor: '#0056b3',
  },
  markerTypeButtonText: {
    fontSize: 15,
    color: '#212529',
    marginLeft: 10,
    fontWeight: '500',
  },
  markerTypeButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  messageInput: {
    height: 80,
    textAlignVertical: 'top',
    borderColor: '#ced4da',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginVertical: 15,
    fontSize: 15,
    backgroundColor: '#f8f9fa',
  },
  imageSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  detailImage: {
    width: '100%',
    height: 250,
    marginTop: 15,
    marginBottom: 20,
    borderRadius: 8,
  },
  noImageText: {
    fontSize: 15,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  customMarkerContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  clusterMarkerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 99, 71, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  clusterMarkerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  clusterList: {
    maxHeight: 350,
    marginVertical: 10,
  },
  clusterListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  clusterListItemIcon: {
    marginRight: 15,
  },
  clusterListItemTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  clusterListItemType: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  clusterListItemMessage: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
});
