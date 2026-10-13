import * as WebBrowser from "expo-web-browser";
import { API_URL } from "./config";

/** The website's legal pages, in an in-app browser (both stores require them inside the app). */
export const openLegal = (page: "privacy" | "terms") => WebBrowser.openBrowserAsync(`${API_URL}/${page}`);
