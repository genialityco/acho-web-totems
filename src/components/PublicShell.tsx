import { ReactNode } from "react";
import { Box, Container, Image } from "@mantine/core";
import LanguageSwitcher from "./LanguageSwitcher";

const DEFAULT_BANNER_URL =
  "https://ik.imagekit.io/6cx9tc1kx/Imagenes%20App%20Prueba/LOGO_ACHO.png?updatedAt=1726756148659";

export default function PublicShell({
  bannerUrl,
  children,
}: {
  bannerUrl?: string | null;
  children: ReactNode;
}) {
  return (
    <Box>
      <Box
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          padding: "0.5rem 1rem",
          borderBottom: "1px solid #eaeaea",
          backgroundColor: "#f8f9fa",
        }}
      >
        <Box
          style={{
            width: "100%",
            height: 80,
            marginBlock: "10px",
            overflow: "hidden",
          }}
        >
          <Image src={bannerUrl || DEFAULT_BANNER_URL} alt="Banner" fit="contain" height={80} />
        </Box>
        <Box style={{ position: "absolute", top: 10, right: 12 }}>
          <LanguageSwitcher />
        </Box>
      </Box>

      <Container fluid mt="md">
        {children}
      </Container>
    </Box>
  );
}
