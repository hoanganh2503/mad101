/* ============================================================
   App dùng chung cho web thi trắc nghiệm MAD101 (web tĩnh)
   - manifest.json : danh sách đề + ảnh câu hỏi
   - answers.json  : đáp án đúng (admin quản lý, commit vào repo)
   - localStorage  : tiến độ & kết quả của từng học viên (theo máy)
   ============================================================ */

const OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F'];

// Thời gian cho mỗi câu (giây). 1.2 phút = 72 giây. Đổi tại đây nếu muốn.
const SEC_PER_QUESTION = 72;

// ---- localStorage keys ----
const LS_PROGRESS = 'mad101.progress.v1'; // { [examId]: {done, bestScore, lastScore, lastTimeSec, attempts, lastAt} }
const LS_RESULTS  = 'mad101.results.v1';  // [ {examId, section, examName, total, correct, score, timeSec, finishedAt, picks} ]
const LS_ADMIN    = 'mad101.admin.v1';    // "1" nếu đã đăng nhập admin
const LS_STUDENT  = 'mad101.student.v1';  // { name, mssv }

// ---- Đổi mật khẩu admin tại đây (lưu ý: web tĩnh không bảo mật thật,
//      ai xem source cũng thấy — chỉ để tránh học viên bấm nhầm vào trang admin) ----
const ADMIN_PASSWORD = 'mad101';

// ---- Gom kết quả về Google Sheet ----
// Dán link Web App của Google Apps Script vào đây (xem README mục "Gom kết quả").
// Để trống "" nếu chưa dùng — khi đó kết quả chỉ lưu trên máy học viên.
const RESULTS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxGVqJN6wVns_nD7s3ZXa3NnLXddWavxABk-pHf9tSqNsvwCRy2GsG2aO_xE1NYj5JQeg/exec';

// ---------- fetch helpers ----------
async function loadManifest() {
  const res = await fetch('data/manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Không tải được data/manifest.json');
  return res.json();
}
async function loadAnswers() {
  try {
    const res = await fetch('data/answers.json', { cache: 'no-store' });
    if (!res.ok) return {};
    return await res.json();
  } catch { return {}; }
}

// ảnh có dấu cách / tiếng Việt trong tên folder -> phải encode từng đoạn
function imgUrl(examId, img) {
  return examId.split('/').map(encodeURIComponent).join('/') + '/' + encodeURIComponent(img);
}

function findExam(manifest, examId) {
  for (const sec of Object.keys(manifest.sections)) {
    const e = manifest.sections[sec].find(x => x.id === examId);
    if (e) return { ...e, section: sec };
  }
  return null;
}

// ---------- localStorage ----------
function getJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function setJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function getProgress() { return getJSON(LS_PROGRESS, {}); }
function getResults() { return getJSON(LS_RESULTS, []); }

function saveResult(result) {
  // result: {examId, section, examName, total, correct, score, timeSec, finishedAt, picks}
  const results = getResults();
  results.unshift(result);
  setJSON(LS_RESULTS, results);

  const prog = getProgress();
  const p = prog[result.examId] || { attempts: 0, bestScore: 0 };
  p.attempts = (p.attempts || 0) + 1;
  p.done = true;
  p.lastScore = result.score;
  p.lastTimeSec = result.timeSec;
  p.lastAt = result.finishedAt;
  p.bestScore = Math.max(p.bestScore || 0, result.score);
  prog[result.examId] = p;
  setJSON(LS_PROGRESS, prog);
}

// ---------- thông tin học viên ----------
function getStudent() { return getJSON(LS_STUDENT, { name: '', mssv: '' }); }
function setStudent(s) { setJSON(LS_STUDENT, s); }

// Gửi kết quả về Google Sheet (nếu đã cấu hình RESULTS_ENDPOINT).
// Dùng no-cors + body text → không bị chặn CORS, không cần đọc phản hồi (gửi là xong).
function submitResultToSheet(payload) {
  if (!RESULTS_ENDPOINT) return Promise.resolve(false);
  return fetch(RESULTS_ENDPOINT, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  }).then(() => true).catch(() => false);
}

// ---------- format ----------
function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN');
}
function pct(correct, total) {
  return total ? Math.round((correct / total) * 1000) / 10 : 0;
}

// ---------- download ----------
function downloadFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- toast ----------
let _toastTimer;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ---------- admin auth (chỉ là cổng UI, không phải bảo mật thật) ----------
function isAdmin() { return localStorage.getItem(LS_ADMIN) === '1'; }
function loginAdmin(pw) {
  if (pw === ADMIN_PASSWORD) { localStorage.setItem(LS_ADMIN, '1'); return true; }
  return false;
}
function logoutAdmin() { localStorage.removeItem(LS_ADMIN); }

// ---------- shared topbar ----------
function renderTopbar(active) {
  const links = [
    ['index.html', 'Đề thi'],
    ['results.html', 'Kết quả của tôi'],
    ['admin.html', 'Admin'],
  ];
  return `
  <div class="topbar"><div class="inner">
    <div class="brand">MAD<span>101</span> · Thi thử</div>
    <div class="grow"></div>
    <nav class="nav">
      ${links.map(([h, t]) => `<a href="${h}" class="${active === h ? 'active' : ''}">${t}</a>`).join('')}
    </nav>
  </div></div>`;
}
