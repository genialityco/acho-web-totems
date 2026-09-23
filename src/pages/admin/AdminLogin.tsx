import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  Alert,
  Button,
  Center,
  Container,
  Loader,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { FirebaseError } from "firebase/app";
import { useAdminAuth } from "../../context/useAdminAuth";

const loginErrorMessage = (error: unknown) => {
  switch (error instanceof FirebaseError ? error.code : "") {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Correo o contraseña incorrectos.";
    case "auth/invalid-email":
      return "El correo no es válido.";
    case "auth/user-disabled":
      return "Esta cuenta está deshabilitada.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Intenta de nuevo más tarde.";
    case "auth/network-request-failed":
      return "Sin conexión. Revisa tu internet e intenta de nuevo.";
    default:
      return "No se pudo iniciar sesión. Intenta de nuevo.";
  }
};

export default function AdminLogin() {
  const { user, isAdmin, loading, signIn, signOut } = useAdminAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }
  if (user && isAdmin) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(loginErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size={420} py={80}>
      <Title order={2} ta="center" mb="lg">
        Gen. Papers · Administración
      </Title>
      {user ? (
        <Stack>
          <Alert color="red">
            La cuenta {user.email} no tiene permisos de administrador.
          </Alert>
          <Button variant="default" onClick={() => void signOut()}>
            Cerrar sesión
          </Button>
        </Stack>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Correo"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <PasswordInput
              label="Contraseña"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            {error && <Alert color="red">{error}</Alert>}
            <Button type="submit" loading={submitting}>
              Ingresar
            </Button>
          </Stack>
        </form>
      )}
    </Container>
  );
}
