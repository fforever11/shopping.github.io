/* ==========================================================================
   图提取 ImageGrab 官网交互脚本
   模块：
   1. 移动端汉堡菜单
   2. 导航栏滚动吸顶状态
   3. 当前区块高亮（scroll spy）
   4. 进入视口淡入上移（IntersectionObserver）
   5. 下载按钮占位提示
   6. 页脚年份
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;

  /* 缓存常用节点 */
  var header = doc.querySelector('.site-header');
  var navToggle = doc.querySelector('.nav-toggle');
  var siteNav = doc.querySelector('.site-nav');
  var navLinks = Array.prototype.slice.call(
    doc.querySelectorAll('.nav-menu a[href^="#"]')
  );
  var toast = doc.getElementById('toast');

  /* 媒体查询：桌面断点 / 用户是否偏好减少动效 */
  var desktopQuery = window.matchMedia('(min-width: 768px)');
  var reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ========================================================================
     1. 移动端汉堡菜单
     ======================================================================== */
  function setMenuOpen(open) {
    if (!navToggle || !siteNav) return;
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    siteNav.classList.toggle('is-open', open);
  }

  function isMenuOpen() {
    return !!navToggle && navToggle.getAttribute('aria-expanded') === 'true';
  }

  if (navToggle && siteNav) {
    /* 点击按钮开合 */
    navToggle.addEventListener('click', function () {
      setMenuOpen(!isMenuOpen());
    });

    /* 点击任意导航链接后收起（锚点跳转照常进行） */
    siteNav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenuOpen(false);
    });

    /* 点击导航栏以外的区域收起 */
    doc.addEventListener('click', function (event) {
      if (!isMenuOpen()) return;
      if (!event.target.closest('.site-header')) setMenuOpen(false);
    });

    /* Esc 收起并把焦点还给按钮 */
    doc.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !isMenuOpen()) return;
      setMenuOpen(false);
      navToggle.focus();
    });

    /* 视口放大到桌面断点时自动收起，避免状态残留 */
    var handleBreakpointChange = function (event) {
      if (event.matches) setMenuOpen(false);
    };
    if (typeof desktopQuery.addEventListener === 'function') {
      desktopQuery.addEventListener('change', handleBreakpointChange);
    } else if (typeof desktopQuery.addListener === 'function') {
      desktopQuery.addListener(handleBreakpointChange);
    }
  }

  /* ========================================================================
     2 + 3. 吸顶状态与当前区块高亮
     ======================================================================== */
  /* 建立「导航链接 → 对应 section」的映射，找不到的链接自动忽略 */
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute('href').slice(1);
      var el = id ? doc.getElementById(id) : null;
      return el ? { id: id, el: el, link: link } : null;
    })
    .filter(Boolean);

  function updateActiveNav() {
    if (!sections.length) return;

    var offset = (header ? header.offsetHeight : 0) + 24;
    var scrollPos = window.scrollY + offset;
    var activeId = '';

    /* 取「已经滚过顶部」的最后一个区块作为当前区块 */
    sections.forEach(function (item) {
      if (item.el.offsetTop <= scrollPos) activeId = item.id;
    });

    /* 到底部时高亮最后一个区块（底部 CTA 往往滚不到顶部） */
    var reachedBottom =
      window.innerHeight + window.scrollY >=
      doc.documentElement.scrollHeight - 4;
    if (reachedBottom) {
      activeId = sections[sections.length - 1].id;
    }

    sections.forEach(function (item) {
      if (item.id === activeId) {
        item.link.setAttribute('aria-current', 'true');
      } else {
        item.link.removeAttribute('aria-current');
      }
    });
  }

  var scrollTicking = false;

  function handleScroll() {
    if (scrollTicking) return;
    scrollTicking = true;

    window.requestAnimationFrame(function () {
      if (header) {
        header.classList.toggle('is-scrolled', window.scrollY > 8);
      }
      updateActiveNav();
      scrollTicking = false;
    });
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleScroll, { passive: true });
  window.addEventListener('load', handleScroll);

  /* 首次进入时同步一次状态 */
  handleScroll();

  /* ========================================================================
     4. 滚动进入视口时淡入上移
     ======================================================================== */
  var revealElements = Array.prototype.slice.call(doc.querySelectorAll('.reveal'));

  function revealAll() {
    revealElements.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  if (!('IntersectionObserver' in window) || reduceMotionQuery.matches) {
    /* 浏览器不支持或用户偏好减少动效：直接显示全部内容 */
    revealAll();
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          /* 动画只播放一次，播放后取消监听 */
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
    );

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* ========================================================================
     5. 下载按钮占位提示
     说明：按钮仍指向 #download 时拦截点击并提示；
           之后把 href 换成真实 zip 地址后，拦截自动失效。
     ======================================================================== */
  var toastTimer = null;

  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('is-visible');

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 3800);
  }

  var downloadTriggers = doc.querySelectorAll('[data-download]');

  Array.prototype.forEach.call(downloadTriggers, function (trigger) {
    trigger.addEventListener('click', function (event) {
      var href = trigger.getAttribute('href') || '';
      /* 真实下载链接（非页内锚点）不做拦截 */
      if (href.charAt(0) !== '#') return;

      event.preventDefault();
      showToast(
        '插件压缩包尚未上传：将打包好的 zip 放到 docs/assets/ 后，把按钮链接改为该文件即可。'
      );
    });
  });

  /* ========================================================================
     6. 页脚年份
     ======================================================================== */
  var yearEl = doc.getElementById('year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();
