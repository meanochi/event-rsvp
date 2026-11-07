/**
 * תבנית המייל (חלק ב' של שליחת ההזמנות).
 * קובץ נפרד ב-Apps Script בשם MailTemplate, לצד Mailer.
 *
 * עיצוב המייל נמצא בקובץ email-template.html שבאתר, והסקריפט טוען אותו משם בזמן השליחה.
 * לשינוי העיצוב – עורכים את email-template.html במאגר, בלי לגעת בקובץ הזה.
 */

const TEMPLATE_PATH = 'email-template.html';

function buildHtml_(name, link, isReminder) {
  const intro = isReminder
    ? 'טרם קיבלנו את אישור ההגעה שלכם. נודה לכם אם תאשרו בלחיצה אחת – זה עוזר לנו מאוד בהיערכות.'
    : 'בשבח והודיה להשי"ת, נשמח לראותכם משתתפים בשמחת בר המצווה של בננו היקר.';
  const values = {
    NAME: esc_(name),
    INTRO: esc_(intro),
    EVENT: esc_(MAIL.eventLine),
    PLACE: esc_(MAIL.placeLine),
    LINK: esc_(link),
    SITE: esc_(MAIL.siteUrl),
    FROM: esc_(MAIL.fromName),
    COLOR: MAIL.color,
  };
  return emailTemplate_().replace(/\{\{(\w+)\}\}/g, function (m, key) {
    return key in values ? values[key] : m;
  });
}

function buildText_(name, link, isReminder) {
  return name + ' היקרים,\n\n' +
    (isReminder ? 'טרם קיבלנו את אישור ההגעה שלכם.\n' : 'נשמח לראותכם משתתפים בשמחת בר המצווה של בננו היקר.\n') +
    MAIL.eventLine + '\n' + MAIL.placeLine + '\n\n' +
    'לאישור הגעה: ' + link + '\n\n' + MAIL.fromName;
}

let templateText_ = null;
function emailTemplate_() {
  if (!templateText_) {
    templateText_ = UrlFetchApp.fetch(MAIL.siteUrl + TEMPLATE_PATH + '?t=' + Date.now())
      .getContentText('UTF-8');
  }
  return templateText_;
}

let inviteBlob_ = null;
function inviteImage_() {
  if (!inviteBlob_) {
    inviteBlob_ = UrlFetchApp.fetch(MAIL.siteUrl + MAIL.imagePath).getBlob().setName('invitation.jpg');
  }
  return inviteBlob_;
}
