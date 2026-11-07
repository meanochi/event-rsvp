/**
 * שליחת הזמנות ותזכורות במייל – Google Apps Script
 * קובץ נוסף לאותו פרויקט Apps Script שבו נמצא Code.gs.
 *
 * התקנה:
 * 1. ב-Apps Script: לחצו על "+" ליד "קבצים" ← "סקריפט", קראו לו Mailer, הדביקו את הקובץ הזה ושמרו.
 *    אחר כך צרו באותה דרך קובץ נוסף בשם MailTemplate והדביקו בו את MailTemplate.gs.
 * 2. בעורך, בחרו בפונקציה installMenu ולחצו "הפעלה" (פעם אחת). אשרו הרשאות.
 * 3. רעננו את הגיליון. יופיע תפריט חדש: "שליחת הזמנות".
 *
 * אין צורך לפרוס מחדש את ה-Web App – התפריט עובד ישירות מהגיליון.
 */

const MAIL = {
  siteUrl: 'https://meanochi.github.io/event-rsvp/',
  imagePath: 'invitation.jpg?v=3',
  fromName: 'מאיר וטובה לופיאנסקי',
  subject: 'הזמנה לשמחת בר המצווה של בן ציון הלוי נ״י',
  reminderSubject: 'תזכורת: אישור הגעה לשמחת בר המצווה של בן ציון הלוי נ״י',
  eventLine: 'מוצאי שבת קודש פרשת תולדות, אור לה\' כסלו תשפ"ז (14.11.2026) – סעודת המצווה במלווה מלכה בשעה 20:30',
  placeLine: 'אולם היכל אברהם יצחק, רחוב קהילות יעקב 19, ירושלים',
  color: '#8a5a32',
};

const GUESTS_SHEET = 'מוזמנים';
const G = { NAME: 0, EMAIL: 1, PHONE: 2, SENT: 3, REMINDED: 4, STATUS: 5 }; // אינדקס עמודות
const GUEST_HEADERS = ['שם', 'מייל', 'טלפון (לא חובה)', 'הזמנה נשלחה', 'תזכורת נשלחה', 'אישרו?'];

/* ---------- תפריט ---------- */

/**
 * להריץ פעם אחת מהעורך: מתקין טריגר שמוסיף את התפריט בכל פתיחה של הגיליון.
 * (טריגר מותקן אמין יותר מ-onOpen רגיל, שלא תמיד רץ כשמחוברים כמה חשבונות Google.)
 */
function installMenu() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'addMenu') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('addMenu').forSpreadsheet(ss).onOpen().create();
  setupGuests();
  Logger.log('התפריט הותקן. רעננו את הגיליון.');
}

function addMenu() {
  SpreadsheetApp.getUi()
    .createMenu('שליחת הזמנות')
    .addItem('הכנת לשונית מוזמנים', 'setupGuests')
    .addSeparator()
    .addItem('שליחת הזמנת ניסיון אליי', 'sendTestInvite')
    .addItem('שליחת הזמנות לכל מי שטרם קיבל', 'sendInvites')
    .addSeparator()
    .addItem('שליחת תזכורת ניסיון אליי', 'sendTestReminder')
    .addItem('שליחת תזכורת למי שטרם אישר', 'sendReminders')
    .addSeparator()
    .addItem('מצב שליחה', 'showStatus')
    .addToUi();
}

function setupGuests() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(GUESTS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(GUESTS_SHEET, 0);
    sh.appendRow(GUEST_HEADERS);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, GUEST_HEADERS.length).setFontWeight('bold').setBackground('#f1e4d4');
    sh.getRange('C:C').setNumberFormat('@');
    sh.setColumnWidths(1, 5, 170);
  }
  alert_(
    'הלשונית "' + GUESTS_SHEET + '" מוכנה.\n\n' +
    'מלאו בכל שורה: שם (למשל "משפחת כהן"), מייל, ואם אפשר גם טלפון.\n' +
    'הטלפון עוזר לזהות בדיוק מי כבר אישר, כדי לא לשלוח לו תזכורת.');
}

/* ---------- שליחה ---------- */

function sendTestInvite() { sendTest_(false); }
function sendTestReminder() { sendTest_(true); }

function sendTest_(isReminder) {
  const me = Session.getActiveUser().getEmail();
  sendOne_({ name: 'משפחת ניסיון', email: me, phone: '' }, isReminder);
  alert_('נשלח מייל ניסיון אל ' + me);
}

function sendInvites() {
  const guests = readGuests_().filter(function (g) { return g.email && !g.sent; });
  runBatch_(guests, false, 'הזמנות');
}

function sendReminders() {
  const confirmed = confirmedKeys_();
  const guests = readGuests_().filter(function (g) {
    return g.email && g.sent && !g.reminded && !isConfirmed_(g, confirmed);
  });
  runBatch_(guests, true, 'תזכורות');
}

