import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export const Camera = ({ style, children }) => (
  <View style={[styles.mockCamera, style]}>
    <Text style={styles.mockText}>Camera desactivee (mode dev)</Text>
    {children}
  </View>
);

export const useCameraDevice = (position = 'back') => ({
  id: 'mock',
  position,
  hasFlash: false,
  hasTorch: false,
});

export const useCameraPermission = () => ({
  hasPermission: true,
  requestPermission: async () => true,
});

export const useMicrophonePermission = () => ({
  hasPermission: true,
  requestPermission: async () => true,
});

export const useFrameProcessor = () => null;

export const MockCameraScreen = ({ navigation }) => {
  const openEditor = (params) => {
    if (navigation?.navigate) {
      navigation.navigate('VideoEditor', params);
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      openEditor({
        mediaUri: result.assets[0].uri,
        mediaType: 'video',
        videoUri: result.assets[0].uri,
      });
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      openEditor({
        mediaUri: result.assets[0].uri,
        mediaType: 'photo',
        photoUri: result.assets[0].uri,
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mockCameraView}>
        <Text style={styles.icon}>DEV</Text>
        <Text style={styles.title}>Mode developpement</Text>
        <Text style={styles.subtitle}>Camera native desactivee</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.btn} onPress={pickVideo}>
          <Text style={styles.btnText}>Choisir une video</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={pickImage}>
          <Text style={styles.btnText}>Choisir une photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockCamera: {
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  mockCameraView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  icon: { color: '#00A86B', fontSize: 40, fontWeight: '800' },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
  },
  buttons: {
    width: '100%',
    padding: 24,
    gap: 12,
  },
  btn: {
    backgroundColor: '#00A86B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  btnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
