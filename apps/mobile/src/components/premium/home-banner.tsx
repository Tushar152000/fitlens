import {
  bannerHidden,
  bannerTooEarly,
  dismissBanner,
  NO_DISMISSALS,
  type BannerDismissals,
} from "@/lib/premium-banner";
import { useQuery } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { Camera, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Button, Text } from "@/components/ui";
import { track } from "@/lib/analytics";
import { useMe } from "@/lib/auth";
import { localYmd } from "@/lib/meal-param";
import { LIST_PRICE, openPaywall } from "@/lib/premium";
import { usageQuery } from "@/lib/queries";
import { makeStyles, radius, useColors } from "@/lib/theme";
import Animated from "react-native-reanimated";
import { appear, disappear } from "@/lib/motion";

const KEY = (userId: string) => `fitr8.premium.banner.${userId}`;

async function read(userId: string): Promise<BannerDismissals> {
  try {
    const raw =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(KEY(userId))
        : await SecureStore.getItemAsync(KEY(userId));
    return raw ? (JSON.parse(raw) as BannerDismissals) : NO_DISMISSALS;
  } catch {
    return NO_DISMISSALS;
  }
}

async function write(userId: string, d: BannerDismissals) {
  try {
    const raw = JSON.stringify(d);
    if (Platform.OS === "web") globalThis.localStorage?.setItem(KEY(userId), raw);
    else await SecureStore.setItemAsync(KEY(userId), raw);
  } catch {
    // Worst case the banner shows again today.
  }
}

/**
 * Design 14: on Today, under the calorie card, for free users only. Personal ("You typed 3 meals
 * today") and easy to dismiss: ✕ hides it for the day; hidden 3 days in a row, it rests for a week.
 * Never in the first 3 days after sign-up.
 */
export function PremiumBanner() {
  const me = useMe();
  const c = useColors();
  const styles = useStyles();
  const usage = useQuery(usageQuery);
  const onboardedAt = me.profile?.onboardedAt;
  // Read once per mount: this phone's dismissals, today's date and whether the account is new.
  const [state, setState] = useState<{ dismissals: BannerDismissals; today: string; newUser: boolean } | null>(null);
  useEffect(() => {
    const newUser = bannerTooEarly(onboardedAt, new Date());
    void read(me.id).then((dismissals) => setState({ dismissals, today: localYmd(), newUser }));
  }, [me.id, onboardedAt]);

  const typed = usage.data?.typedMeals?.today ?? 0;
  const visible =
    usage.data?.plan === "FREE" && state !== null && !state.newUser && !bannerHidden(state.dismissals, state.today);

  const shown = useRef(false);
  useEffect(() => {
    if (visible && !shown.current) {
      shown.current = true;
      track("premium_banner_shown", { meals_typed_today: typed });
    }
  }, [visible, typed]);

  if (!visible) return null;

  async function dismiss() {
    track("premium_banner_dismissed", { meals_typed_today: typed });
    if (!state) return;
    const next = dismissBanner(state.dismissals, state.today);
    setState({ ...state, dismissals: next });
    await write(me.id, next);
  }

  return (
    <Animated.View entering={appear} exiting={disappear} style={styles.banner}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View style={styles.icon}>
          <Camera size={20} color={c.white} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text weight={700} size={16}>
            {typed > 0 ? `You typed ${typed} ${typed === 1 ? "meal" : "meals"} today` : "Log meals faster with a photo"}
          </Text>
          <Text size={14} color={c.ink2}>
            Next time, snap a photo. Premium finds every dish on your plate and fills in calories and macros.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hide Premium banner for today"
          onPress={dismiss}
          hitSlop={8}
          style={styles.close}
        >
          <X size={18} color={c.ink3} />
        </Pressable>
      </View>
      <View style={styles.chips}>
        {["Photo scans", "Barcode", "AI Coach"].map((label) => (
          <View key={label} style={styles.chip}>
            <Text size={12} weight={600} color={c.brandText}>
              {label}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button
            onPress={() => {
              track("premium_banner_tapped", { meals_typed_today: typed });
              openPaywall("home_banner");
            }}
          >
            See Premium
          </Button>
        </View>
        <Text size={13} color={c.ink3} tabular>
          From {LIST_PRICE.perMonth} a month
        </Text>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  banner: {
    gap: 12,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.premiumLine,
    backgroundColor: c.surface,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", margin: -10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: c.brandSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
}));
