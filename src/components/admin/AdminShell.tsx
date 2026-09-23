import { ReactNode } from "react";
import { Anchor, Button, Container, Divider, Group, Text, Title } from "@mantine/core";
import { IconLogout } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../../context/useAdminAuth";

export default function AdminShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAdminAuth();

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="sm">
        <Anchor component={Link} to="/admin" underline="never" c="dark">
          <Title order={3}>Gen. Papers · Administración</Title>
        </Anchor>
        <Group gap="sm">
          <Text size="sm" c="dimmed">
            {user?.email}
          </Text>
          <Button
            variant="default"
            size="xs"
            leftSection={<IconLogout size={16} />}
            onClick={() => void signOut()}
          >
            Salir
          </Button>
        </Group>
      </Group>
      <Divider mb="lg" />
      {children}
    </Container>
  );
}
