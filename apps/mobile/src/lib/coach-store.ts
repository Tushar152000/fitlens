import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "fitlens.coach.conversation";

/** The coach thread to reopen. Same storage as the session token (localStorage on the web preview). */
export async function readConversationId(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function writeConversationId(id: string | null): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (id) globalThis.localStorage?.setItem(KEY, id);
      else globalThis.localStorage?.removeItem(KEY);
      return;
    }
    if (id) await SecureStore.setItemAsync(KEY, id);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Losing the thread id only means the next visit starts a new chat.
  }
}
