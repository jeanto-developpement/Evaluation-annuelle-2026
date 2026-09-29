# Évaluation annuelle – Flo-Fab

Formulaire d'évaluation annuelle en trois temps : l'employé remplit et signe son autoévaluation, un administrateur désigne l'évaluateur, l'évaluateur complète et signe à son tour. Un rapport PDF combiné est ensuite envoyé automatiquement.

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
| 2 | Automatique | Les réponses sont enregistrées dans la feuille Google. Les 3 administrateurs reçoivent un courriel avec un lien d'assignation. |
| 3 | Administrateur | Ouvre le lien d'assignation et choisit l'évaluateur dans la liste. L'évaluateur reçoit aussitôt son lien personnel, et les administrateurs sont avisés. |
| 4 | Évaluateur | Ouvre son lien (son nom est déjà inscrit), voit les cotes et réponses de l'employé, cote à son tour, commente, signe et date. |
| 5 | Automatique | Le rapport PDF combiné (cotes côte à côte, écarts, commentaires, deux signatures datées et horodatées) est enregistré dans Google Drive et envoyé à l'évaluateur, avec copie aux administrateurs. |

Tant que l'évaluation n'est pas signée, un administrateur peut rouvrir son lien pour changer d'évaluateur : le lien précédent cesse alors de fonctionner.

Aucune donnée n'est conservée sur GitHub. Les réponses, signatures et PDF restent dans le Google Drive de Flo-Fab.

## Installation (environ 15 minutes)

### 1. Service Google

1. Dans Google Drive, créez une feuille Google nommée **Évaluations annuelles**. Limitez son partage aux RH.
2. Dans la feuille : **Extensions › Apps Script**. Supprimez le code par défaut et collez le contenu de `apps-script/Code.gs`.
3. *(Facultatif)* Dans les paramètres du projet, cochez « Afficher le fichier manifeste appsscript.json » et collez-y le contenu de `apps-script/appsscript.json`.
4. Vérifiez la section `CONFIG` en haut de `Code.gs` :
   - `ADMINISTRATEURS` : michaeldugal@, jeanto@ et karynalapierre@flofab.com (déjà réglé). Ils reçoivent les liens d'assignation et une copie de chaque rapport final.
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

### 4. Essai complet avant le lancement

1. Ouvrez la page GitHub et remplissez une autoévaluation de test.
2. Vérifiez que les 3 administrateurs reçoivent le courriel « À assigner ».
3. Ouvrez le lien, choisissez un évaluateur (vous-même pour le test) et vérifiez qu'il reçoit son lien.
4. Complétez l'évaluation, signez, puis vérifiez que le PDF arrive à l'évaluateur, avec copie aux administrateurs.
5. Supprimez les lignes de test dans la feuille et les fichiers de test dans le dossier Drive **Évaluations annuelles – Flo-Fab**.

## Utilisation

- Envoyez simplement le lien GitHub Pages aux employés. Il n'y a pas de code d'accès.
- Le brouillon est conservé dans le navigateur de chaque personne jusqu'à l'envoi.
- Les 18 cotes, la signature, la date et la case de confirmation sont obligatoires pour envoyer.
- Le lien de l'évaluateur est personnel et ne fonctionne qu'une fois.
- La feuille Google sert de registre (statut, dates, horodatages, liens vers les fichiers). Les signatures et les PDF sont dans le dossier Drive **Évaluations annuelles – Flo-Fab**.

## Modifier le contenu

- **Critères** : la liste existe dans `index.html` et dans `apps-script/Code.gs` (`SECTIONS`). Modifiez-la aux deux endroits, puis redéployez une nouvelle version du script.
- **Postes** : la liste existe dans `index.html` et dans `Code.gs` (`POSTES`). Même règle.
- **Année** : `ANNEE_DEFAUT` dans `config.js`.

## Sécurité et confidentialité

- Le dépôt GitHub peut être public : il ne contient ni données ni adresses de courriel de personnes. Les courriels des administrateurs et des évaluateurs restent dans Apps Script.
- Il n'y a pas de code d'accès : toute personne qui connaît l'adresse de la page peut soumettre une autoévaluation. Ne diffusez le lien qu'aux employés.
- Les liens d'assignation et d'évaluation contiennent un jeton unique et long. Ne les transférez pas.
- Les signatures sont dessinées à l'écran, avec attestation, date choisie et horodatage du serveur. Faites valider ce processus de signature électronique par les RH ou le service juridique avant de l'utiliser comme document officiel au dossier de l'employé.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Bandeau « Configuration incomplète » | `API_URL` de `config.js` contient encore `VOTRE_ID_DE_DEPLOIEMENT`. |
| « Failed to fetch » ou envoi qui échoue | Le déploiement n'est pas en accès « Tout le monde » (un administrateur Google Workspace peut le restreindre), ou l'adresse `/exec` est incomplète. |
| Les liens des courriels ne fonctionnent pas | `URL_FORMULAIRE` est vide, incorrecte ou sans nouvelle version du déploiement. |
| Une modification du script sans effet | Il faut publier une **nouvelle version** du déploiement. |
| Erreur au démarrage sur la feuille | Supprimez l'onglet **Évaluations** (créé par une version antérieure) et relancez `installer`. |
| La page GitHub affiche une erreur 404 | Pages n'est pas activé, ou les fichiers ne sont pas à la racine du dépôt. Attendez une minute après l'activation. |

## Limites

- Environ 1 500 courriels par jour avec un compte Google Workspace, largement suffisant ici.
- Le PDF est généré par Google ; sa mise en page est volontairement simple.
