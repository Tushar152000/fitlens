/**
 * The name typed before sign-in, carried across the OAuth round trip in sessionStorage (this tab
 * only). /welcome/done saves it to the API once there's a session.
 */
const KEY = "fitr8.welcome.name";

export function stashName(name: string) {
  try {
    sessionStorage.setItem(KEY, name);
  } catch {
    // Storage blocked (private mode): the name is simply asked again later.
  }
}

export function takeName(): string | null {
  try {
    const name = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return name;
  } catch {
    return null;
  }
}
