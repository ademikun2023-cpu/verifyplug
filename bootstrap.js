// A failed SDK download must never expose onboarding or leave a silent blank screen.
import(document.body.dataset.page === 'profile' ? './profile.js' : './app.js').catch(error => {
  console.error('VerifyPlug could not start', error);
  const loading = document.getElementById('pageLoading');
  const errorPanel = document.getElementById('pageError');
  if (loading) loading.hidden = true;
  if (errorPanel) errorPanel.hidden = false;
  const message = document.getElementById('pageErrorMessage') || document.getElementById('authStatus');
  if (message) message.textContent = 'Couldn’t connect. Check your internet connection, then reload this page.';
  const profile = document.getElementById('profile');
  if (profile) profile.innerHTML = '<div class="card"><h1>Profile unavailable</h1><p>Check your connection and try again.</p><button onclick="location.reload()">Try again</button></div>';
  window.retryPage = () => location.reload();
});
