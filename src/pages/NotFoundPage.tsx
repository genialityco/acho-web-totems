import { Center, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import PublicShell from "../components/PublicShell";

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <PublicShell>
      <Center h="50vh">
        <Text size="lg" ta="center">
          {t("notFoundPage.message")}
        </Text>
      </Center>
    </PublicShell>
  );
}
