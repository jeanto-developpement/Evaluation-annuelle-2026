# Évaluation annuelle – Flo-Fab

Formulaire d'évaluation annuelle en trois temps : l'employé remplit et signe son autoévaluation, un administrateur désigne l'évaluateur et lui transmet son lien, l'évaluateur complète et signe à son tour. Un rapport PDF combiné est ensuite envoyé automatiquement aux administrateurs.

## Contenu du dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | Le formulaire (employé, administrateur et évaluateur, selon le lien ouvert). |
| `config.js` | Configuration côté GitHub : adresse du service Google et année. **Seul fichier à modifier ici.** |
| `apps-script/Code.gs` | Le service Google Apps Script : enregistrement, courriels, PDF. |
| `apps-script/appsscript.json` | Manifeste facultatif du script (fuseau horaire, autorisations). |
| `.nojekyll`, `robots.txt` | Réglages GitHub Pages (pas de traitement Jekyll, pas d'indexation). |

## Fonctionnement

| Étape | Qui | Ce qui se passe |
|---|---|---|
| 1 | Employé | Ouvre la page GitHub, choisit son poste, cote les 18 critères, répond aux questions, signe et date. Aucun courriel ne lui est envoyé. |
| 2 | Automatique | Les réponses sont enregistrées dans la feuille Google. Les administrateurs reçoivent un courriel avec un lien d'assignation. |
| 3 | Administrateur | Ouvre le lien d'assignation et choisit l'évaluateur dans la liste. Le **lien personnel de l'évaluateur s'affiche à l'écran** (bouton **Copier le lien**) : l'administrateur le lui transmet lui-même. **Aucun courriel n'est envoyé à l'évaluateur.** Les administrateurs reçoivent un avis avec le même lien. |
| 4 | Évaluateur | Ouvre le lien reçu de l'administrateur (son nom est déjà inscrit), voit les cotes et réponses de l'employé, cote à son tour, commente, signe et date. |
| 5 | Automatique | Le rapport PDF combiné (cotes côte à côte, écarts, commentaires, deux signatures datées et horodatées) est enregistré dans Google Drive et envoyé **aux administrateurs seulement**. Ni l'employé ni l'évaluateur ne reçoivent de courriel. |

Tant que l'évaluation n'est pas signée, un administrateur peut rouvrir son lien pour retrouver le lien de l'évaluateur ou pour changer d'évaluateur : le lien précédent cesse alors de fonctionner.

Aucune donnée n'est conservée sur GitHub. Les réponses, signatures et PDF restent dans le Google Drive de Flo-Fab.

## Installation (environ 15 minutes)

### 1. Service Google

1. Dans Google Drive, créez une feuille Google nommée **Évaluations annuelles**. Limitez son partage aux RH.
2. Dans la feuille : **Extensions › Apps Script**. Supprimez le code par défaut et collez le contenu de `apps-script/Code.gs`.
3. *(Facultatif)* Dans les paramètres du projet, cochez « Afficher le fichier manifeste appsscript.json » et collez-y le contenu de `apps-script/appsscript.json`.
4. Vérifiez la section `CONFIG` en haut de `Code.gs` :
   - `CLE_ADMIN` : choisissez une clé secrète d'au moins 8 caractères. Elle protège le panneau « Gestion des destinataires » (voir plus bas), qui reste refusé tant qu'elle n'est pas changée.
   - `ADMINISTRATEURS` : jeanto@flofab.com (déjà réglé). Pour en ajouter, inscrivez d'autres courriels dans cette liste. Ils reçoivent les liens d'assignation, les avis de désignation et chaque rapport final.
   - `EVALUATEURS` : Daniel Marullo, Jade Marullo, Kevin Desjardins, Karyna Lapierre, Michael Dugal et Jean To (déjà réglé). Pour ajouter ou retirer un évaluateur, modifiez cette liste (nom → courriel).
   - `COURRIEL_EN_PLUS` *(facultatif)* : autres destinataires du rapport final, par exemple les RH.
   - `LOGO_FICHIER_ID` *(facultatif)* : l'ID d'un logo **PNG** déposé dans Drive, pour l'en-tête du PDF.
5. Enregistrez. Choisissez la fonction `installer` dans la liste, puis **Exécuter**. Acceptez les autorisations (feuille, Drive, envoi de courriels).
6. **Déployer › Nouveau déploiement**, type **Application Web** :
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
7. Copiez l'adresse de l'application Web (elle se termine par `/exec`).

### 2. GitHub Pages

1. Ouvrez `config.js` et remplacez `VOTRE_ID_DE_DEPLOIEMENT` dans `API_URL` par l'adresse copiée à l'étape 1.7 (l'adresse complète, de `https://` jusqu'à `/exec`).
2. Sur GitHub, créez un dépôt (par exemple `evaluation-annuelle`) et téléversez **tout le contenu** de ce dossier à la racine (`index.html`, `config.js`, `robots.txt`, `.nojekyll` et le dossier `apps-script`).
3. **Settings › Pages** : Source = *Deploy from a branch*, branche `main`, dossier `/ (root)`. Enregistrez.
4. Après une minute, la page est en ligne à `https://VOTRE-COMPTE.github.io/evaluation-annuelle/`.

### 3. Relier les deux

1. Dans Apps Script, inscrivez l'adresse de la page GitHub dans `URL_FORMULAIRE` (avec la barre oblique finale).
2. **Déployer › Gérer les déploiements** › crayon › Version : **Nouvelle version** › Déployer. L'adresse `/exec` ne change pas.

> Chaque modification de `Code.gs` demande une **nouvelle version** du déploiement, sinon l'ancienne version reste active.

### 3 bis. Vérifier que tout est prêt (diagnostic)

Dans Apps Script, choisissez la fonction `diagnostic` et cliquez sur **Exécuter**, puis ouvrez **Journal d'exécution**. Vous verrez `TOUT EST PRÊT.` ou la liste de ce qui reste à corriger (`feuille`, `drive`, `courriel`, `url_formulaire`).

Vous pouvez aussi ouvrir dans un navigateur l'adresse `/exec` suivie de `?action=diagnostic` : la page affiche les mêmes vérifications (sans aucun courriel ni donnée).

### 3 ter. Tester l'envoi de courriels

- **Depuis l'éditeur** : exécutez la fonction `testerCourriel`. Elle envoie un courriel de test au premier administrateur et affiche le quota restant dans le journal. La première fois, Google demande d'autoriser l'envoi de courriels : acceptez.
- **Depuis le service déployé** (le test le plus fiable, car c'est ce que les employés utilisent) : ouvrez le panneau « Gestion des destinataires » et cliquez sur **Envoyer un courriel de test aux administrateurs**. La section **État du service** du même panneau affiche en direct si la feuille, Drive, l'envoi de courriels et `URL_FORMULAIRE` sont bons.

### 4. Essai complet avant le lancement

1. Ouvrez la page GitHub et remplissez une autoévaluation de test.
2. Vérifiez que l'administrateur reçoit le courriel « À assigner ».
3. Ouvrez le lien, choisissez un évaluateur : le lien personnel doit s'afficher avec le bouton **Copier le lien**, et l'avis doit arriver aux administrateurs.
4. Ouvrez ce lien, complétez l'évaluation, signez, puis vérifiez que le PDF arrive aux administrateurs.
5. Supprimez les lignes de test dans la feuille et les fichiers de test dans le dossier Drive **Évaluations annuelles – Flo-Fab**.

## Utilisation

- Envoyez simplement le lien GitHub Pages aux employés. Il n'y a pas de code d'accès.
- Le brouillon est conservé dans le navigateur de chaque personne jusqu'à l'envoi.
- Les 18 cotes, la signature, la date et la case de confirmation sont obligatoires pour envoyer.
- Le lien de l'évaluateur est personnel et ne fonctionne qu'une fois. Comme il n'est pas envoyé par courriel, l'administrateur le copie depuis sa page d'assignation (il peut y revenir à tout moment) et le transmet à l'évaluateur.
- La feuille Google sert de registre (statut, dates, horodatages, liens vers les fichiers). Les signatures et les PDF sont dans le dossier Drive **Évaluations annuelles – Flo-Fab**.

## Gérer les destinataires (activer / désactiver)

Un panneau permet aux administrateurs d'activer ou de désactiver, en un clic, les personnes qui reçoivent des courriels.

- **Ouvrir le panneau** : sur la page d'assignation d'un administrateur, cliquez sur **Gestion des destinataires (admin)** et entrez la clé `CLE_ADMIN`. Vous pouvez aussi ouvrir directement `https://VOTRE-COMPTE.github.io/evaluation-annuelle/?admin=VOTRE_CLE`.
- **Administrateur désactivé** : ne reçoit plus les liens d'assignation, les avis ni le rapport final. Au moins un administrateur doit rester actif.
- **Évaluateur désactivé** : n'apparaît plus dans la liste de désignation. Une évaluation déjà assignée à cette personne reste valide.
- Les réglages sont conservés dans le script (propriétés du script) et s'appliquent immédiatement, sans nouveau déploiement.
- Le rôle d'administrateur et le rôle d'évaluateur se règlent séparément, même pour une personne qui a les deux.
- Pour **ajouter** une personne, modifiez `ADMINISTRATEURS` ou `EVALUATEURS` dans `Code.gs` et publiez une nouvelle version.
- La clé apparaît dans l'adresse quand vous ouvrez le panneau : ne partagez pas cette adresse et changez la clé si elle a été diffusée.

## Modifier le contenu

- **Critères** : la liste existe dans `index.html` et dans `apps-script/Code.gs` (`SECTIONS`). Modifiez-la aux deux endroits, puis redéployez une nouvelle version du script.
- **Postes** : la liste existe dans `index.html` et dans `Code.gs` (`POSTES`). Même règle.
- **Année** : `ANNEE_DEFAUT` dans `config.js`.

## Sécurité et confidentialité

- Le dépôt GitHub peut être public : il ne contient ni données ni adresses de courriel de personnes. Les courriels des administrateurs et des évaluateurs restent dans Apps Script.
- Il n'y a pas de code d'accès : toute personne qui connaît l'adresse de la page peut soumettre une autoévaluation. Ne diffusez le lien qu'aux employés.
- Le panneau de gestion est protégé par `CLE_ADMIN`. Choisissez une clé longue et gardez-la pour les administrateurs.
- Les liens d'assignation et d'évaluation contiennent un jeton unique et long. Le lien d'assignation reste entre administrateurs ; le lien d'évaluation ne se transmet qu'à l'évaluateur désigné.
- Les signatures sont dessinées à l'écran, avec attestation, date choisie et horodatage du serveur. Faites valider ce processus de signature électronique par les RH ou le service juridique avant de l'utiliser comme document officiel au dossier de l'employé.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Bandeau « Configuration incomplète » | `API_URL` de `config.js` contient encore `VOTRE_ID_DE_DEPLOIEMENT`. |
| « L'envoi a échoué » avec un message sur le service Google, ou « Unexpected token » / « jeton » | La page a reçu une page d'erreur au lieu de données : l'adresse `/exec` de `config.js` est fausse ou incomplète, le déploiement n'est pas en accès « Tout le monde », les autorisations n'ont pas été acceptées (lancer `installer`), ou la nouvelle version n'a pas été publiée. Faites le test ci-dessous. |
| Rien ne se passe au clic sur « Signer et envoyer » | Un champ obligatoire manque : le formulaire l'encadre en rouge et affiche une bulle rouge en bas de l'écran (nom, poste, les 18 cotes, signature, date, case de confirmation). |
| Bandeau rouge « Le service d'envoi ne répond pas » à l'ouverture de la page | Même cause que le message sur le service Google ci-dessous : reprenez le test `?action=ping` et le diagnostic. |
| Le courriel n'arrive pas (aux administrateurs) | Regardez d'abord les **courriers indésirables** (l'expéditeur est le compte Google qui a déployé le script). Puis cliquez sur « Envoyer un courriel de test » dans le panneau de gestion : si Google refuse, le message exact s'affiche. Causes fréquentes : autorisation d'envoi non accordée (exécutez `testerCourriel`, acceptez, puis publiez une **nouvelle version**), quota atteint (100 par jour avec un compte Gmail gratuit, environ 1 500 avec Google Workspace), adresse mal écrite dans `ADMINISTRATEURS` ou `EVALUATEURS`. |
| Le courriel arrive mais le lien ne fonctionne pas | `URL_FORMULAIRE` dans `Code.gs` n'est pas l'adresse de la page GitHub. Le système refuse maintenant d'enregistrer tant qu'elle est encore à l'état d'exemple. |
| « Le courriel … n'a pas pu être envoyé » | Google a refusé l'envoi (adresse invalide dans `ADMINISTRATEURS` / `EVALUATEURS`, autorisation « envoi de courriels » non accordée, ou quota quotidien atteint). Rien n'est enregistré ni verrouillé : corrigez et réessayez. Lancez `diagnostic` pour voir le quota restant. |
| « Failed to fetch » ou envoi qui échoue | Le déploiement n'est pas en accès « Tout le monde » (un administrateur Google Workspace peut le restreindre), ou l'adresse `/exec` est incomplète. |
| Les liens des courriels ne fonctionnent pas | `URL_FORMULAIRE` est vide, incorrecte ou sans nouvelle version du déploiement. |
| Une modification du script sans effet | Il faut publier une **nouvelle version** du déploiement. |
| « Clé d'administration invalide » ou « n'est pas configurée » | `CLE_ADMIN` dans `Code.gs` est encore `CHANGEZ-MOI`, trop courte (moins de 8 caractères), ou ne correspond pas à celle saisie. Republiez une nouvelle version après l'avoir changée. |
| Erreur au démarrage sur la feuille | Supprimez l'onglet **Évaluations** (créé par une version antérieure) et relancez `installer`. |
| La page GitHub affiche une erreur 404 | Pages n'est pas activé, ou les fichiers ne sont pas à la racine du dépôt. Attendez une minute après l'activation. |

### Tester le service en 30 secondes

Ouvrez dans un navigateur l'adresse `/exec` suivie de `?action=ping`, par exemple :

`https://script.google.com/macros/s/VOTRE_ID/exec?action=ping`

- Vous voyez `{"ok":true,"message":"Le service fonctionne."}` : le service est bon, le problème vient de `config.js` (mauvaise adresse copiée).
- Vous voyez une page Google (connexion, « Impossible d'ouvrir le fichier », erreur de script) : reprenez l'étape 1.6 (accès « Tout le monde », nouvelle version) et l'autorisation avec `installer`.

### Ce que le système fait en cas d'échec

- Si le courriel aux administrateurs échoue, l'autoévaluation n'est **pas** enregistrée : l'employé peut réessayer sans créer de doublon.
- Si l'avis de désignation aux administrateurs échoue, l'assignation reste valide : le lien de l'évaluateur s'affiche quand même à l'écran.
- Si l'envoi du rapport final échoue, l'évaluation n'est **pas** verrouillée : l'évaluateur peut réessayer avec le même lien.
- Si Google n'arrive pas à créer le PDF avec les images (signatures, logo), il produit un rapport sans images plutôt que d'échouer.

## Limites

- Environ 1 500 courriels par jour avec un compte Google Workspace, largement suffisant ici.
- Le PDF est généré par Google ; sa mise en page est volontairement simple.
