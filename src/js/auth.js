import { GOOGLE_CLIENT_ID, GOOGLE_SHEETS_SCOPE } from './config.js';

let tokenClient = null;
let onSignIn = () => {};
let onStatus = () => {};
let onSignedOut = () => {};
let loginButton = null;

function waitForGoogleLibrary() {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (window.google?.accounts?.oauth2) {
        clearInterval(timer);
        resolve(window.google);
      }
      if (tries > 200) {
        clearInterval(timer);
        reject(new Error('Google 로그인 라이브러리를 불러오지 못했습니다.'));
      }
    }, 50);
  });
}

async function fetchUserProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  const profile = await response.json();
  return {
    name: profile.name || profile.email || 'Google 사용자',
    email: profile.email || '',
    picture: profile.picture || '',
  };
}

export async function initGoogleAuth({ loginButtonElement, onSignedIn, onStatusChange, onLogout }) {
  onSignIn = onSignedIn;
  onStatus = onStatusChange;
  onSignedOut = onLogout;
  loginButton = loginButtonElement;

  const googleApi = await waitForGoogleLibrary();

  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('YOUR_GOOGLE_CLIENT_ID')) {
    onStatus('Google Client ID를 먼저 입력해 주세요.');
    return;
  }

  tokenClient = googleApi.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SHEETS_SCOPE,
    callback: async (tokenResponse) => {
      if (tokenResponse?.error) {
        onStatus('로그인이 완료되지 않았습니다.');
        return;
      }

      const user = await fetchUserProfile(tokenResponse.access_token);
      onStatus('');
      onSignIn({
        user,
        accessToken: tokenResponse.access_token,
        grantedScopes: tokenResponse.scope || '',
      });
    },
    error_callback: (error) => {
      const msg = error?.type === 'popup_closed' ? '로그인 창이 닫혔습니다.' : '로그인 중 문제가 발생했습니다.';
      onStatus(msg);
    },
  });

  if (loginButton) {
    loginButton.addEventListener('click', () => requestSheetsAccess(true), { once: false });
  }
}

export function requestSheetsAccess(promptConsent = false) {
  if (!tokenClient) {
    onStatus('Google 인증이 아직 준비되지 않았습니다.');
    return;
  }

  onStatus('로그인 중입니다.');
  tokenClient.requestAccessToken({
    prompt: promptConsent ? 'consent select_account' : '',
  });
}

export function signOut(accessToken, userEmail = '') {
  if (!window.google?.accounts) {
    onSignedOut();
    return;
  }

  try {
    if (accessToken) {
      window.google.accounts.oauth2.revoke(accessToken, () => {
        if (userEmail) {
          window.google.accounts.id?.revoke?.(userEmail, () => onSignedOut());
        } else {
          onSignedOut();
        }
      });
      return;
    }
  } catch {
    // no-op
  }

  onSignedOut();
}
