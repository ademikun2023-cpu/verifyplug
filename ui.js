// Lightweight interaction layer; authentication and saved data stay in app.js.
(() => {
  let mode = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login';
  let ready = false;
  const form = document.getElementById('authForm');
  const submit = document.getElementById('authSubmit');
  function setMode(next) {
    mode = next;
    document.querySelectorAll('[data-auth-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.authMode === mode)));
    document.getElementById('authTitle').textContent = mode === 'signup' ? 'A good place to start.' : 'Welcome back.';
    document.getElementById('authDescription').textContent = mode === 'signup' ? 'Create an account for your next purchase or your business.' : 'Sign in to pick up where you left off.';
    document.getElementById('roleField').hidden = mode !== 'signup';
    document.getElementById('passwordHelp').hidden = mode !== 'signup';
    document.getElementById('passwordInput').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    submit.textContent = ready ? mode === 'signup' ? 'Create account' : 'Sign in' : 'Connecting…';
  }
  if (form) {
    setMode(mode);
    document.querySelectorAll('[data-auth-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.authMode)));
    const role = new URLSearchParams(location.search).get('role') === 'vendor' ? 'vendor' : 'customer';
    document.querySelector(`input[name="role"][value="${role}"]`).checked = true;
    document.getElementById('roleInput').value = role;
    document.querySelectorAll('[name="role"]').forEach(r => r.addEventListener('change', () => { document.getElementById('roleInput').value = r.value; }));
    window.addEventListener('verifyplug:ready', () => { ready = true; submit.disabled = false; setMode(mode); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!ready || submit.disabled) return;
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      submit.textContent = mode === 'signup' ? 'Creating account…' : 'Signing in…';
      try { await window[mode](); }
      finally { submit.disabled = false; submit.removeAttribute('aria-busy'); setMode(mode); }
    });
    document.getElementById('passwordToggle').addEventListener('click', event => {
      const input = document.getElementById('passwordInput');
      const show = input.type === 'password'; input.type = show ? 'text' : 'password';
      event.currentTarget.textContent = show ? 'Hide' : 'Show';
      event.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      event.currentTarget.setAttribute('aria-pressed', String(show));
    });
  }
  // Enter submits a phone lookup without requiring a mouse or closing the mobile keyboard.
  document.getElementById('searchInput')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); window.searchVendor?.(); }
  });
  // Existing modal functions continue to work; this adds focus management and dismissal.
  let returnFocus;
  const focusable = 'button:not([disabled]), a[href], input:not([type="hidden"]), select, textarea, [tabindex="0"]';
  document.querySelectorAll('.modal').forEach(modal => {
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', modal.querySelector('h2')?.textContent || 'Dialog');
    const close = () => { modal.style.display = 'none'; };
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const items = [...modal.querySelectorAll(focusable)].filter(el => el.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    new MutationObserver(() => {
      if (modal.style.display === 'flex') { returnFocus = document.activeElement; document.body.classList.add('modal-open'); modal.querySelector(focusable)?.focus(); }
      else { document.body.classList.remove('modal-open'); returnFocus?.focus(); }
    }).observe(modal, {attributes:true, attributeFilter:['style']});
  });
})();
