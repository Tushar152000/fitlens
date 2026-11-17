import { Stack } from "expo-router";
import { useColors } from "@/lib/theme";

export default function LogLayout() {
  const c = useColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.ground } }} />;
}
