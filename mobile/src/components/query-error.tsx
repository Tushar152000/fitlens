import { RotateCw } from "lucide-react-native";
import { View } from "react-native";
import { Button, Card, FieldError } from "@/components/ui";

/** Inline "couldn't load" card with a retry, used by data screens. */
export function QueryError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <Card>
      <FieldError>{error.message || "Couldn't load this. Check your connection."}</FieldError>
      <View>
        <Button variant="secondary" icon={RotateCw} onPress={onRetry}>
          Try again
        </Button>
      </View>
    </Card>
  );
}
