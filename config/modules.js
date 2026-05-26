import { IS_DEV_MODE } from './devMode';

export const getCameraModule = () => {
  if (IS_DEV_MODE) {
    return require('../mocks/VisionCameraMock');
  }
  return require('react-native-vision-camera');
};

export const getFFmpegModule = () => {
  if (IS_DEV_MODE) {
    return require('../mocks/FFmpegMock');
  }
  return require('../utils/ffmpeg');
};

export const getCameraScreen = () => {
  if (IS_DEV_MODE) {
    const { MockCameraScreen } = require('../mocks/VisionCameraMock');
    return MockCameraScreen;
  }
  return require('../app/(tabs)/camera').default;
};
