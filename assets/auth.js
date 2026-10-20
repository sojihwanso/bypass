/* BYPASS 회원 기능 공통 설정
   - 프로젝트 주소와 공개 키(publishable key)는 브라우저에 노출되어도 되는 값입니다.
   - service_role 키나 데이터베이스 비밀번호는 절대 이 파일에 넣지 마세요.
   - 아이디는 Supabase에 "아이디@bypass.invalid" 형식의 이메일로 저장됩니다.
     .invalid 는 실제로 존재할 수 없는 주소라서, 메일이 잘못 발송될 일이 없습니다. */
(function () {
  const SUPABASE_URL = 'https://itzdjdgjqcpmxdfssfel.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_L2FP31VpA_dZfwqH4u6H0Q_UWJlCS6G';
  const ID_DOMAIN = 'bypass.invalid';

  const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  const ID_RULE = /^[a-z0-9_]{4,20}$/;
  const PW_MIN = 8;

  function normalizeId(value) { return value.trim().toLowerCase(); }
  function idToEmail(id) { return `${normalizeId(id)}@${ID_DOMAIN}`; }

  /* 로그인 뒤 돌아갈 주소: 이 사이트 안의 경로만 허용 */
  function safeNext(value, fallback) {
    if (value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) return value;
    return fallback;
  }

  function dateText(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  }

  /* 회원 구분: app_metadata 는 운영진만 바꿀 수 있는 값입니다. */
  function roleOf(user) {
    const r = user && user.app_metadata && user.app_metadata.bypass_role;
    if (r === 'staff') return { key: 'staff', label: '운영진' };
    if (r === 'member') return { key: 'member', label: '부원' };
    return { key: 'general', label: '일반 회원' };
  }

  function profileOf(user) {
    const meta = (user && user.user_metadata) || {};
    const email = (user && user.email) || '';
    const username = meta.username || email.split('@')[0];
    return { username, name: meta.display_name || username };
  }

  /* Supabase 오류를 화면 문구로 */
  function errorText(error, context) {
    if (!error) return '';
    const code = error.code || '';
    const status = error.status;
    if (error.name === 'AuthRetryableFetchError' || status === 0 || /fetch|network/i.test(error.message || '')) {
      return '서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';
    }
    if (code === 'invalid_credentials') return '아이디 또는 비밀번호가 맞지 않습니다.';
    if (code === 'user_already_exists' || code === 'email_exists') return '이미 사용 중인 아이디입니다. 다른 아이디를 정해 주세요.';
    if (code === 'weak_password') return `비밀번호가 너무 약합니다. ${PW_MIN}자 이상, 짐작하기 어렵게 정해 주세요.`;
    if (code === 'over_request_rate_limit' || status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    if (code === 'signup_disabled' || code === 'email_provider_disabled') return '지금은 회원가입을 받지 않습니다. 운영진에게 문의해 주세요.';
    if (code === 'email_not_confirmed' || code === 'over_email_send_rate_limit' || code === 'email_address_not_authorized') {
      return '가입 설정이 아직 끝나지 않았습니다. 운영진에게 알려 주세요. (메일 확인 설정)';
    }
    if (code === 'email_address_invalid') return '이 아이디는 쓸 수 없습니다. 다른 아이디를 정해 주세요.';
    const fallback = context === 'signup' ? '가입하지 못했습니다.' : '로그인하지 못했습니다.';
    return `${fallback} 잠시 후 다시 시도해 주세요.${code ? ` (${code})` : ''}`;
  }

  /* 비밀번호 보기 버튼 */
  function bindPasswordToggles(root) {
    (root || document).querySelectorAll('[data-pw-toggle]').forEach(btn => {
      const input = document.getElementById(btn.getAttribute('aria-controls'));
      btn.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? '숨기기' : '보기';
        btn.setAttribute('aria-pressed', String(show));
        input.focus();
      });
    });
  }

  function setBusy(button, busy, busyText) {
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = busyText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  window.BYPASS = {
    sb, ID_RULE, PW_MIN,
    normalizeId, idToEmail, safeNext, dateText, roleOf, profileOf, errorText,
    bindPasswordToggles, setBusy,
    unavailableText: '회원 기능을 불러오지 못했습니다. 새로고침해 주세요.'
  };
})();
