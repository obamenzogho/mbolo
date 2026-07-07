import { ScrollView, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BackButton } from '../../src/components/ui/BackButton'
import { colors } from '../../src/lib/theme'

export default function Privacy() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <BackButton />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 16 }}>
          Politique de Confidentialité de Mbolo
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20 }}>
          Dernière mise à jour : 7 juillet 2026 · Version 1.0
        </Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
          La présente Politique décrit comment Mbolo collecte, utilise, partage et protège vos données personnelles. En utilisant Mbolo, vous acceptez ces pratiques.{'\n\n'}

          1. Données collectées{'\n'}
          Fournies par vous : e-mail, pseudo, mot de passe (chiffré par notre prestataire d'authentification), photo de profil, bio ; Contenu Utilisateur (vidéos, stories, images, commentaires, messages privés, hashtags, republications) ; communications (support, signalements).{'\n\n'}
          Collectées automatiquement : interactions (likes, saves, vues, abonnements), données techniques (appareil, OS, identifiants, journaux d'erreurs/plantage), jeton de notification push (Expo), diagnostics de performance.{'\n\n'}
          Nous n'exigeons ni numéro de téléphone, ni localisation GPS précise, ni vos contacts, sauf partage explicite de votre part.{'\n\n'}

          2. Finalités{'\n'}
          Créer et gérer votre compte ; fournir les fonctionnalités (fil, messagerie, notifications) ; personnaliser l'expérience (tendances, découverte) ; assurer la sécurité et la modération ; vous notifier de votre activité ; diagnostiquer les pannes et améliorer le Service ; respecter nos obligations légales.{'\n\n'}

          3. Base légale{'\n'}
          Exécution du contrat (fourniture du Service), consentement (notifications, contenus optionnels), intérêt légitime (sécurité, modération, amélioration), obligations légales. Vous pouvez retirer votre consentement à tout moment.{'\n\n'}

          4. Partage et sous-traitants{'\n'}
          Nous ne vendons pas vos données. Nous les partageons avec les prestataires nécessaires au Service :{'\n\n'}
          Google Firebase : authentification, base de données, stockage, fonctions serveur.{'\n'}
          Cloudinary : hébergement et diffusion des vidéos/images.{'\n'}
          Tenor (Google) : fourniture de GIFs (requêtes de recherche).{'\n'}
          Sentry : suivi des erreurs et performances (journaux techniques).{'\n'}
          Expo : envoi des notifications push (jeton).{'\n\n'}
          Ces prestataires peuvent traiter vos données hors de votre pays, avec des garanties appropriées. Nous pouvons aussi divulguer vos données si la loi l'exige ou pour protéger nos droits et la sécurité des utilisateurs.{'\n\n'}

          5. Contenu public{'\n'}
          Sont publics par nature : pseudo, photo de profil, bio, vidéos, stories, commentaires, compteurs d'abonnés et de likes. En mode Compte privé, seuls vos abonnés approuvés voient vos vidéos. Les messages privés ne sont visibles que par les participants.{'\n\n'}

          6. Conservation{'\n'}
          Vos données sont conservées tant que votre compte est actif. À la suppression du compte : données personnelles, vidéos, stories, commentaires, messages, notifications et réservation de pseudo sont supprimés, ainsi que votre compte d'authentification. Des sauvegardes résiduelles peuvent subsister brièvement avant effacement définitif. Le contenu déjà republié par d'autres peut persister. Certaines données peuvent être conservées si la loi l'impose.{'\n\n'}

          7. Vos droits{'\n'}
          Accès, rectification (via votre profil), suppression (Paramètres → Supprimer mon compte), portabilité (Télécharger mes données), opposition et limitation, retrait du consentement. Pour les exercer : support@mbolo.app. Réponse dans les délais légaux.{'\n\n'}

          8. Sécurité{'\n'}
          Chiffrement des communications (HTTPS/TLS), authentification sécurisée, règles d'accès strictes aux bases de données, accès restreint du personnel. Aucun système n'étant infaillible, la sécurité absolue ne peut être garantie ; en cas de violation affectant vos droits, nous vous informerons conformément à la loi.{'\n\n'}

          9. Protection des mineurs{'\n'}
          Mbolo n'est pas destiné aux moins de 13 ans. Nous ne collectons pas sciemment leurs données et supprimerons tout compte concerné.{'\n\n'}

          10. Cache et stockage local{'\n'}
          L'app utilise un stockage local pour les performances et vos préférences (mode sombre, économie de données). Vous pouvez vider ce cache dans les Paramètres.{'\n\n'}

          11. Modifications{'\n'}
          Nous pouvons mettre à jour cette Politique ; en cas de changement substantiel, information via le Service ou e-mail.{'\n\n'}

          12. Contact: support@mbolo.app · Responsable du traitement : Mbolo, Libreville, Gabon.{'\n\n'}

          Mbolo • Fait avec 🇬🇦 au Gabon
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
