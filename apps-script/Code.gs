/**
 * שרת אישורי הגעה – Google Apps Script
 * הנתונים נשמרים בגיליון Google Sheets שאליו הסקריפט מחובר.
 *
 * התקנה (פעם אחת):
 * 1. בגיליון: הרחבות > Apps Script, הדביקו את הקובץ הזה במקום הקיים ושמרו.
 * 2. בחרו את הפונקציה setup בתפריט העליון ולחצו "הפעלה". אשרו הרשאות.
 *    ביומן (Execution log) יודפס קוד המנהל – שמרו אותו.
 * 3. פריסה > פריסה חדשה > סוג: אפליקציית אינטרנט
 *    "ביצוע בתור": אני | "למי יש גישה": כל אחד  → פריסה.
 * 4. העתיקו את כתובת ה-Web App (מסתיימת ב-/exec) לקובץ config.js בשדה apiUrl.
 */

const SHEET_NAME = 'אישורים';
// עמודת הילדים נוספה בסוף, כדי לא להזיז נתונים בגיליון קיים
const HEADERS = ['עודכן', 'שם', 'טלפון', 'מגיעים', 'גברים', 'נשים', 'הערה', 'ילדים (עד גיל 10)'];

function setup() {
  const sheet = getSheet_();
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('ADMIN_KEY');
  if (!key) {
    key = Utilities.getUuid().split('-')[0];
    props.setProperty('ADMIN_KEY', key);
  }
  Logger.log('הגיליון מוכן: ' + sheet.getName());
  Logger.log('קוד מנהל: ' + key);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.setRightToLeft(true);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.getRange('C:C').setNumberFormat('@'); // phone as text
  }
  if (sheet.getRange(1, HEADERS.length).getValue() !== HEADERS[HEADERS.length - 1]) {
    sheet.getRange(1, HEADERS.length).setValue(HEADERS[HEADERS.length - 1]).setFontWeight('bold');
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/^[=+\-@]/, "'$&").slice(0, max);
}

function toInt_(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : Math.max(0, Math.min(50, n));
}

/** קבלת אישור הגעה (נשלח מטופס האתר) */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const d = JSON.parse(e.postData.contents);
    const name = clean_(d.name, 100).trim();
    const phone = String(d.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
    if (!name || phone.length < 9) return json_({ ok: false, error: 'invalid' });

    const attending = d.attending === 'yes' ? 'כן' : 'לא';
    const men = attending === 'כן' ? toInt_(d.men) : 0;
    const women = attending === 'כן' ? toInt_(d.women) : 0;
    const kids = attending === 'כן' ? toInt_(d.kids) : 0;
    const row = [new Date(), name, "'" + phone, attending, men, women, clean_(d.note, 500), kids];

    const sheet = getSheet_();
    const last = sheet.getLastRow();
    let target = -1;
    if (last > 1) {
      const phones = sheet.getRange(2, 3, last - 1, 1).getValues();
      for (let i = 0; i < phones.length; i++) {
        if (String(phones[i][0]) === phone) { target = i + 2; break; }
      }
    }
    if (target > 0) sheet.getRange(target, 1, 1, row.length).setValues([row]); // עדכון קיים
    else sheet.appendRow(row);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

/** רשימת אישורים לדף הניהול – דורש קוד מנהל */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action !== 'list') return json_({ ok: true, service: 'rsvp' });
  const key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!key || p.key !== key) return json_({ ok: false, error: 'unauthorized' });

  const sheet = getSheet_();
  const last = sheet.getLastRow();
  const values = last > 1 ? sheet.getRange(2, 1, last - 1, HEADERS.length).getValues() : [];
  const rows = values.map(function (r) {
    return {
      updated: r[0] instanceof Date ? r[0].toISOString() : r[0],
      name: r[1], phone: String(r[2]),
      attending: r[3] === 'כן' ? 'yes' : 'no',
      men: r[4], women: r[5], note: r[6], kids: Number(r[7]) || 0,
    };
  });
  return json_({ ok: true, rows: rows });
}