function runBatch_(guests, isReminder, label) {
  if (!guests.length) {
    alert_(isReminder ? 'אין למי לשלוח תזכורת – כולם אישרו או כבר קיבלו תזכורת.'
                        : 'אין הזמנות לשליחה – כולם כבר קיבלו.');
    return;
  }
  const quota = MailApp.getRemainingDailyQuota();
  const n = Math.min(guests.length, quota);
  const msg = 'יישלחו ' + n + ' ' + label + '.' +
    (n < guests.length ? '\n(מכסת השליחה היומית מאפשרת ' + quota + ' בלבד. את השאר אפשר לשלוח מחר.)' : '') +
    '\n\nלהמשיך?';
  Logger.log(msg.replace('\n\nלהמשיך?', '')); // הלחיצה על "הפעלה" בעורך היא האישור

  const sh = guestsSheet_();
  const col = (isReminder ? G.REMINDED : G.SENT) + 1;
  let sent = 0, failed = [];
  for (let i = 0; i < n; i++) {
    const g = guests[i];
    try {
      sendOne_(g, isReminder);
      sh.getRange(g.row, col).setValue(new Date());
      sent++;
    } catch (err) {
      failed.push(g.name + ' (' + g.email + ')');
    }
  }
  alert_('נשלחו ' + sent + ' ' + label + '.' +
    (failed.length ? '\n\nנכשלו:\n' + failed.join('\n') : ''));
}

function sendOne_(g, isReminder) {
  const link = MAIL.siteUrl + '?name=' + encodeURIComponent(g.name) +
    (g.phone ? '&phone=' + encodeURIComponent(g.phone) : '');
  MailApp.sendEmail({
    to: g.email,
    name: MAIL.fromName,
    subject: isReminder ? MAIL.reminderSubject : MAIL.subject,
    htmlBody: buildHtml_(g.name, link, isReminder),
    body: buildText_(g.name, link, isReminder),
  });
}

/* ---------- נתונים ---------- */

function guestsSheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GUESTS_SHEET);
  if (!sh) throw new Error('לא נמצאה לשונית "' + GUESTS_SHEET + '". הריצו קודם "הכנת לשונית מוזמנים".');
  return sh;
}

function readGuests_() {
  const sh = guestsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, GUEST_HEADERS.length).getValues()
    .map(function (r, i) {
      return {
        row: i + 2,
        name: String(r[G.NAME]).trim(),
        email: String(r[G.EMAIL]).trim(),
        phone: normPhone_(r[G.PHONE]),
        sent: !!r[G.SENT],
        reminded: !!r[G.REMINDED],
      };
    })
    .filter(function (g) { return g.name && /@/.test(g.email); });
}

/** מפתחות (טלפון ושם) של כל מי שמילא את הטופס – מהלשונית "אישורים" */
function confirmedKeys_() {
  const keys = { phones: {}, names: {} };
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME); // מוגדר ב-Code.gs
  if (!sh || sh.getLastRow() < 2) return keys;
  sh.getRange(2, 2, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (r[0]) keys.names[normName_(r[0])] = true;
    if (r[1]) keys.phones[normPhone_(r[1])] = true;
  });
  return keys;
}

function isConfirmed_(g, keys) {
  return (g.phone && keys.phones[g.phone]) || keys.names[normName_(g.name)];
}

/**
 * מעדכן את עמודת "אישרו?" לפי כל האישורים שכבר התקבלו.
 * (אישורים חדשים מתעדכנים בה אוטומטית; את זה מריצים פעם אחת, או כשמוסיפים מוזמנים.)
 */
function syncStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const conf = ss.getSheetByName(SHEET_NAME); // מוגדר ב-Code.gs
  const guests = guestsSheet_();
  if (!conf || conf.getLastRow() < 2) { alert_('אין עדיין אישורים.'); return; }
  const rows = conf.getRange(2, 1, conf.getLastRow() - 1, HEADERS.length).getValues();
  let marked = 0;
  rows.forEach(function (r) {
    const text = statusText_(r[3], Number(r[4]) || 0, Number(r[5]) || 0, Number(r[7]) || 0);
    if (markGuest_(r[1], r[2], text, guests)) marked++;
  });
  alert_('עודכנו ' + marked + ' מוזמנים בעמודת "אישרו?" (מתוך ' + rows.length + ' אישורים).');
}

function showStatus() {
  const guests = readGuests_();
  const keys = confirmedKeys_();
  const sent = guests.filter(function (g) { return g.sent; }).length;
  const confirmed = guests.filter(function (g) { return isConfirmed_(g, keys); }).length;
  const reminded = guests.filter(function (g) { return g.reminded; }).length;
  alert_(
    'מוזמנים עם מייל: ' + guests.length + '\n' +
    'הזמנה נשלחה: ' + sent + '\n' +
    'מילאו את הטופס: ' + confirmed + '\n' +
    'קיבלו תזכורת: ' + reminded + '\n' +
    'ממתינים לתשובה: ' + (sent - confirmed) + '\n\n' +
    'מכסת מיילים שנותרה להיום: ' + MailApp.getRemainingDailyQuota());
}

/* ---------- עזר ---------- */

/** ממשק הגיליון – או null כשמריצים מתוך עורך הסקריפט */
function ui_() {
  try { return SpreadsheetApp.getUi(); } catch (e) { return null; }
}

/** הודעה למשתמש: בחלון בגיליון, או ביומן הביצוע כשמריצים מהעורך */
function alert_(msg) {
  Logger.log(msg); // ההודעות מופיעות ביומן הביצוע בעורך (חלונות בגיליון לא תמיד נפתחים מאחורי מסננים)
}

function normPhone_(p) {
  let s = String(p || '').replace(/[^\d]/g, '');
  if (s.indexOf('972') === 0) s = '0' + s.slice(3);
  if (s.length === 9 && s.charAt(0) !== '0') s = '0' + s; // הגיליון השמיט את ה-0 בהתחלה
  return s;
}

function normName_(n) {
  return String(n || '').replace(/^'/, '').replace(/[\s"'״׳-]+/g, ' ').trim();
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
