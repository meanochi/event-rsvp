/**
 * תבנית המייל (חלק ב' של שליחת ההזמנות).
 * קובץ נפרד ב-Apps Script בשם MailTemplate, לצד Mailer.
 */

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

