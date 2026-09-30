/**
 * Flo-Fab – Évaluation annuelle
 * Service Google Apps Script : enregistre les réponses dans la feuille Google,
 * conserve les signatures et les rapports PDF dans Google Drive,
 * et envoie les courriels aux administrateurs et à l’évaluateur (aucun courriel n'est envoyé à l'employé).
 *
 * À installer dans une feuille Google (Extensions > Apps Script).
 */

/* ================= CONFIGURATION ================= */
const CONFIG = {
  // Clé du panneau « Gestion des destinataires » (8 caractères minimum, à garder secrète).
  // Ouvrir : URL_FORMULAIRE + '?admin=' + CLE_ADMIN. Le panneau reste refusé tant que la clé n'est pas changée.
  CLE_ADMIN: '19801980',

  // Administrateurs : reçoivent un lien d'assignation dès qu'un employé envoie son autoévaluation
  // et désignent l'évaluateur (en le choisissant dans la liste EVALUATEURS ci-dessous). Ils reçoivent aussi une copie du rapport final en PDF.
  ADMINISTRATEURS: ['jeanto@flofab.com', 'michaeldugal@flofab.com', 'karynalapierre@flofab.com'],

  // Évaluateurs : nom affiché dans la liste de l'administrateur → courriel (identifiant ; aucun courriel n'est envoyé aux évaluateurs).
  EVALUATEURS: {
    'Daniel Marullo': 'danielmarullo@flofab.com',
    'Jade Marullo': 'jademarullo@flofab.com',
    'Kevin Desjardins': 'kevindesjardins@flofab.com',
    'Karyna Lapierre': 'karynalapierre@flofab.com',
    'Michael Dugal': 'michaeldugal@flofab.com',
    'Jean To': 'jeanto@flofab.com'
  },

  // Facultatif : ID d'une feuille Google existante à utiliser comme registre (sinon créée automatiquement
  // si le script n'est pas lié à une feuille).
  CLASSEUR_ID: '',

  // Facultatif : autres destinataires du rapport final (RH, direction). Séparer par des virgules.
  COURRIEL_EN_PLUS: '',

  // Adresse de la page GitHub Pages (avec la barre oblique finale).
  URL_FORMULAIRE: 'https://VOTRE-COMPTE.github.io/evaluation-annuelle/',

  // Dossier Google Drive créé automatiquement pour les signatures et les PDF.
  NOM_DOSSIER: 'Évaluations annuelles – Flo-Fab',

  // Facultatif : ID d'un fichier PNG du logo dans Google Drive (pour l'en-tête du PDF).
  LOGO_FICHIER_ID: '',

  NOM_EXPEDITEUR: 'Flo-Fab – Ressources humaines'
};
/* ================================================= */

const POSTES = ['Assembleur pompe', 'Assembleur système', 'Soudeur', 'Journalier', 'Peintre', 'M.O.I.'];

// Doit rester identique à la liste de index.html.
const SECTIONS = [
  { t: 'Performance', items: ["Temps d'exécution des tâches", 'Qualité et précision du travail', 'Bon de travail', 'Suivi des procédures', "Recherche l'information", 'Retard et ponctualité', "Jours d'absence au travail", 'Disponibilité'] },
  { t: 'Savoir-faire', items: ['Autonomie et compréhension rapide', 'Débrouillardise', 'Organisation et planification', 'Polyvalence', 'Ordre et propreté'] },
  { t: "Participation au succès de l'entreprise", items: ['Partage des connaissances et entraide', 'Idées et amélioration'] },
  { t: "Travail d'équipe et participation au succès de l'entreprise", items: ['Santé et sécurité', 'Leadership', 'Attitude et engagement'] }
];
const IDS = [];
SECTIONS.forEach(s => s.items.forEach(() => IDS.push('c' + (IDS.length + 1))));

const ENTETES = ['id', 'jeton', 'jeton_admin', 'statut', 'cree_le', 'employe_nom', 'employe_courriel', 'poste',
  'evaluateur_nom', 'evaluateur_courriel', 'annee', 'donnees_employe', 'donnees_evaluateur',
  'signature_employe_id', 'signature_evaluateur_id', 'date_signature_employe', 'date_signature_evaluateur',
  'horodatage_employe', 'horodatage_evaluateur', 'rapport_pdf_id'];
