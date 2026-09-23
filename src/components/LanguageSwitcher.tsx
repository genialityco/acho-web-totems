import { SegmentedControl } from "@mantine/core";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { value: "es", label: "ES" },
  { value: "en", label: "EN" },
];

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage === "en" ? "en" : "es";

  return (
    <SegmentedControl
      size="xs"
      value={current}
      onChange={(value) => void i18n.changeLanguage(value)}
      data={LANGUAGES}
      aria-label={t("common.changeLanguage")}
    />
  );
}
