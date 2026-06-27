/**
 * MAD101 — Nhận kết quả thi và ghi vào Google Sheet.
 *
 * CÁCH DÙNG (làm 1 lần):
 *  1. Tạo 1 Google Sheet trống (sheets.new).
 *  2. Trong Sheet: menu Extensions (Tiện ích mở rộng) → Apps Script.
 *  3. Xoá code mẫu, dán TOÀN BỘ file này vào, bấm Save.
 *  4. Bấm Deploy (Triển khai) → New deployment → chọn type "Web app".
 *       - Description: tuỳ ý
 *       - Execute as:  Me (chính bạn)
 *       - Who has access:  Anyone  (Bất kỳ ai)  ← bắt buộc để web gửi được
 *     Bấm Deploy, cấp quyền (Authorize) khi được hỏi.
 *  5. Copy "Web app URL" (dạng https://script.google.com/macros/s/..../exec).
 *  6. Dán URL đó vào biến RESULTS_ENDPOINT trong assets/app.js, rồi commit/push.
 *
 * Mỗi lần học viên nộp bài, một dòng mới sẽ tự thêm vào sheet "KetQua".
 * Khi bạn sửa code, nhớ Deploy → Manage deployments → Edit → Version: New version.
 */

var SHEET_NAME = 'KetQua';
var HEADERS = ['Thời điểm nhận', 'Họ tên', 'MSSV', 'Bộ', 'Tên đề', 'Mã đề',
               'Điểm (%)', 'Đúng', 'Tổng', 'Thời gian (giây)', 'Thời gian (mm:ss)', 'Nộp lúc',
               'HV chọn', 'Đáp án đúng', 'Đúng/Sai', 'Câu sai'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // tránh ghi đè khi nhiều bài nộp cùng lúc
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) sh = ss.insertSheet(SHEET_NAME);
    // tạo / mở rộng dòng tiêu đề nếu thiếu (kể cả sheet cũ chỉ có 12 cột)
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
    } else {
      var head = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0];
      if (head[HEADERS.length - 1] !== HEADERS[HEADERS.length - 1]) {
        sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      }
    }

    var d = JSON.parse(e.postData.contents);

    // 3 cột chi tiết: ưu tiên chuỗi đã định dạng từ web, nếu không thì tự dựng từ details
    var picksStr = d.picksStr, keyStr = d.keyStr, resultStr = d.resultStr, wrongStr = d.wrongStr;
    if ((!picksStr || !keyStr || !resultStr) && d.details && d.details.length) {
      picksStr  = d.details.map(function (x) { return x.n + '.' + (x.pick || '-'); }).join(' ');
      keyStr    = d.details.map(function (x) { return x.n + '.' + (x.ans || '-'); }).join(' ');
      resultStr = d.details.map(function (x) { return x.n + '.' + (x.ok ? 'Đ' : 'S'); }).join(' ');
    }
    if (wrongStr == null && d.details && d.details.length) {
      wrongStr = d.details.filter(function (x) { return x.ans && !x.ok; })
                          .map(function (x) { return x.n; }).join(', ');
    }

    sh.appendRow([
      new Date(),
      d.name || '', d.mssv || '',
      d.section || '', d.examName || '', d.examId || '',
      d.score, d.correct, d.total,
      Math.round(d.timeSec || 0), d.timeMMSS || '', d.finishedAt || '',
      picksStr || '', keyStr || '', resultStr || '', wrongStr || ''
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Mở URL bằng trình duyệt để kiểm tra đã deploy đúng chưa.
function doGet() {
  return ContentService.createTextOutput('MAD101 results endpoint OK');
}
