const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const config = getDefaultConfig(__dirname)

config.resolver.sourceExts.push('glb', 'gltf')

// Native modules unavailable in Expo Go — only usable with dev-client / EAS builds.
// When running in dev mode (IS_DEV_MODE=true), Metro maps these to empty stubs so
// the bundler doesn't crash trying to resolve modules not in node_modules.
// Actual mock implementations are loaded at runtime via config/modules.js.
const DEV_MODE_STUBS = {
  'ffmpeg-kit-react-native': path.resolve(__dirname, 'config/stubs/empty-module.js'),
  'react-native-vision-camera': path.resolve(__dirname, 'config/stubs/empty-module.js'),
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/three/build/three.cjs'),
      type: 'sourceFile',
    }
  }

  // In Expo Go (dev mode), stub out native-only modules so Metro can bundle
  // without them being installed in node_modules.
  if (process.env.IS_DEV_MODE === 'true' && DEV_MODE_STUBS[moduleName]) {
    return {
      type: 'sourceFile',
      filePath: DEV_MODE_STUBS[moduleName],
    }
  }

  return context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: './global.css' })
