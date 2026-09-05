// 墨香斋 — 全站公共脚本：Toast / 登录守卫 / 用户菜单 / 弹窗工具

/* ========== 路径工具 ========== */

// 计算到站点根目录的前缀（users/detail.html 需要 ../）
function rootPrefix() {
  var depth = location.pathname.split('/').length - 2;
  return depth > 0 ? '../'.repeat(depth) : '';
}

/* ========== Toast ========== */

function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 2600;
  var container = document.getElementById('toast');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast';
    document.body.appendChild(container);
  }
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function () { toast.remove(); }, duration);
}

/* ========== 登录守卫 ========== */

(function authGuard() {
  var page = location.pathname.split('/').pop() || 'index.html';
  if (page === 'login.html' || page === 'register.html') return;
  var user = null;
  try { user = JSON.parse(localStorage.getItem('moxiang_user') || 'null'); } catch (e) {}
  if (!user) {
    location.replace(rootPrefix() + 'login.html');
  }
})();

// bfcache 兜底：浏览器后退/往返缓存恢复页面时重新校验登录态
window.addEventListener('pageshow', function (e) {
  if (!e.persisted) return;
  var page = location.pathname.split('/').pop() || 'index.html';
  if (page === 'login.html' || page === 'register.html') return;
  var user = null;
  try { user = JSON.parse(localStorage.getItem('moxiang_user') || 'null'); } catch (err) {}
  if (!user) location.reload();
});

/* ========== 当前用户信息注入侧边栏 ========== */

function injectUser() {
  var user = null;
  try { user = JSON.parse(localStorage.getItem('moxiang_user') || 'null'); } catch (e) {}
  if (!user) return;

  var nameEl = document.querySelector('.sidebar .user-info .who span');
  var avatarEl = document.querySelector('.sidebar .user-info .avatar');
  if (nameEl && user.username) nameEl.textContent = user.username;
  if (avatarEl && user.username) avatarEl.textContent = user.username.charAt(0).toUpperCase();
}

/* ========== 侧边栏用户下拉菜单（退出登录） ========== */

function injectUserMenu() {
  var info = document.querySelector('.sidebar .user-info');
  if (!info) return;

  var wrap = document.createElement('div');
  wrap.className = 'user-menu-wrap';
  info.parentNode.insertBefore(wrap, info);
  wrap.appendChild(info);

  var dd = document.createElement('div');
  dd.className = 'user-dropdown';
  dd.innerHTML =
    '<a href="#" data-act="profile">👤 个人中心</a>' +
    '<a href="#" class="danger" data-act="logout">🚪 退出登录</a>';
  wrap.appendChild(dd);

  info.addEventListener('click', function (e) {
    e.stopPropagation();
    dd.classList.toggle('show');
  });

  document.addEventListener('click', function () {
    dd.classList.remove('show');
  });

  dd.addEventListener('click', function (e) {
    var act = e.target.getAttribute('data-act');
    if (!act) return;
    e.preventDefault();
    if (act === 'profile') {
      location.href = rootPrefix() + 'profile.html';
    } else if (act === 'logout') {
      localStorage.removeItem('moxiang_user');
      showToast('已退出登录', 'info');
      setTimeout(function () {
        location.href = rootPrefix() + 'login.html';
      }, 500);
    }
  });
}

/* ========== DOM 就绪后初始化（无论脚本放置位置） ========== */

(function initApp() {
  function run() {
    injectUser();
    injectUserMenu();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();

/* ========== 表单校验工具 ========== */

// 标记错误：setFieldError(inputEl, '错误信息')
function setFieldError(inputEl, message) {
  var group = inputEl.closest('.form-group');
  if (!group) return;
  group.classList.add('has-error');
  var msg = group.querySelector('.error-msg');
  if (!msg) {
    msg = document.createElement('div');
    msg.className = 'error-msg';
    group.appendChild(msg);
  }
  msg.textContent = message;
}

function clearFieldError(inputEl) {
  var group = inputEl.closest('.form-group');
  if (group) group.classList.remove('has-error');
}

function clearAllErrors(formBox) {
  formBox.querySelectorAll('.form-group.has-error').forEach(function (g) {
    g.classList.remove('has-error');
  });
}

// 输入时自动清除自身错误态
document.addEventListener('input', function (e) {
  if (e.target.matches('.form-control')) clearFieldError(e.target);
});

/* ========== 确认弹窗 ========== */

// confirmDialog('确定删除？', function(){ ... 执行删除 ... })
function confirmDialog(message, onOk) {
  var mask = document.createElement('div');
  mask.className = 'modal-mask show';
  mask.innerHTML =
    '<div class="modal" style="max-width:380px;">' +
    '  <div class="modal-head"><span class="modal-title">操作确认</span><button class="modal-close">×</button></div>' +
    '  <div class="modal-body"><div class="modal-text">' + message + '</div></div>' +
    '  <div class="modal-foot">' +
    '    <button class="btn btn-secondary" data-act="cancel">取消</button>' +
    '    <button class="btn btn-danger" data-act="ok">确定</button>' +
    '  </div>' +
    '</div>';
  document.body.appendChild(mask);

  function close() { mask.remove(); }
  mask.querySelector('.modal-close').addEventListener('click', close);
  mask.querySelector('[data-act="cancel"]').addEventListener('click', close);
  mask.querySelector('[data-act="ok"]').addEventListener('click', function () {
    close();
    if (onOk) onOk();
  });
  mask.addEventListener('click', function (e) {
    if (e.target === mask) close();
  });
}