const STATUT_ASSIGNATION = 'En attente d’assignation';
const STATUT_ATTENTE = 'En attente de l’évaluateur';
const STATUT_COMPLETE = 'Complété';
const MAX_TEXTE = 5000;

/* ---------- À exécuter une fois pour autoriser et créer la feuille ---------- */
function installer() {
  const ss = classeur_();
  feuille_();
  dossier_();
  Logger.log('Registre des réponses : ' + ss.getUrl());
  Logger.log('Installation terminée. Déployez maintenant l’application Web.');
}

/* ---------- Points d'entrée Web ---------- */
function doGet(e) {
  try {
    const a = (e.parameter || {}).action;
    if (a === 'diagnostic') return json_(diagnostic_());
    if (a === 'ping') return json_({ ok: true, message: 'Le service fonctionne.' });
    if (a === 'evaluateurs') return json_({ ok: true, evaluateurs: Object.keys(CONFIG.EVALUATEURS).filter(n => actif_('eval', CONFIG.EVALUATEURS[n])) });
    if (a === 'gestion') return json_(gestion_(e.parameter.cle));
    if (a === 'obtenirAdmin') return json_(obtenirAdmin_(e.parameter.id, e.parameter.a));
    if (a === 'obtenir') return json_(obtenir_(e.parameter.id, e.parameter.t));
    return json_({ ok: false, erreur: 'Action inconnue.' });
  } catch (err) {
    return json_({ ok: false, erreur: err.message });
  }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.action === 'soumettreEmploye') return json_(soumettreEmploye_(b));
    if (b.action === 'testCourriel') return json_(testCourriel_(b.cle));
    if (b.action === 'gestionMaj') return json_(gestionMaj_(b));
    if (b.action === 'assigner') return json_(assigner_(b));
    if (b.action === 'soumettreEvaluateur') return json_(soumettreEvaluateur_(b));
    return json_({ ok: false, erreur: 'Action inconnue.' });
  } catch (err) {
    return json_({ ok: false, erreur: err.message });
  }
}

