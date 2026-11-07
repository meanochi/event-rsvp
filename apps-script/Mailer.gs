/**
 * שליחת הזמנות ותזכורות במייל – Google Apps Script
 * קובץ נוסף לאותו פרויקט Apps Script שבו נמצא Code.gs.
 *
 * התקנה:
 * 1. ב-Apps Script: לחצו על "+" ליד "קבצים" ← "סקריפט", קראו לו Mailer, הדביקו את הקובץ הזה ושמרו.
 * 2. רעננו את הגיליון. יופיע תפריט חדש: "שליחת הזמנות".
 * 3. בפעם הראשונה בחרו "הכנת לשונית מוזמנים" ואשרו הרשאות (שליחת מייל בשמכם).
 *
 * אין צורך לפרוס מחדש את ה-Web App – התפריט עובד ישירות מהגיליון.
 */

const MAIL = {
  siteUrl: 'https://meanochi.github.io/event-rsvp/',
  imagePath: 'invitation.jpg',
  fromName: 'מאיר וטובה לופיאנסקי',
  subject: 'הזמנה לשמחת בר המצווה של בן ציון הלוי נ״י',
  reminderSubject: 'תזכורת: אישור הגעה לשמחת בר המצווה של בן ציון הלוי נ״י',
  eventLine: 'מוצאי שבת קודש פרשת תולדות, אור לה\' כסלו תשפ"ז (14.11.2026) בשעה 20:30',
  placeLine: 'אולם היכל אברהם יצחק, רחוב קהילות יעקב 19, ירושלים',
  color: '#8a5a32',
};

const GUESTS_SHEET = 'מוזמנים';
const G = { NAME: 0, EMAIL: 1, PHONE: 2, SENT: 3, REMINDED: 4 }; // אינדקס עמודות
const GUEST_HEADERS = ['שם', 'מייל', 'טלפון (לא חובה)', 'הזמנה נשלחה', 'תזכורת נשלחה'];

/* ---------- תפריט ---------- */

function onOpen() {
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
  SpreadsheetApp.getUi().alert(
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
  SpreadsheetApp.getUi().alert('נשלח מייל ניסיון אל ' + me);
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
  const ui = SpreadsheetApp.getUi();
  if (!guests.length) {
    ui.alert(isReminder ? 'אין למי לשלוח תזכורת – כולם אישרו או כבר קיבלו תזכורת.'
                        : 'אין הזמנות לשליחה – כולם כבר קיבלו.');
    return;
  }
  const quota = MailApp.getRemainingDailyQuota();
  const n = Math.min(guests.length, quota);
  const msg = 'יישלחו ' + n + ' ' + label + '.' +
    (n < guests.length ? '\n(מכסת השליחה היומית מאפשרת ' + quota + ' בלבד. את השאר אפשר לשלוח מחר.)' : '') +
    '\n\nלהמשיך?';
  if (ui.alert(label, msg, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

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
  ui.alert('נשלחו ' + sent + ' ' + label + '.' +
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
    inlineImages: { invite: inviteImage_() },
  });
}

/* ---------- תוכן המייל ---------- */

function buildHtml_(name, link, isReminder) {
  const intro = isReminder
    ? 'טרם קיבלנו את אישור ההגעה שלכם. נודה לכם אם תאשרו בלחיצה אחת – זה עוזר לנו מאוד בהיערכות.'
    : 'בשבח והודיה להשי"ת, נשמח לראותכם משתתפים בשמחת בר המצווה של בננו היקר.';
  return '' +
    '<div dir="rtl" style="background:#f7f1e8;padding:24px 12px;font-family:Arial,sans-serif;color:#3d3631;">' +
      '<div style="max-width:560px;margin:0 auto;background:#fffcf7;border:1px solid #e6dccd;border-radius:14px;padding:24px;text-align:center;">' +
        '<p style="font-size:18px;margin:0 0 8px;"><b>' + esc_(name) + ' היקרים,</b></p>' +
        '<p style="font-size:16px;line-height:1.6;margin:0 0 18px;">' + intro + '</p>' +
        '<img src="cid:invite" alt="הזמנה" width="500" style="width:100%;max-width:500px;border-radius:10px;display:block;margin:0 auto 18px;">' +
        '<p style="font-size:15px;line-height:1.6;margin:0 0 4px;">' + esc_(MAIL.eventLine) + '</p>' +
        '<p style="font-size:15px;line-height:1.6;margin:0 0 22px;">' + esc_(MAIL.placeLine) + '</p>' +
        '<a href="' + link + '" style="display:inline-block;background:' + MAIL.color + ';color:#ffffff;' +
          'text-decoration:none;font-size:18px;font-weight:bold;padding:14px 36px;border-radius:10px;">' +
          'לאישור הגעה – לחצו כאן</a>' +
        '<p style="font-size:13px;color:#7a6f66;margin:18px 0 0;">אם הכפתור אינו פועל:<br>' +
          '<a href="' + link + '" style="color:' + MAIL.color + ';">' + esc_(MAIL.siteUrl) + '</a></p>' +
        '<p style="font-size:16px;margin:22px 0 0;"><b>' + esc_(MAIL.fromName) + '</b></p>' +
      '</div>' +
    '</div>';
}

function buildText_(name, link, isReminder) {
  return name + ' היקרים,\n\n' +
    (isReminder ? 'טרם קיבלנו את אישור ההגעה שלכם.\n' : 'נשמח לראותכם משתתפים בשמחת בר המצווה של בננו היקר.\n') +
    MAIL.eventLine + '\n' + MAIL.placeLine + '\n\n' +
    'לאישור הגעה: ' + link + '\n\n' + MAIL.fromName;
}

let inviteBlob_ = null;
function inviteImage_() {
  if (!inviteBlob_) {
    inviteBlob_ = UrlFetchApp.fetch(MAIL.siteUrl + MAIL.imagePath).getBlob().setName('invitation.jpg');
  }
  return inviteBlob_;
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

function showStatus() {
  const guests = readGuests_();
  const keys = confirmedKeys_();
  const sent = guests.filter(function (g) { return g.sent; }).length;
  const confirmed = guests.filter(function (g) { return isConfirmed_(g, keys); }).length;
  const reminded = guests.filter(function (g) { return g.reminded; }).length;
  SpreadsheetApp.getUi().alert(
    'מוזמנים עם מייל: ' + guests.length + '\n' +
    'הזמנה נשלחה: ' + sent + '\n' +
    'מילאו את הטופס: ' + confirmed + '\n' +
    'קיבלו תזכורת: ' + reminded + '\n' +
    'ממתינים לתשובה: ' + (sent - confirmed) + '\n\n' +
    'מכסת מיילים שנותרה להיום: ' + MailApp.getRemainingDailyQuota());
}

/* ---------- עזר ---------- */

function normPhone_(p) {
  let s = String(p || '').replace(/[^\d]/g, '');
  if (s.indexOf('972') === 0) s = '0' + s.slice(3);
  return s;
}

function normName_(n) {
  return String(n || '').replace(/^'/, '').replace(/[\s"'״׳-]+/g, ' ').trim();
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
