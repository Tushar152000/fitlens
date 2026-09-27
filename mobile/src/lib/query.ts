import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import { ApiError } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry auth or validation errors; do retry flaky networks.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

/** Refetch when the app comes back to the foreground, and pause while offline. */
export function wireQueryLifecycle() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)),
  );
  const sub = AppState.addEventListener("change", (status) => {
    if (Platform.OS !== "web") focusManager.setFocused(status === "active");
  });
  return () => sub.remove();
}

/** After logging or editing food: Today, the workout fuel card and usuals all change. */
export function refreshDay() {
  queryClient.invalidateQueries({ queryKey: ["day"] });
  queryClient.invalidateQueries({ queryKey: ["workout"] });
  queryClient.invalidateQueries({ queryKey: ["usuals"] });
  queryClient.invalidateQueries({ queryKey: ["history"] });
}