/* ---------- Étape 1 : autoévaluation de l'employé ---------- */
function soumettreEmploye_(b) {
  const i = b.identite || {};
  const nom = txt_(i.nom, 120);
  if (!nom) throw new Error('Le nom est obligatoire.');
  if (POSTES.indexOf(i.poste) < 0) throw new Error('Poste invalide.');
  urlBase_(); // refuse d'enregistrer si les liens des courriels seraient inutilisables
  const adminCourriels = adminsActifs_().join(',');
  const notes = notes_(b.notes);
  const sig = b.signature || {};
  const dateSig = date_(sig.date);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const id = Utilities.getUuid();
    const jetonAdmin = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    const sigId = sauverSignature_(sig.image, 'signature-employe-' + id + '.png');
    const maintenant = horodatage_();
    const donnees = {
      notes: notes,
      commentaires: commentaires_(b.commentaires),
      reponses: {
        accompli: txt_((b.reponses || {}).accompli, MAX_TEXTE),
        prochaine: txt_((b.reponses || {}).prochaine, MAX_TEXTE),
        autres: txt_((b.reponses || {}).autres, MAX_TEXTE)
      }
    };
    const ligne = {
      id: id, jeton: '', jeton_admin: jetonAdmin, statut: STATUT_ASSIGNATION, cree_le: maintenant,
      employe_nom: nom, employe_courriel: '', poste: i.poste,
      evaluateur_nom: '', evaluateur_courriel: '',
      annee: txt_(i.annee, 10) || String(new Date().getFullYear()),
      donnees_employe: JSON.stringify(donnees), donnees_evaluateur: '',
      signature_employe_id: sigId, signature_evaluateur_id: '',
      date_signature_employe: dateSig, date_signature_evaluateur: '',
      horodatage_employe: maintenant, horodatage_evaluateur: '', rapport_pdf_id: ''
    };
    const sh = feuille_();
    sh.appendRow(ENTETES.map(k => ligne[k]));
    try {

      const lien = urlBase_() + '?id=' + encodeURIComponent(id) + '&a=' + jetonAdmin;
      envoyer_({
        to: adminCourriels,
        name: CONFIG.NOM_EXPEDITEUR,
        subject: 'À assigner : évaluation annuelle ' + ligne.annee + ' – ' + nom,
        htmlBody:
          '<p>Bonjour,</p><p><strong>' + esc_(nom) + '</strong> (' + esc_(i.poste) + ') a complété et signé son autoévaluation ' + esc_(ligne.annee) + '.</p>' +
          '<p>Un administrateur doit désigner l’évaluateur à l’aide du lien ci-dessous. Le lien personnel de l’évaluateur s’affichera alors à l’écran, pour que vous le lui transmettiez (aucun courriel n’est envoyé à l’évaluateur).</p>' +
          '<p><a href="' + lien + '" style="background:#0E4F8B;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;display:inline-block">Désigner l’évaluateur</a></p>' +
          '<p style="color:#666;font-size:12px">Ce lien est réservé aux administrateurs. Vous pouvez y revenir pour changer d’évaluateur tant que l’évaluation n’est pas signée.</p>'
      });
    } catch (err) {
      sh.deleteRow(sh.getLastRow());
      try { DriveApp.getFileById(sigId).setTrashed(true); } catch (e2) { }
      throw new Error('Le courriel aux administrateurs n’a pas pu être envoyé : ' + err.message + ' (rien n’a été enregistré, vous pouvez réessayer).');
    }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Assignation de l'évaluateur par un administrateur ---------- */
function obtenirAdmin_(id, jetonAdmin) {
  const r = trouver_(id);
  if (!r || !jetonAdmin || !r.obj.jeton_admin || r.obj.jeton_admin !== jetonAdmin) throw new Error('Lien invalide ou expiré.');
  if (r.obj.statut === STATUT_COMPLETE) return { ok: true, complete: true };
  return {
    ok: true,
    evaluation: {
      identite: { nom: r.obj.employe_nom, poste: r.obj.poste, annee: r.obj.annee },
      date_signature: r.obj.date_signature_employe,
      evaluateur: r.obj.evaluateur_nom,
      lien_evaluateur: (r.obj.statut === STATUT_ATTENTE && r.obj.jeton) ? urlBase_() + '?id=' + encodeURIComponent(r.obj.id) + '&t=' + r.obj.jeton : ''
    }
  };
}

function assigner_(b) {
  const nomEval = txt_(b.evaluateur, 120);
  urlBase_();
  const courriel = CONFIG.EVALUATEURS[nomEval];
  if (!courriel) throw new Error('Évaluateur inconnu : choisissez un nom dans la liste.');
  if (!actif_('eval', courriel)) throw new Error('Cet évaluateur est désactivé : choisissez-en un autre.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const r = trouver_(b.id);
    if (!r || !b.jeton_admin || !r.obj.jeton_admin || r.obj.jeton_admin !== b.jeton_admin) throw new Error('Lien invalide ou expiré.');
    if (r.obj.statut === STATUT_COMPLETE) throw new Error('Cette évaluation a déjà été complétée.');
    const o = r.obj;
    o.jeton = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); // invalide un lien précédent
    o.evaluateur_nom = nomEval;
    o.evaluateur_courriel = courriel;
    o.statut = STATUT_ATTENTE;
    ecrire_(r, o);
    const lien = urlBase_() + '?id=' + encodeURIComponent(o.id) + '&t=' + o.jeton;
    // Aucun courriel n'est envoyé à l'évaluateur : le lien s'affiche à l'administrateur, qui le lui transmet.
    // Un avis (avec le lien) est envoyé aux administrateurs pour garder une trace ; son échec ne bloque pas l'assignation.
    let avis = true;
    try {
      envoyer_({
        to: adminsActifs_().join(','),
        name: CONFIG.NOM_EXPEDITEUR,
        subject: 'Évaluateur désigné : ' + o.employe_nom,
        htmlBody: '<p>L’évaluateur désigné pour <strong>' + esc_(o.employe_nom) + '</strong> (' + esc_(o.poste) + ') est <strong>' + esc_(nomEval) + '</strong>.</p>' +
          '<p>Aucun courriel n’a été envoyé à l’évaluateur. Transmettez-lui ce lien personnel (il ne fonctionne qu’une fois) :</p>' +
          '<p><a href="' + lien + '" style="background:#0E4F8B;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;display:inline-block">Lien d’évaluation</a></p>'
      });
    } catch (err) {
      avis = false;
    }
    return { ok: true, lien: lien, avis: avis };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Chargement pour l’évaluateur ---------- */
function obtenir_(id, jeton) {
  const r = trouver_(id);
  if (!r || !jeton || r.obj.jeton !== jeton) throw new Error('Lien invalide ou expiré.');
  if (r.obj.statut === STATUT_COMPLETE) return { ok: true, complete: true };
  const d = JSON.parse(r.obj.donnees_employe);
  return {
    ok: true,
    evaluation: {
      identite: { nom: r.obj.employe_nom, poste: r.obj.poste, annee: r.obj.annee, evaluateur: r.obj.evaluateur_nom },
      notes: d.notes, commentaires: d.commentaires, reponses: d.reponses,
      signature: imageDataUrl_(r.obj.signature_employe_id),
      date_signature: r.obj.date_signature_employe,
      horodatage: r.obj.horodatage_employe
    }
  };
}

/* ---------- Étape 2 : évaluation de l’évaluateur + rapport final ---------- */
function soumettreEvaluateur_(b) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const r = trouver_(b.id);
    if (!r || !b.jeton || r.obj.jeton !== b.jeton) throw new Error('Lien invalide ou expiré.');
    if (r.obj.statut === STATUT_COMPLETE) throw new Error('Cette évaluation a déjà été complétée.');
    const notes = notes_(b.notes);
    const sig = b.signature || {};
    const dateSig = date_(sig.date);
    const sigId = sauverSignature_(sig.image, 'signature-evaluateur-' + r.obj.id + '.png');
    const maintenant = horodatage_();
    const donneesSup = {
      notes: notes,
      commentaires: commentaires_(b.commentaires),
      commentaires_generaux: txt_((b.reponses || {}).commentaires, MAX_TEXTE)
    };

    const evaluateur = r.obj.evaluateur_nom;
    if (!evaluateur) throw new Error('Aucun évaluateur désigné.');
    const o = r.obj;
    o.evaluateur_nom = evaluateur;
    o.donnees_evaluateur = JSON.stringify(donneesSup);
    o.signature_evaluateur_id = sigId;
    o.date_signature_evaluateur = dateSig;
    o.horodatage_evaluateur = maintenant;

    const nomFichier = 'Évaluation ' + o.annee + ' – ' + o.employe_nom + '.pdf';
    const donneesEmp = JSON.parse(o.donnees_employe);
    let pdf;
    try {
      pdf = Utilities.newBlob(rapportHtml_(o, donneesEmp, donneesSup, false), 'text/html', 'rapport.html').getAs('application/pdf').setName(nomFichier);
    } catch (errPdf) {
      // Repli : rapport sans images (signatures et logo) si la conversion échoue.
      pdf = Utilities.newBlob(rapportHtml_(o, donneesEmp, donneesSup, true), 'text/html', 'rapport.html').getAs('application/pdf').setName(nomFichier);
    }
    const moyE = moyenne_(IDS.map(id => JSON.parse(o.donnees_employe).notes[id]));
    const moyS = moyenne_(IDS.map(id => notes[id]));
    const destinataires = adminsActifs_().concat(String(CONFIG.COURRIEL_EN_PLUS).split(','))
      .map(x => x.trim().toLowerCase()).filter((x, i, arr) => x && arr.indexOf(x) === i).join(',');
    const courrielFinal = {
      to: destinataires,
      name: CONFIG.NOM_EXPEDITEUR,
      subject: 'Rapport final : évaluation annuelle ' + o.annee + ' – ' + o.employe_nom,
      htmlBody:
        '<p>Bonjour,</p><p>L’évaluation annuelle ' + esc_(o.annee) + ' de <strong>' + esc_(o.employe_nom) + '</strong> (' + esc_(o.poste) + ') est complétée et signée par les deux parties (évaluateur : ' + esc_(o.evaluateur_nom) + ').</p>' +
        '<table cellpadding="6" style="border-collapse:collapse"><tr><td>Moyenne de l’autoévaluation</td><td><strong>' + fmt_(moyE) + '</strong></td></tr>' +
        '<tr><td>Moyenne de l’évaluateur</td><td><strong>' + fmt_(moyS) + '</strong></td></tr></table>' +
        '<p>Le rapport complet est joint en PDF.</p>',
      attachments: [pdf]
    };
    try {
      envoyer_(courrielFinal);
    } catch (err) {
      throw new Error('Le rapport final n’a pas pu être envoyé : ' + err.message + ' (l’évaluation n’est pas verrouillée, vous pouvez réessayer).');
    }
    const fichier = dossier_().createFile(pdf);
    o.rapport_pdf_id = fichier.getId();
    o.statut = STATUT_COMPLETE;
    ecrire_(r, o);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Rapport PDF ---------- */
function rapportHtml_(o, dE, dS, sansImages) {
  let logo = '';
  if (CONFIG.LOGO_FICHIER_ID && !sansImages) {
    try { logo = '<img src="' + imageDataUrl_(CONFIG.LOGO_FICHIER_ID) + '" style="height:60px;float:right">'; } catch (e) { }
  } else {
    logo = '<div style="float:right;font-size:22px;font-weight:bold;color:#2798F5">FLO-FAB</div>';
  }
  const ecartMax = [];
  let lignes = '', n = 0, resume = '';
  SECTIONS.forEach(s => {
    const e = [], su = [];
    lignes += '<tr><td colspan="5" style="background:#0E4F8B;color:#fff;font-weight:bold">' + esc_(s.t) + '</td></tr>';
    s.items.forEach(titre => {
      n++;
      const id = 'c' + n, ve = dE.notes[id], vs = dS.notes[id], ec = Math.abs(ve - vs);
      e.push(ve); su.push(vs);
      if (ec >= 2) ecartMax.push(n + '. ' + titre);
      let com = '';
      if (dE.commentaires[id]) com += '<div><b>Employé :</b> ' + br_(dE.commentaires[id]) + '</div>';
      if (dS.commentaires[id]) com += '<div><b>Évaluateur :</b> ' + br_(dS.commentaires[id]) + '</div>';
      lignes += '<tr><td>' + n + '. ' + esc_(titre) + '</td><td class="c">' + ve + '</td><td class="c">' + vs + '</td>' +
        '<td class="c"' + (ec >= 2 ? ' style="background:#FDF3DC;font-weight:bold"' : '') + '>' + (vs - ve > 0 ? '+' : '') + (vs - ve) + '</td><td class="com">' + com + '</td></tr>';
    });
    resume += '<tr><td>' + esc_(s.t) + '</td><td class="c">' + fmt_(moyenne_(e)) + '</td><td class="c">' + fmt_(moyenne_(su)) + '</td></tr>';
  });
  const allE = IDS.map(id => dE.notes[id]), allS = IDS.map(id => dS.notes[id]);
  resume += '<tr style="font-weight:bold"><td>Global</td><td class="c">' + fmt_(moyenne_(allE)) + '</td><td class="c">' + fmt_(moyenne_(allS)) + '</td></tr>';

  const bloc = (titre, texte) => '<h3>' + titre + '</h3><div class="box">' + (texte ? br_(texte) : '—') + '</div>';
  const sigBloc = (role, nom, idImg, date, horo) =>
    '<td style="width:50%;vertical-align:top;border:none;padding:0 10px 0 0"><div style="font-weight:bold">' + role + '</div>' +
    (sansImages ? '<div style="height:70px;border-bottom:1px solid #000;margin:6px 0"></div>' : '<img src="' + imageDataUrl_(idImg) + '" style="height:70px;border-bottom:1px solid #000;display:block;margin:6px 0">') +
    '<div>' + esc_(nom) + '</div><div>Date : ' + esc_(date) + '</div><div style="color:#666;font-size:9px">Signé électroniquement – horodatage : ' + esc_(horo) + '</div></td>';

  return '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:10.5px;color:#1C2630}' +
    'h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 6px;border-bottom:2px solid #1C2630;padding-bottom:3px}h3{font-size:11.5px;margin:10px 0 4px}' +
    'table{width:100%;border-collapse:collapse}td,th{border:1px solid #C9D1D8;padding:4px 6px;vertical-align:top;text-align:left}' +
    'th{background:#E3EDF7}.c{text-align:center;width:52px}.com{font-size:9.5px}.box{border:1px solid #C9D1D8;padding:6px 8px;min-height:24px}' +
    '</style></head><body>' + logo +
    '<h1>Évaluation annuelle ' + esc_(o.annee) + '</h1><div>Rapport combiné – autoévaluation et évaluation de l’évaluateur</div><div style="clear:both"></div>' +
    '<h2>Identification</h2><table><tr><th>Employé</th><td>' + esc_(o.employe_nom) + '</td><th>Poste</th><td>' + esc_(o.poste) + '</td></tr>' +
    '<tr><th>Évaluateur</th><td>' + esc_(o.evaluateur_nom) + '</td><th>Année évaluée</th><td>' + esc_(o.annee) + '</td></tr></table>' +
    '<h2>Bilan</h2><table><tr><th>Section</th><th class="c">Employé</th><th class="c">Évaluateur</th></tr>' + resume + '</table>' +
    (ecartMax.length ? '<p style="color:#B8431F"><b>Écarts de 2 points ou plus :</b> ' + esc_(ecartMax.join(', ')) + '</p>' : '') +
    '<p style="font-size:9.5px;color:#555">Échelle : 1 Ne répond pas aux attentes · 2 Répond à certaines attentes · 3 Répond aux attentes · 4 Surpasse parfois les attentes · 5 Surpasse de loin les attentes. Écart = cote évaluateur − cote employé.</p>' +
    '<h2>Détail des critères</h2><table><tr><th>Critère</th><th class="c">Employé</th><th class="c">Évaluateur</th><th class="c">Écart</th><th>Commentaires</th></tr>' + lignes + '</table>' +
    '<h2>Réflexion et objectifs</h2>' +
    bloc('Ce que j’ai accompli et amélioré durant la dernière année (employé)', dE.reponses.accompli) +
    bloc('Ce que je veux accomplir et améliorer dans la prochaine année (employé)', dE.reponses.prochaine) +
    bloc('Autres commentaires de l’employé', dE.reponses.autres) +
    bloc('Commentaires de l’évaluateur et objectifs convenus', dS.commentaires_generaux) +
    '<h2>Signatures</h2><table><tr>' +
    sigBloc('Signature de l’employé', o.employe_nom, o.signature_employe_id, o.date_signature_employe, o.horodatage_employe) +
    sigBloc('Signature de l’évaluateur', o.evaluateur_nom, o.signature_evaluateur_id, o.date_signature_evaluateur, o.horodatage_evaluateur) +
    '</tr></table><p style="font-size:9px;color:#666;margin-top:14px">Référence : ' + esc_(o.id) + '</p></body></html>';
}

/* ---------- Destinataires actifs / désactivés (panneau de gestion) ---------- */
const PROP_INACTIFS = 'DESTINATAIRES_INACTIFS';
function inactifs_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PROP_INACTIFS) || '[]'); } catch (err) { return []; }
}
function actif_(role, courriel) { return inactifs_().indexOf(role + ':' + String(courriel).toLowerCase()) < 0; }
function adminsActifs_() {
  const l = CONFIG.ADMINISTRATEURS.filter(c => actif_('admin', c));
  return l.length ? l : CONFIG.ADMINISTRATEURS; // sécurité : jamais aucun administrateur
}
function verifCle_(cle) {
  const k = String(CONFIG.CLE_ADMIN || '');
  if (k.length < 8 || k === 'CHANGEZ-MOI') throw new Error('La clé d’administration n’est pas configurée (CLE_ADMIN dans Code.gs, 8 caractères minimum).');
  if (String(cle || '') !== k) throw new Error('Clé d’administration invalide.');
}
function gestion_(cle) {
  verifCle_(cle);
  return {
    ok: true,
    administrateurs: CONFIG.ADMINISTRATEURS.map(c => ({ courriel: c, actif: actif_('admin', c) })),
    evaluateurs: Object.keys(CONFIG.EVALUATEURS).map(n => ({ nom: n, courriel: CONFIG.EVALUATEURS[n], actif: actif_('eval', CONFIG.EVALUATEURS[n]) }))
  };
}
function gestionMaj_(b) {
  verifCle_(b.cle);
  const role = b.role, courriel = String(b.courriel || '').toLowerCase(), actif = b.actif === true;
  const connus = role === 'admin' ? CONFIG.ADMINISTRATEURS : role === 'eval' ? Object.keys(CONFIG.EVALUATEURS).map(n => CONFIG.EVALUATEURS[n]) : null;
  if (!connus || connus.map(x => x.toLowerCase()).indexOf(courriel) < 0) throw new Error('Destinataire inconnu.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    let liste = inactifs_().filter(x => x !== role + ':' + courriel);
    if (!actif) {
      if (role === 'admin') {
        const restants = CONFIG.ADMINISTRATEURS.filter(c => c.toLowerCase() !== courriel && liste.indexOf('admin:' + c.toLowerCase()) < 0);
        if (!restants.length) throw new Error('Au moins un administrateur doit rester actif.');
      }
      liste.push(role + ':' + courriel);
    }
    PropertiesService.getScriptProperties().setProperty(PROP_INACTIFS, JSON.stringify(liste));
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Diagnostic ---------- */
function diagnostic_() {
  const r = {};
  try { feuille_(); r.feuille = true; } catch (e) { r.feuille = false; }
  try { dossier_(); r.drive = true; } catch (e) { r.drive = false; }
  try { r.courriels_restants = MailApp.getRemainingDailyQuota(); r.courriel = r.courriels_restants > 0; } catch (e) { r.courriel = false; }
  try { urlBase_(); r.url_formulaire = true; } catch (e) { r.url_formulaire = false; }
  r.cle_admin = String(CONFIG.CLE_ADMIN).length >= 8 && CONFIG.CLE_ADMIN !== 'CHANGEZ-MOI';
  r.administrateurs = CONFIG.ADMINISTRATEURS.length;
  r.evaluateurs = Object.keys(CONFIG.EVALUATEURS).length;
  r.ok = !!(r.feuille && r.drive && r.courriel && r.url_formulaire);
  return r;
}
/** À exécuter dans l'éditeur (Exécuter › diagnostic) : vérifie tout et affiche le résultat dans le journal. */
function diagnostic() {
  const r = diagnostic_();
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(r.ok ? 'TOUT EST PRÊT.' : 'À CORRIGER : ' + Object.keys(r).filter(k => r[k] === false).join(', '));
}
function urlBase_() {
  const u = String(CONFIG.URL_FORMULAIRE || '').trim();
  if (!/^https:\/\/.+/.test(u) || /VOTRE-COMPTE/.test(u)) {
    throw new Error('URL_FORMULAIRE n’est pas configurée dans Code.gs : inscrivez l’adresse de la page GitHub (les liens des courriels ne fonctionneraient pas).');
  }
  return u.charAt(u.length - 1) === '/' ? u : u + '/';
}

/* ---------- Envoi de courriels ---------- */
// Ajoute toujours une version texte (exigée par MailApp, et utile contre le pourriel) puis envoie.
function envoyer_(o) {
  if (!o.body) o.body = texteDe_(o.htmlBody);
  MailApp.sendEmail(o);
}
function texteDe_(html) {
  return String(html || '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, '$2 : $1')
    .replace(/<\/(p|tr|table|div)>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<\/td>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n').trim();
}
/** Courriel de test envoyé aux administrateurs actifs (utilisé par le panneau de gestion). */
function testCourriel_(cle) {
  verifCle_(cle);
  const dest = adminsActifs_();
  try {
    envoyer_({
      to: dest.join(','), name: CONFIG.NOM_EXPEDITEUR,
      subject: 'Test – Évaluation annuelle Flo-Fab',
      htmlBody: '<p>Ceci est un courriel de test du système d’évaluation annuelle. S’il vous parvient, l’envoi automatique fonctionne.</p>' +
        '<p><a href="' + urlBase_() + '">Ouvrir le formulaire</a></p>'
    });
  } catch (err) {
    throw new Error('Google a refusé l’envoi : ' + err.message);
  }
  return { ok: true, destinataires: dest.length, courriels_restants: MailApp.getRemainingDailyQuota() };
}
/** À exécuter dans l'éditeur (Exécuter › testerCourriel) : envoie un test au premier administrateur. */
function testerCourriel() {
  envoyer_({ to: CONFIG.ADMINISTRATEURS[0], name: CONFIG.NOM_EXPEDITEUR, subject: 'Test – Évaluation annuelle Flo-Fab', htmlBody: '<p>Courriel de test : l’envoi automatique fonctionne.</p>' });
  Logger.log('Courriel de test envoyé à ' + CONFIG.ADMINISTRATEURS[0] + '. Quota restant : ' + MailApp.getRemainingDailyQuota());
}

/* ---------- Utilitaires ---------- */
/**
 * Retourne la feuille de calcul « registre ». Fonctionne que le script soit lié à une feuille
 * (Extensions › Apps Script) ou autonome : dans ce dernier cas, une feuille est créée
 * automatiquement dans le dossier Drive et son identifiant est mémorisé.
 */
function classeur_() {
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (ss) return ss;
  const props = PropertiesService.getScriptProperties();
  const id = String(CONFIG.CLASSEUR_ID || '') || props.getProperty('CLASSEUR_ID');
  if (id) return SpreadsheetApp.openById(id);
  ss = SpreadsheetApp.create('Évaluations annuelles – registre');
  props.setProperty('CLASSEUR_ID', ss.getId());
  try { DriveApp.getFileById(ss.getId()).moveTo(dossier_()); } catch (e) { /* reste à la racine du Drive */ }
  return ss;
}
function feuille_() {
  const ss = classeur_();
  let sh = ss.getSheetByName('Évaluations');
  if (!sh) {
    sh = ss.insertSheet('Évaluations');
    try { // supprime la feuille vide par défaut d'un classeur fraîchement créé
      const autres = ss.getSheets().filter(s => s.getName() !== 'Évaluations');
      if (autres.length && autres.every(s => s.getLastRow() === 0)) autres.forEach(s => ss.deleteSheet(s));
    } catch (e) { /* sans importance */ }
    sh.getRange(1, 1, sh.getMaxRows(), ENTETES.length).setNumberFormat('@'); // texte brut (évite la conversion des dates)
    sh.getRange(1, 1, 1, ENTETES.length).setValues([ENTETES]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function dossier_() {
  const it = DriveApp.getFoldersByName(CONFIG.NOM_DOSSIER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.NOM_DOSSIER);
}
function trouver_(id) {
  if (!id) return null;
  const sh = feuille_(), vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) {
      const obj = {};
      ENTETES.forEach((k, j) => obj[k] = String(vals[i][j]));
      return { sh: sh, row: i + 1, obj: obj };
    }
  }
  return null;
}
function ecrire_(r, o) {
  r.sh.getRange(r.row, 1, 1, ENTETES.length).setValues([ENTETES.map(k => o[k])]);
}
function notes_(n) {
  n = n || {};
  const out = {};
  IDS.forEach(id => {
    const v = Number(n[id]);
    if (!(v >= 1 && v <= 5 && Math.floor(v) === v)) throw new Error('Toutes les cotes (1 à 5) sont obligatoires.');
    out[id] = v;
  });
  return out;
}
function commentaires_(c) {
  c = c || {};
  const out = {};
  IDS.forEach(id => { const t = txt_(c[id], MAX_TEXTE); if (t) out[id] = t; });
  return out;
}
function sauverSignature_(dataUrl, nom) {
  if (!/^data:image\/png;base64,/.test(String(dataUrl || ''))) throw new Error('Signature manquante.');
  const octets = Utilities.base64Decode(String(dataUrl).split(',')[1]);
  if (octets.length > 600000) throw new Error('Signature trop volumineuse.');
  return dossier_().createFile(Utilities.newBlob(octets, 'image/png', nom)).getId();
}
function imageDataUrl_(fileId) {
  const blob = DriveApp.getFileById(fileId).getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}
function date_(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) throw new Error('Date de signature invalide.');
  return String(d);
}
function horodatage_() {
  return Utilities.formatDate(new Date(), 'America/Toronto', 'yyyy-MM-dd HH:mm:ss z');
}
function txt_(s, max) { return String(s == null ? '' : s).trim().slice(0, max); }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function br_(s) { return esc_(s).replace(/\n/g, '<br>'); }
function moyenne_(a) { a = a.filter(x => x); return a.length ? a.reduce((p, c) => p + c, 0) / a.length : null; }
function fmt_(x) { return x == null ? '—' : x.toFixed(1).replace('.', ','); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
