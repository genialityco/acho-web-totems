import { ReactNode } from "react";
import { Alert, Button, Group, Modal, Text } from "@mantine/core";

type Props = {
  opened: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  confirmColor?: string;
  confirmDisabled?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
};

export default function ConfirmModal({
  opened,
  title,
  message,
  confirmLabel = "Confirmar",
  confirmColor = "red",
  confirmDisabled = false,
  loading = false,
  error,
  onConfirm,
  onClose,
  children,
}: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Text size="sm">{message}</Text>
      {children}
      {error && (
        <Alert color="red" mt="md">
          {error}
        </Alert>
      )}
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button color={confirmColor} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
