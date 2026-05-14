import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import pt from "../locales/pt-PT.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      "pt-PT": { translation: pt },
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
    },
    lng: (typeof localStorage !== "undefined" && localStorage.getItem("volleyiq:lang")) || "pt-PT",
    fallbackLng: "pt-PT",
    interpolation: { escapeValue: false },
  });

export default i18n;
