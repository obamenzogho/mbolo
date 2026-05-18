const fs = require('fs');
const path = require('path');
const {
  withPlugins,
  withDangerousMod,
  withAppBuildGradle,
  withProjectBuildGradle,
} = require('@expo/config-plugins');
const {
  mergeContents,
} = require('@expo/config-plugins/build/utils/generateCode');

function patchFfmpegPodspec(projectRoot) {
  const podspecPath = path.join(
    projectRoot,
    'node_modules',
    'ffmpeg-kit-react-native',
    'ffmpeg-kit-react-native.podspec',
  );
  if (fs.existsSync(podspecPath)) {
    let content = fs.readFileSync(podspecPath, 'utf-8');
    const patched = content.replace(
      "s.default_subspec   = 'https'",
      "s.default_subspec   = 'full-gpl'",
    );
    if (patched !== content) {
      fs.writeFileSync(podspecPath, patched, 'utf-8');
      console.log('[ffmpeg-kit-plugin] Patched default_subspec to full-gpl');
    }
  }
}

function addFfmpegHooks(podfileContent) {
  const marker = '# [ffmpeg-kit-plugin] hooks';
  if (podfileContent.includes(marker)) {
    return podfileContent;
  }

  const podDeclarations = `
${marker}
# Override ffmpeg-kit-ios-full-gpl with custom podspec (community-hosted binaries)
pod 'ffmpeg-kit-ios-full-gpl', :podspec => './ffmpeg-kit-ios-full-gpl.podspec'
# Explicitly select the full-gpl subspec, overriding the default 'https' subspec
pod 'ffmpeg-kit-react-native', :path => '../node_modules/ffmpeg-kit-react-native', :subspecs => ['full-gpl']
`;

  // Insert pod declarations BEFORE post_install (inside the target block)
  podfileContent = podfileContent.replace(
    /\n(\s+post_install do \|installer\|)/,
    podDeclarations + '$1',
  );

  // Add Swift concurrency fix inside the existing post_install hook
  podfileContent = podfileContent.replace(
    /(\n\s+\)\n)(\s+end\n\s+end\n)/,
    `$1
    # [ffmpeg-kit-plugin] Disable Swift 6 strict concurrency warnings (Xcode 26+)
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
      end
    end
$2`,
  );

  return podfileContent;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const withFfmpegKitIos = (config, { iosUrl }) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const { platformProjectRoot } = cfg.modRequest;

      patchFfmpegPodspec(projectRoot);

      const podspecFile = path.join(
        platformProjectRoot,
        'ffmpeg-kit-ios-full-gpl.podspec',
      );
      const podspec = `
Pod::Spec.new do |s|
    s.name             = 'ffmpeg-kit-ios-full-gpl'
    s.version          = '6.0'
    s.summary          = 'Custom full-gpl FFmpegKit iOS frameworks'
    s.homepage         = 'https://github.com/arthenica/ffmpeg-kit'
    s.license          = { :type => 'LGPL' }
    s.author           = { 'NooruddinLakhani' => 'https://github.com/NooruddinLakhani' }
    s.platform         = :ios, '12.1'
    s.static_framework = true

    s.source           = { :http => '${iosUrl}' }

    s.vendored_frameworks = [
      'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libswscale.xcframework',
      'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libswresample.xcframework',
      'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libavutil.xcframework',
      'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libavformat.xcframework',
      'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libavfilter.xcframework',
      'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libavdevice.xcframework',
      'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/libavcodec.xcframework',
      'ffmpeg-kit-ios-full-gpl-latest/ffmpeg-kit-ios-full-gpl/6.0-80adc/ffmpegkit.xcframework'
    ]
end
`;
      fs.writeFileSync(podspecFile, podspec);

      const podfilePath = path.join(platformProjectRoot, 'Podfile');
      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      podfileContent = addFfmpegHooks(podfileContent);
      fs.writeFileSync(podfilePath, podfileContent, 'utf-8');

      return cfg;
    },
  ]);
};

