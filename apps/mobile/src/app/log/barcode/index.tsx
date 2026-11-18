import { Redirect, useLocalSearchParams } from "expo-router";
import { choiceParams, dayFromParam, mealFromParam } from "@/lib/meal-param";

/**
 * There's no separate barcode mode any more: the camera (/log) opens a product as soon as it reads
 * its barcode. Old links here land on the camera with the meal and day kept.
 */
export default function BarcodeRedirect() {
  const route = useLocalSearchParams<{ meal?: string; date?: string }>();
  return (
    <Redirect href={{ pathname: "/log", params: choiceParams(mealFromParam(route.meal), dayFromParam(route.date)) }} />
  );
}
