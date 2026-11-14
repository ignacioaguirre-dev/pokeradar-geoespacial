import type messages from "../../messages/es-AR.json";

// Makes locale and message keys typed across the app
declare module "next-intl" {
  interface AppConfig {
    Locale: "es-AR";
    Messages: typeof messages;
  }
}