const withFfmpegKitAndroid = (config, { androidUrl }) => {
  config = withAppBuildGradle(config, (cfg) => {
    let buildGradle = cfg.modResults.contents;

    const appFlatDirRepo = `
    repositories {
        flatDir {
            dirs "${'$'}{projectDir}/../libs"
        }
    }`;

    if (!buildGradle.includes("dirs \"${'$'}{projectDir}/../libs\"")) {
      buildGradle = mergeContents({
        tag: 'ffmpeg-kit-app-flatdir-repo',
        src: buildGradle,
        newSrc: appFlatDirRepo,
        anchor: /android\s*\{/,
        offset: 1,
        comment: '//',
      }).contents;
    }

    const newDependencies = `
    implementation(name: 'ffmpeg-kit-full-gpl', ext: 'aar')
    implementation 'com.arthenica:smart-exception-java:0.2.1'`;
    if (!buildGradle.includes("name: 'ffmpeg-kit-full-gpl', ext: 'aar'")) {
      buildGradle = mergeContents({
        tag: 'ffmpeg-kit-dependencies',
        src: buildGradle,
        newSrc: newDependencies,
        anchor: /dependencies\s*\{/,
        offset: 1,
        comment: '//',
      }).contents;
    }

    const excludeConfig = `
    configurations.all {
        exclude group: 'com.arthenica', module: 'ffmpeg-kit-https'
        exclude group: 'com.arthenica', module: 'ffmpeg-kit-min'
        exclude group: 'com.arthenica', module: 'ffmpeg-kit-audio'
        exclude group: 'com.arthenica', module: 'ffmpeg-kit-video'
        exclude group: 'com.arthenica', module: 'ffmpeg-kit-full'
        exclude group: 'com.arthenica', module: 'ffmpeg-kit-full-gpl'
    }`;

    if (!buildGradle.includes('configurations.all')) {
      buildGradle = mergeContents({
        tag: 'ffmpeg-kit-exclude-config',
        src: buildGradle,
        newSrc: excludeConfig,
        anchor: /android\s*\{/,
        offset: -1,
        comment: '//',
      }).contents;
    }

    const downloadBlock = `
def aarUrl = '${androidUrl}'
def aarFile = file("\${projectDir}/../libs/ffmpeg-kit-full-gpl.aar")

if (!aarFile.parentFile.exists()) {
    aarFile.parentFile.mkdirs()
}

if (!aarFile.exists()) {
    println "[ffmpeg-kit] Downloading AAR from \$aarUrl..."
    try {
        new URL(aarUrl).withInputStream { i ->
            aarFile.withOutputStream { it << i }
        }
        println "[ffmpeg-kit] AAR downloaded successfully"
    } catch (Exception e) {
        println "[ffmpeg-kit] Failed to download AAR: \${e.message}"
    }
}

afterEvaluate {
    tasks.register("downloadAar") {
        description = "Downloads ffmpeg-kit AAR file"
        group = "ffmpeg-kit"
        outputs.file(aarFile)
        doLast {
            if (!aarFile.exists()) {
                println "[ffmpeg-kit] Downloading AAR from \$aarUrl..."
                new URL(aarUrl).withInputStream { i ->
                    aarFile.withOutputStream { it << i }
                }
                println "[ffmpeg-kit] AAR downloaded successfully"
            }
        }
    }
    preBuild.dependsOn("downloadAar")
}`;

    if (!buildGradle.includes('def aarUrl =')) {
      buildGradle = buildGradle + '\n' + downloadBlock;
    }

    cfg.modResults.contents = buildGradle;
    return cfg;
  });

  config = withProjectBuildGradle(config, (cfg) => {
    let buildGradle = cfg.modResults.contents;

    const projectFlatDirLibsPath = '$rootDir/libs';
    const flatDirString = `        flatDir {\n            dirs "${projectFlatDirLibsPath}"\n        }`;
    const allProjectsRepositoriesRegex =
      /(allprojects\s*\{\s*repositories\s*\{)/;
    const existingFlatDirRegex = new RegExp(
      `allprojects\\s*\\{[\\s\\S]*?repositories\\s*\\{[\\s\\S]*?flatDir\\s*\\{[\\s\\S]*?dirs\\s*['"]${projectFlatDirLibsPath.replace(
        /[$.]/g,
        '\\$&',
      )}['"]`,
    );

    if (!buildGradle.match(existingFlatDirRegex)) {
      const match = buildGradle.match(allProjectsRepositoriesRegex);
      if (match) {
        const insertionPoint = match.index + match[0].length;
        buildGradle =
          buildGradle.substring(0, insertionPoint) +
          '\n' +
          flatDirString +
          buildGradle.substring(insertionPoint);
      }
    }

    cfg.modResults.contents = buildGradle;
    return cfg;
  });

  return config;
};

module.exports = (config, options = {}) => {
  const { iosUrl, androidUrl } = options;

  if (!iosUrl) {
    throw new Error(
      'FFmpeg Kit plugin requires "iosUrl" option',
    );
  }

  if (!androidUrl) {
    throw new Error(
      'FFmpeg Kit plugin requires "androidUrl" option',
    );
  }

  return withPlugins(config, [
    (config) => withFfmpegKitIos(config, { iosUrl }),
    (config) => withFfmpegKitAndroid(config, { androidUrl }),
  ]);
};
