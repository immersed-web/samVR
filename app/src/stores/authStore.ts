import { defineStore } from 'pinia';
import { logout as authLogout, login as authLogin, userAutoToken, guestAutoToken, isMissingSession, stopTokenRefresh } from '@/modules/authClient';
import { hasAtLeastSecurityRole, type JwtPayload } from 'schemas';
import jwtDecode from 'jwt-decode';
import { computed, ref } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  let sessionChecked = false;
  let sessionGeneration = 0;
  let pendingRestore: Promise<boolean> | undefined;
  let pendingLogout: Promise<void> | undefined;
  let pendingLogin: Promise<void> | undefined;

  function markSessionChecked() {
    sessionChecked = true;
    sessionGeneration++;
    pendingRestore = undefined;
    return sessionGeneration;
  }

  const _reset = () => {
    token.value = undefined;
    persistedUsername.value = undefined;
  };

  const token = ref<string>();
  const tokenOrThrow = () => {
    // console.log('accessing tokenOrThrow');
    if (!token.value) {
      throw Error('token was undefined when trying to access it from authstore');
    }
    return token.value;
  };
  const userData = computed(() => {
    try {
      if (!token.value) {
        throw new Error('token is undefined');
      }
      const decodedToken = jwtDecode<JwtPayload>(token.value);
      persistedUsername.value = decodedToken.username;
      // console.log(decodedToken);
      return decodedToken;
      // return JSON.parse(window.atob(state.jwt.split('.')[1])) as UserData;
    } catch (e) {
      return undefined;
    }
  });
  const isGuest = computed(() => userData.value?.role === 'guest');
  const userId = computed(() => userData.value?.userId);
  const username = computed(() => userData.value?.username);
  const persistedUsername = ref<string>();
  const role = computed(() => userData.value?.role);
  /**
   * Has a user id. Can be any role, including guest.
   */
  const isAuthenticated = computed(() => !!userId.value);
  /**
   * Has a user id. Can be any role, except guest.
   */
  const isLoggedIn = computed(() => isAuthenticated.value && hasAtLeastSecurityRole(role.value, 'user'));
  const routePrefix = computed(() => role.value && hasAtLeastSecurityRole(role.value, 'admin') ? 'admin' : 'user');
  async function autoGuest(username?: string) {
    const generation = markSessionChecked();
    if (pendingLogout) await pendingLogout;
    if (generation !== sessionGeneration) return;
    await guestAutoToken((t) => {
      if (generation === sessionGeneration) token.value = t;
    }, username);
  }
  async function restoreFromSession() {
    if (sessionChecked) return false;
    if (pendingRestore) return pendingRestore;
    const generation = sessionGeneration;
    const restore = (async () => {
      try {
        await userAutoToken(t => {
          if (generation === sessionGeneration) token.value = t;
        }, () => {
          if (generation === sessionGeneration) token.value = undefined;
        });
        if (generation !== sessionGeneration) return false;
        sessionChecked = true;
        return !!token.value;
      } catch (error) {
        if (generation !== sessionGeneration) return false;
        if (!isMissingSession(error)) throw error;
        sessionChecked = true;
        return false;
      }
    })();
    pendingRestore = restore;
    try {
      return await restore;
    } finally {
      if (pendingRestore === restore) pendingRestore = undefined;
    }
  }
  async function logout() {
    if (pendingLogout) return pendingLogout;
    markSessionChecked();
    stopTokenRefresh();
    const loginRequest = pendingLogin;
    const logoutRequest = (async () => {
      // Login may still set a cookie, even after local authentication is cleared.
      if (loginRequest) await loginRequest.catch(() => {});
      await authLogout();
    })();
    pendingLogout = logoutRequest;
    console.log('removing guestAvatarSettings')
    localStorage.removeItem('guestAvatarSettings')
    _reset();
    try {
      await logoutRequest;
    } finally {
      if (pendingLogout === logoutRequest) pendingLogout = undefined;
    }
  }
  async function login(username: string, password: string) {
    const generation = markSessionChecked();
    if (pendingLogout) await pendingLogout;
    if (generation !== sessionGeneration) return;
    const loginRequest = authLogin(username, password);
    pendingLogin = loginRequest;
    try {
      await loginRequest;
    } finally {
      if (pendingLogin === loginRequest) pendingLogin = undefined;
    }
    if (generation !== sessionGeneration) return;
    await userAutoToken((t) => {
      // console.log('new token! ', t);
      if (generation === sessionGeneration) token.value = t;
    }, () => {
      if (generation === sessionGeneration) token.value = undefined;
    });
  }

  return {
    isAuthenticated,
    isNotGuest: isLoggedIn,
    token,
    tokenOrThrow,
    userData,
    isGuest,
    userId,
    role,
    username,
    persistedUsername,
    autoGuest,
    restoreFromSession,
    logout,
    login,
    routePrefix,
  };
}, {
  persist: {
    paths: ['persistedUsername'],
  },
});
