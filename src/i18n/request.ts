import { getRequestConfig } from "next-intl/server";
import messages from "../../messages/es-AR.json";

// Single fixed locale: no cookies or headers are read, so pages stay prerenderable
export default getRequestConfig(() => ({
  locale: "es-AR",
  messages,
}));
