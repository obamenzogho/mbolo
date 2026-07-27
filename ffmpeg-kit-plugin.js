/**
 * Expo config plugin: ffmpeg-kit-plugin
 *
 * Contexte : le paquet officiel `com.arthenica:ffmpeg-kit-*` a été retiré des
 * dépôts Maven le 6 janvier 2025 (binaires supprimés). `ffmpeg-kit-react-native`
 * ne peut donc plus résoudre son artefact natif Android et le build Gradle échoue
 * sur `Could not find com.arthenica:ffmpeg-kit-https:6.0-2`.
 *
 * Solution : rediriger la dépendance native vers le fork communautaire maintenu
 * `JamaisMagic/ffmpeg-kit-16KB`, publié sur Maven Central. Ce fork :
 *   - fournit un AAR complet (classes Java `com.arthenica.ffmpegkit` + libs .so),
 *     donc c'est un drop-in : la couche JS `utils/ffmpeg.ts` reste inchangée.
 *   - est compilé avec le NDK r27 => alignement 16 KB page size, requis par
 *     Google Play pour les nouvelles apps / mises à jour.
 *
 * On garde la variante `full-gpl` car le code utilise libx264 (encodage H.264),
 * qui n'est disponible que dans les variantes GPL.
 *
 * NB : le fork ne publie que des binaires Android. iOS nécessitera une solution
 * distincte (podspec auto-hébergé ou autre) le moment venu.
 */
const { withProjectBuildGradle } = require('@expo/config-plugins');

// Coordonnée Maven Central du fork (variante full-gpl, build 16 KB / NDK r27).
const FORK_ARTIFACT =
  'io.github.jamaismagic.ffmpeg:ffmpeg-kit-main-full-gpl-16kb:6.1.4';

// Variantes de l'ancien paquet retiré susceptibles d'être demandées par
// l'autolinking de ffmpeg-kit-react-native, toutes redirigées vers le fork.
const RETIRED_MODULES = [
  'com.arthenica:ffmpeg-kit-https',
  'com.arthenica:ffmpeg-kit-min',
  'com.arthenica:ffmpeg-kit-min-gpl',
  'com.arthenica:ffmpeg-kit-audio',
  'com.arthenica:ffmpeg-kit-video',
  'com.arthenica:ffmpeg-kit-full',
  'com.arthenica:ffmpeg-kit-full-gpl',
];

const START_MARKER = '// [ffmpeg-kit-plugin] START — redirection vers le fork Maven Central';
const END_MARKER = '// [ffmpeg-kit-plugin] END';

function buildSubstitutionBlock() {
  const substitutions = RETIRED_MODULES.map(
    (mod) =>
      `                substitute module('${mod}') using module('${FORK_ARTIFACT}')`,
  ).join('\n');

  return `
${START_MARKER}
// L'artefact officiel com.arthenica:ffmpeg-kit-* n'existe plus (retiré le 2025-01-06).
// On substitue toute demande par le fork 16 KB publié sur Maven Central.
allprojects {
    configurations.all {
        resolutionStrategy.dependencySubstitution {
${substitutions}
        }
    }
}
${END_MARKER}
`;
}

const withFfmpegKitAndroid = (config) => {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        '[ffmpeg-kit-plugin] Seul le build.gradle Groovy est supporté.',
      );
    }

    let contents = cfg.modResults.contents;

    // Idempotence : retirer un bloc déjà injecté avant de le réécrire.
    const startIdx = contents.indexOf(START_MARKER);
    if (startIdx !== -1) {
      const endIdx = contents.indexOf(END_MARKER);
      if (endIdx !== -1) {
        contents =
          contents.slice(0, startIdx).replace(/\n+$/, '\n') +
          contents.slice(endIdx + END_MARKER.length).replace(/^\n+/, '\n');
      }
    }

    cfg.modResults.contents = contents.replace(/\s*$/, '\n') + buildSubstitutionBlock();
    return cfg;
  });
};

module.exports = (config) => withFfmpegKitAndroid(config);
