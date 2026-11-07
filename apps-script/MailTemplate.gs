/**
 * תבנית המייל (חלק ב' של שליחת ההזמנות).
 * קובץ נפרד ב-Apps Script בשם MailTemplate, לצד Mailer.
 *
 * המייל נבנה כאן בעזרת פונקציית עזר, ולא כטקסט HTML מוכן,
 * כדי שהעורך של Apps Script יוכל לשמור את הקובץ גם מאחורי מסננים.
 */

const LT_ = String.fromCharCode(60);
const GT_ = String.fromCharCode(62);

/** יוצר תגית: el_('p', 'font-size:16px', 'טקסט') */
function el_(tag, style, content, attrs) {
  let a = style ? ' style="' + style + '"' : '';
  if (attrs) Object.keys(attrs).forEach(function (k) { a += ' ' + k + '="' + attrs[k] + '"'; });
  if (content === undefined) return LT_ + tag + a + GT_;
  return LT_ + tag + a + GT_ + content + LT_ + '/' + tag + GT_;
}

function buildHtml_(name, link, isReminder) {
  const intro = isReminder
    ? 'טרם קיבלנו את אישור ההגעה שלכם. נודה לכם אם תאשרו בלחיצה אחת – זה עוזר לנו מאוד בהיערכות.'
    : 'בשבח והודיה להשי"ת, נשמח לראותכם משתתפים בשמחת בר המצווה של בננו היקר.';
  const href = esc_(link);
  const image = el_('img', 'width:100%;max-width:500px;border-radius:10px;display:block;margin:0 auto 18px;',
    undefined, { src: MAIL.siteUrl + MAIL.imagePath, alt: 'הזמנה', width: '500' });
  const button = el_('a', 'display:inline-block;background:' + MAIL.color + ';color:#ffffff;text-decoration:none;' +
    'font-size:18px;font-weight:bold;padding:14px 36px;border-radius:10px;', 'לאישור הגעה – לחצו כאן', { href: href });
  const fallback = el_('a', 'color:' + MAIL.color + ';', esc_(MAIL.siteUrl), { href: href });

  const inner =
    el_('p', 'font-size:18px;margin:0 0 8px;', el_('b', '', esc_(name) + ' היקרים,')) +
    el_('p', 'font-size:16px;line-height:1.6;margin:0 0 18px;', esc_(intro)) +
    image +
    el_('p', 'font-size:15px;line-height:1.6;margin:0 0 4px;', esc_(MAIL.eventLine)) +
    el_('p', 'font-size:15px;line-height:1.6;margin:0 0 22px;', esc_(MAIL.placeLine)) +
    el_('p', 'font-size:15px;line-height:1.6;margin:0 0 16px;color:' + MAIL.color + ';',
      'מאחר והאירוע משפחתי בלבד, נשמח שתעדכנו בהקדם כדי שנוכל להיערך בהתאם' + el_('br', '') + 'תודה מראש') +
    button +
    el_('p', 'font-size:13px;color:#7a6f66;margin:18px 0 0;', 'אם הכפתור אינו פועל: ' + fallback) +
    el_('p', 'font-size:16px;margin:22px 0 0;', el_('b', '', esc_(MAIL.fromName)));

  const card = el_('div', 'max-width:560px;margin:0 auto;background:#fffcf7;border:1px solid #e6dccd;' +
    'border-radius:14px;padding:24px;text-align:center;', inner);
  return el_('div', 'background:#f7f1e8;padding:24px 12px;font-family:Arial,sans-serif;color:#3d3631;', card, { dir: 'rtl' });
}

function buildText_(name, link, isReminder) {
  return name + ' היקרים,\n\n' +
    (isReminder ? 'טרם קיבלנו את אישור ההגעה שלכם.\n' : 'נשמח לראותכם משתתפים בשמחת בר המצווה של בננו היקר.\n') +
    MAIL.eventLine + '\n' + MAIL.placeLine + '\n\n' +
    'לאישור הגעה: ' + link + '\n\n' + MAIL.fromName;
}
