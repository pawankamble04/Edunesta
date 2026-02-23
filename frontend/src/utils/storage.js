const TOKEN_KEY = "token";
const USER_KEY = "user";

const getSession = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const getLocal = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const safeParseUser = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const readAuthFrom = (store) => {
  if (!store) return { token: null, user: null };
  return {
    token: store.getItem(TOKEN_KEY),
    user: safeParseUser(store.getItem(USER_KEY)),
  };
};

export const migrateLegacyAuth = () => {
  const session = getSession();
  const local = getLocal();
  if (!session || !local) return;

  const sessionToken = session.getItem(TOKEN_KEY);
  if (sessionToken) return;

  const localToken = local.getItem(TOKEN_KEY);
  const localUser = local.getItem(USER_KEY);
  if (!localToken || !localUser) return;

  session.setItem(TOKEN_KEY, localToken);
  session.setItem(USER_KEY, localUser);
  local.removeItem(TOKEN_KEY);
  local.removeItem(USER_KEY);
};

export const getToken = () => {
  migrateLegacyAuth();
  const { token } = readAuthFrom(getSession());
  return token;
};

export const getUser = () => {
  migrateLegacyAuth();
  const { user } = readAuthFrom(getSession());
  return user;
};

export const setAuth = ({ token, user }) => {
  const session = getSession();
  const local = getLocal();
  if (!session) return;

  if (typeof token === "string" && token.trim()) {
    session.setItem(TOKEN_KEY, token);
  }
  if (user && typeof user === "object") {
    session.setItem(USER_KEY, JSON.stringify(user));
  }

  if (local) {
    local.removeItem(TOKEN_KEY);
    local.removeItem(USER_KEY);
  }
};

export const clearAuth = () => {
  const session = getSession();
  const local = getLocal();

  if (session) {
    session.removeItem(TOKEN_KEY);
    session.removeItem(USER_KEY);
  }

  if (local) {
    local.removeItem(TOKEN_KEY);
    local.removeItem(USER_KEY);
  }
};

export const isLoggedIn = () => Boolean(getToken());
