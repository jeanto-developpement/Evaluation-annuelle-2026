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
  // Administrateurs : reçoivent un lien d'assignation dès qu'un employé envoie son autoévaluation
  // et désignent l'évaluateur (en le choisissant dans la liste EVALUATEURS ci-dessous). Ils reçoivent aussi une copie du rapport final en PDF.
  ADMINISTRATEURS: ['michaeldugal@flofab.com', 'jeanto@flofab.com', 'karynalapierre@flofab.com'],

  // Évaluateurs : nom affiché dans la liste de l'administrateur → courriel.
  EVALUATEURS: {
    'Daniel Marullo': 'danielmarullo@flofab.com',
    'Jade Marullo': 'jademarullo@flofab.com',
    'Kevin Desjardins': 'kevindesjardins@flofab.com',
    'Karyna Lapierre': 'karynalapierre@flofab.com',
    'Michael Dugal': 'michaeldugal@flofab.com',
    'Jean To': 'jeanto@flofab.com'
  },

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
  feuille_();
  dossier_();
  Logger.log('Installation terminée. Déployez maintenant l’application Web.');
}

/* ---------- Points d'entrée Web ---------- */
function doGet(e) {
  try {
    const a = (e.parameter || {}).action;
    if (a === 'evaluateurs') return json_({ ok: true, evaluateurs: Object.keys(CONFIG.EVALUATEURS) });
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
  const adminCourriels = CONFIG.ADMINISTRATEURS.join(',');
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
    feuille_().appendRow(ENTETES.map(k => ligne[k]));

    const lien = CONFIG.URL_FORMULAIRE + '?id=' + encodeURIComponent(id) + '&a=' + jetonAdmin;
    MailApp.sendEmail({
      to: adminCourriels,
      name: CONFIG.NOM_EXPEDITEUR,
      subject: 'À assigner : évaluation annuelle ' + ligne.annee + ' – ' + nom,
      htmlBody:
        '<p>Bonjour,</p><p><strong>' + esc_(nom) + '</strong> (' + esc_(i.poste) + ') a complété et signé son autoévaluation ' + esc_(ligne.annee) + '.</p>' +
        '<p>Un administrateur doit désigner l’évaluateur en inscrivant son courriel à l’aide du lien ci-dessous. L’évaluateur recevra alors automatiquement son propre lien pour compléter et signer l’évaluation.</p>' +
        '<p><a href="' + lien + '" style="background:#0E4F8B;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;display:inline-block">Désigner l’évaluateur</a></p>' +
        '<p style="color:#666;font-size:12px">Ce lien est réservé aux administrateurs. Vous pouvez y revenir pour changer d’évaluateur tant que l’évaluation n’est pas signée.</p>'
    });
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
      evaluateur: r.obj.evaluateur_nom
    }
  };
}

function assigner_(b) {
  const nomEval = txt_(b.evaluateur, 120);
  const courriel = CONFIG.EVALUATEURS[nomEval];
  if (!courriel) throw new Error('Évaluateur inconnu : choisissez un nom dans la liste.');
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
    const lien = CONFIG.URL_FORMULAIRE + '?id=' + encodeURIComponent(o.id) + '&t=' + o.jeton;
    MailApp.sendEmail({
      to: courriel,
      name: CONFIG.NOM_EXPEDITEUR,
      subject: 'À compléter : évaluation annuelle ' + o.annee + ' – ' + o.employe_nom,
      htmlBody:
        '<p>Bonjour ' + esc_(nomEval.split(' ')[0]) + ',</p><p>Vous avez été désigné(e) pour évaluer <strong>' + esc_(o.employe_nom) + '</strong> (' + esc_(o.poste) + '). L’employé a complété et signé son autoévaluation ' + esc_(o.annee) + '.</p>' +
        '<p>Veuillez compléter l’évaluation et la signer à l’aide du lien ci-dessous. Le lien ne fonctionne qu’une fois. Le rapport final combiné sera ensuite envoyé automatiquement à vous et aux administrateurs.</p>' +
        '<p><a href="' + lien + '" style="background:#0E4F8B;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;display:inline-block">Compléter l’évaluation</a></p>' +
        '<p style="color:#666;font-size:12px">Ce lien est personnel : ne le transférez pas.</p>'
    });
    MailApp.sendEmail({
      to: CONFIG.ADMINISTRATEURS.join(','),
      name: CONFIG.NOM_EXPEDITEUR,
      subject: 'Évaluateur désigné : ' + o.employe_nom,
      htmlBody: '<p>L’évaluateur désigné pour <strong>' + esc_(o.employe_nom) + '</strong> est <strong>' + esc_(nomEval) + '</strong> (' + esc_(courriel) + '). Son lien d’évaluation lui a été envoyé.</p>'
    });
    return { ok: true };
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

    const html = rapportHtml_(o, JSON.parse(o.donnees_employe), donneesSup);
    const nomFichier = 'Évaluation ' + o.annee + ' – ' + o.employe_nom + '.pdf';
    const pdf = Utilities.newBlob(html, 'text/html', 'rapport.html').getAs('application/pdf').setName(nomFichier);
    const fichier = dossier_().createFile(pdf);
    o.rapport_pdf_id = fichier.getId();
    o.statut = STATUT_COMPLETE;
    ecrire_(r, o);

    const moyE = moyenne_(IDS.map(id => JSON.parse(o.donnees_employe).notes[id]));
    const moyS = moyenne_(IDS.map(id => notes[id]));
    MailApp.sendEmail({
      to: o.evaluateur_courriel,
      cc: CONFIG.ADMINISTRATEURS.concat(String(CONFIG.COURRIEL_EN_PLUS).split(',')).map(x => x.trim().toLowerCase()).filter((x, i, arr) => x && x !== o.evaluateur_courriel && arr.indexOf(x) === i).join(','),
      name: CONFIG.NOM_EXPEDITEUR,
      subject: 'Rapport final : évaluation annuelle ' + o.annee + ' – ' + o.employe_nom,
      htmlBody:
        '<p>Bonjour,</p><p>L’évaluation annuelle ' + esc_(o.annee) + ' de <strong>' + esc_(o.employe_nom) + '</strong> (' + esc_(o.poste) + ') est complétée et signée par les deux parties.</p>' +
        '<table cellpadding="6" style="border-collapse:collapse"><tr><td>Moyenne de l’autoévaluation</td><td><strong>' + fmt_(moyE) + '</strong></td></tr>' +
        '<tr><td>Moyenne de l’évaluateur</td><td><strong>' + fmt_(moyS) + '</strong></td></tr></table>' +
        '<p>Le rapport complet est joint en PDF.</p>',
      attachments: [pdf]
    });
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Rapport PDF ---------- */
function rapportHtml_(o, dE, dS) {
  let logo = '';
  if (CONFIG.LOGO_FICHIER_ID) {
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
    '<img src="' + imageDataUrl_(idImg) + '" style="height:70px;border-bottom:1px solid #000;display:block;margin:6px 0">' +
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

/* ---------- Utilitaires ---------- */
function feuille_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Évaluations');
  if (!sh) {
    sh = ss.insertSheet('Évaluations');
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
