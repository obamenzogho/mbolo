import { ScrollView, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BackButton } from '../../src/components/ui/BackButton'
import { colors } from '../../src/lib/theme'

export default function Terms() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <BackButton />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 16 }}>
          Conditions Générales d'Utilisation de Mbolo
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20 }}>
          Dernière mise à jour : 7 juillet 2026 · Version 1.0
        </Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
          Bienvenue sur Mbolo. Les présentes Conditions Générales d'Utilisation (les « CGU ») régissent votre accès et votre utilisation de l'application mobile Mbolo, de ses services associés et de tout contenu qui y est disponible (ensemble, le « Service »). En créant un compte ou en utilisant Mbolo, vous acceptez sans réserve les présentes CGU. Si vous n'êtes pas d'accord, n'utilisez pas le Service.{'\n\n'}

          1. Définitions{'\n'}
          « Mbolo », « nous » : l'éditeur du Service. « Utilisateur », « vous » : toute personne utilisant le Service. « Contenu » : tout texte, vidéo, image, story, reel, commentaire, message, son ou hashtag publié via le Service. « Contenu Utilisateur » : tout Contenu que vous créez ou partagez. « Compte » : votre espace personnel.{'\n\n'}

          2. Éligibilité et âge minimum{'\n'}
          Vous devez avoir au moins 13 ans. Entre 13 et 18 ans (ou l'âge de la majorité applicable), vous déclarez utiliser le Service sous supervision d'un parent ou tuteur ayant accepté les CGU. Interdit si vous avez été banni ou si la loi vous l'interdit. Vous garantissez l'exactitude des informations fournies.{'\n\n'}

          3. Compte et sécurité{'\n'}
          Vous créez un compte avec e-mail, pseudo unique et mot de passe. Vous êtes responsable de la confidentialité de vos identifiants et de toute activité sur votre compte, et devez nous notifier tout accès non autorisé. Un pseudo ne peut être réservé qu'une fois ; nous pouvons récupérer les pseudos inactifs ou usurpant l'identité d'un tiers.{'\n\n'}

          4. Utilisation du Service{'\n'}
          Vous vous engagez à ne pas : (1) publier de contenu illégal, diffamatoire, haineux, violent, pornographique ou incitant à la haine ; (2) publier de contenu impliquant des mineurs de manière inappropriée ; (3) usurper une identité ; (4) collecter les données d'autrui sans consentement (scraping, bots) ; (5) diffuser des logiciels malveillants ; (6) contourner les mesures de sécurité ; (7) faire du spam ou de la publicité non sollicitée ; (8) enfreindre des droits de propriété intellectuelle ; (9) faciliter l'une de ces activités.{'\n\n'}

          5. Contenu Utilisateur{'\n'}
          Vous conservez la propriété de votre Contenu. En le publiant, vous accordez à Mbolo une licence mondiale, non exclusive, gratuite et sous-licenciable pour héberger, stocker, reproduire, adapter techniquement (compression, miniatures), diffuser et afficher ce Contenu, dans le seul but de fournir et promouvoir le Service. Cette licence prend fin à la suppression du Contenu, sous réserve des sauvegardes raisonnables et du contenu déjà republié par d'autres. Vous garantissez détenir tous les droits nécessaires. Les contenus tiers (GIFs Tenor, etc.) restent soumis aux conditions de leurs fournisseurs.{'\n\n'}

          6. Modération et signalement{'\n'}
          Mbolo utilise des outils de modération automatisés et manuels. Vous pouvez signaler tout Contenu ou compte via la fonction intégrée. Nous pouvons, sans y être obligés, masquer, supprimer ou restreindre tout Contenu contraire aux CGU, appliquer une action automatique au-delà d'un seuil de signalements ou pour un motif critique (nudité, violence, automutilation, haine), et suspendre les comptes en infraction, sans préavis lorsque la sécurité l'exige.{'\n\n'}

          7. Propriété intellectuelle de Mbolo{'\n'}
          Le Service, son code, son design, son logo et la marque « Mbolo » (hors Contenu Utilisateur) sont notre propriété exclusive, protégée par le droit de la propriété intellectuelle. Aucun droit ne vous est cédé sauf autorisation écrite.{'\n\n'}

          8. Suppression et résiliation{'\n'}
          Vous pouvez supprimer votre compte à tout moment via Paramètres → Supprimer mon compte (action irréversible). Nous pouvons suspendre ou résilier votre accès, avec ou sans préavis, en cas de violation des CGU, de risque pour la sécurité/légalité du Service, ou d'obligation légale. À la résiliation, votre droit d'usage cesse ; les clauses de propriété intellectuelle, de responsabilité et de droit applicable survivent.{'\n\n'}

          9. Disponibilité{'\n'}
          Le Service est fourni « en l'état » et « selon disponibilité », sans garantie de fonctionnement ininterrompu ou exempt d'erreurs. Nous pouvons le modifier, suspendre ou interrompre à tout moment.{'\n\n'}

          10. Limitation de responsabilité{'\n'}
          Dans les limites de la loi, Mbolo n'est pas responsable des dommages indirects, de la perte de données ou de profits, du Contenu publié par les Utilisateurs, ni des dysfonctionnements des services tiers (Firebase, Cloudinary, Tenor, etc.). Vous utilisez le Service à vos propres risques.{'\n\n'}

          11. Indemnisation{'\n'}
          Vous acceptez d'indemniser Mbolo de toute réclamation ou dépense (frais juridiques raisonnables inclus) découlant de votre utilisation du Service, de votre Contenu ou de votre violation des CGU.{'\n\n'}

          12. Modification des CGU{'\n'}
          Nous pouvons modifier les CGU à tout moment. En cas de changement substantiel, nous vous informerons via le Service ou par e-mail. La poursuite de l'utilisation vaut acceptation.{'\n\n'}

          13. Droit applicable{'\n'}
          Les CGU sont régies par le droit de la République gabonaise. Tout litige relève des tribunaux compétents de Libreville, sous réserve des dispositions impératives protégeant les consommateurs.{'\n\n'}

          14. Contact: support@mbolo.app{'\n\n'}

          Mbolo • Fait avec 🇬🇦 au Gabon
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
