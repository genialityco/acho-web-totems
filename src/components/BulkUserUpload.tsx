/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Button,
  Table,
  Modal,
  LoadingOverlay,
  TextInput,
  Pagination,
  Text,
  Group,
  Badge,
} from "@mantine/core";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { createUser, fetchUserById } from "../services/api/userService";
import { createMember, searchMembers, fetchMembers } from "../services/api/memberService";
import {
  createAttendee,
  searchAttendees,
  updateAttendee, // necesario para upsert
} from "../services/api/attendeeService";

// ========================
// Tipos
// ========================
interface MemberRow {
  _id: string;
  userId?: string;
  organizationId?: string | { $oid: string };
  memberActive?: boolean;
  activeMember?: boolean;
  properties: {
    email?: string;
    fullName?: string;
    idNumber?: string;
    [k: string]: unknown;
  };
  [k: string]: any;
}

interface UserRow {
  _id: string;
  firebaseUid: string;
  expoPushToken?: string | null;
}

interface UserData {
  email: string;
  idNumber: string;
  password?: string;
  fullName?: string;
  phone?: string;
  specialty?: string;
  certificationHours?: string | number; // puede venir numérico desde Excel
  typeAttendee?: string;
  [key: string]: unknown;
}

type ReportRow = {
  email: string;
  action: "created_attendee" | "skipped_duplicate" | "error" | "updated_attendee";
  status: "OK" | "SKIPPED" | "ERROR";
  message: string;
  userId?: string;
  memberId?: string;
  eventId?: string;
};

// ========================
// Utils
// ========================
const getItems = <T,>(res: any): T[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res as T[];
  if (res.items) return res.items as T[];
  if (res.data?.items) return res.data.items as T[];
  if (Array.isArray(res.data)) return res.data as T[];
  return [];
};

const unwrapUser = (res: any): UserRow | null => {
  if (!res) return null;
  if (res.firebaseUid || res._id) return res as UserRow;
  if (res.data?.firebaseUid || res.data?._id) return res.data as UserRow;
  if (res.item?.firebaseUid || res.item?._id) return res.item as UserRow;
  if (res.data?.item?.firebaseUid || res.data?.item?._id) return res.data.item as UserRow;
  return null;
};

const isEmailAlreadyInUse = (err: any) =>
  err?.code === "auth/email-already-in-use" ||
  String(err?.message || "").includes("email-already-in-use");

// Members
const findMemberByEmail = async (email: string) => {
  const res = await searchMembers({
    current: 1,
    pageSize: 1,
    "properties.email": String(email || "").trim().toLowerCase(),
  });
  const items = getItems<MemberRow>(res);
  return items[0] ?? null;
};

// ===== Upsert helper por (memberId + eventId) usando ResponseDto (page/limit) =====

// Normaliza a string
const toId = (v: any) => String(v ?? "").trim();

// Extrae el primero desde ResponseDto<{ items, ... }>
const pickFirstFromDto = (dto: any) => {
  if (!dto || dto.status !== "success") return null;
  const items = dto.data?.items;
  return Array.isArray(items) ? items[0] ?? null : null;
};

// Upsert robusto por (memberId + eventId)
const upsertAttendeeByMemberEvent = async (payload: {
  userId?: string;
  memberId: string;
  eventId: string;
  attended?: boolean;
  certificationHours?: string; // string según schema
  typeAttendee?: string;
}) => {
  const memberId = toId(payload.memberId);
  const eventId = toId(payload.eventId);

  // 1) Buscar existente (usa page/limit como en tu backend)
  const searchDto = await searchAttendees({ memberId, eventId, page: 1, limit: 1 } as any);
  const found = pickFirstFromDto(searchDto);

  const buildUpdate = () => {
    const update: Record<string, any> = {};
    if (payload.userId !== undefined) update.userId = payload.userId;
    if (payload.attended !== undefined) update.attended = payload.attended;
    if (payload.certificationHours !== undefined) update.certificationHours = payload.certificationHours;
    if (payload.typeAttendee !== undefined) update.typeAttendee = payload.typeAttendee;
    return update;
  };

  if (found?._id) {
    await updateAttendee(found._id, buildUpdate());
    return { created: false as const, updated: true as const, id: found._id };
  }

  // 2) No existe → crear; si hay duplicado (índice único), re-buscar y actualizar
  try {
    await createAttendee({ ...payload, memberId, eventId });
    return { created: true as const, updated: false as const };
  } catch (e: any) {
    const msg = String(e?.response?.data?.message ?? e?.message ?? "");
    const status = e?.response?.status;
    const isDup =
      status === 409 ||
      msg.includes("duplicate key") ||
      msg.includes("E11000") ||
      msg.toLowerCase().includes("already exists");

    if (!isDup) throw e;

    // Rebuscar y actualizar
    const retryDto = await searchAttendees({ memberId, eventId, page: 1, limit: 1 } as any);
    const retry = pickFirstFromDto(retryDto);
    if (!retry?._id) throw e;

    await updateAttendee(retry._id, buildUpdate());
    return { created: false as const, updated: true as const, id: retry._id };
  }
};

// Resolver SIN validar en Firebase: solo DB propia
const resolveUserMemberByEmailNoFirebase = async (email: string) => {
  const member = await findMemberByEmail(email);
  if (!member?.userId) return { ok: false as const };

  // (Opcional) Verificar existencia real de user en DB
  const userByIdRes = await fetchUserById(member.userId).catch(() => null);
  const userById = unwrapUser(userByIdRes);
  if (!userById?._id) return { ok: false as const };

  return { ok: true as const, mongoUserId: member.userId, memberId: member._id };
};

// ========================
// Componente
// ========================
const BulkUserUpload = () => {
  const [loading, setLoading] = useState(false);
  const [fileData, setFileData] = useState<UserData[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activePage, setActivePage] = useState(1);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [report, setReport] = useState<ReportRow[]>([]);

  // Variables fijas de ejemplo (muévelas a props/contexto si varían)
  const organizationId = "66f1d236ee78a23c67fada2a"; // Ajusta a tu caso real
  const eventId = "68f2615e30c655652359c6ad"; // Ajusta a tu caso real

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const response = await fetchMembers(); // ResponseDto<{items,...}>
      const items = getItems<MemberRow>(response);
      setMembers(items);
    } catch (error) {
      console.error("Error al cargar los miembros:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsedData = XLSX.utils.sheet_to_json(sheet) as UserData[];

        const cleanedData = parsedData.map((row) => {
          if (row.idNumber !== undefined && row.idNumber !== null) {
            row.idNumber = String(row.idNumber).trim();
          }
          if (row.phone !== undefined && row.phone !== null) {
            row.phone = String(row.phone).trim();
          }
          for (const key in row) {
            if (typeof row[key] === "string") {
              row[key] = (row[key] as string).trim();
            }
          }
          return row;
        });

        setFileData(cleanedData);
        setTotalToProcess(cleanedData.length);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleBulkCreate = async () => {
    setLoading(true);
    setProcessedCount(0);
    setErrorCount(0);
    const runReport: ReportRow[] = [];

    for (const row of fileData) {
      const {
        email,
        idNumber,
        password,
        fullName,
        phone,
        specialty,
        certificationHours,
        typeAttendee,
      } = row;

      // schema usa String → convierte si viene numérico
      const certificationHoursStr =
        certificationHours !== undefined &&
        certificationHours !== null &&
        String(certificationHours).trim() !== ""
          ? String(certificationHours).trim()
          : undefined;

      try {
        const finalPassword = password || idNumber;

        // 0) ¿ya hay member por email? (fast-path SIN validar Firebase)
        const existingMember = await findMemberByEmail(email);

        if (existingMember?.userId) {
          const upsert = await upsertAttendeeByMemberEvent({
            userId: existingMember.userId!,
            eventId,
            memberId: existingMember._id,
            attended: true,
            certificationHours: certificationHoursStr,
            typeAttendee,
          });

          if (upsert.created) {
            runReport.push({
              email,
              action: "created_attendee",
              status: "OK",
              message: "Attendee creado (sin validar Firebase) [memberId+eventId]",
              userId: existingMember.userId,
              memberId: existingMember._id,
              eventId,
            });
          } else if (upsert.updated) {
            runReport.push({
              email,
              action: "updated_attendee",
              status: "OK",
              message: "Attendee actualizado (sin validar Firebase) [memberId+eventId]",
              userId: existingMember.userId,
              memberId: existingMember._id,
              eventId,
            });
          } else {
            runReport.push({
              email,
              action: "skipped_duplicate",
              status: "SKIPPED",
              message: "Sin cambios",
              userId: existingMember.userId,
              memberId: existingMember._id,
              eventId,
            });
          }

          setProcessedCount((p) => p + 1);
          continue;
        }

        // 1) No hay member: (opcional) crear usuario en Firebase y en tu backend
        await sleep(1000);
        let mongoUserId: string | undefined;
        let memberId: string | undefined;

        try {
          // Mantener creación en Firebase para nuevos usuarios (si quieres)
          const fbCreate = await createUserWithEmailAndPassword(
            auth,
            String(email).trim().toLowerCase(),
            finalPassword
          );

          // Crear usuario en Mongo (ResponseDto<User>)
          const userCreated = await createUser({ firebaseUid: fbCreate.user.uid });
          const createdUser = unwrapUser(userCreated);
          const createdUserId = createdUser?._id ?? userCreated?.data?._id;
          mongoUserId = createdUserId;

          // Crear member (ResponseDto<Member>)
          const memberCreated = await createMember({
            userId: createdUserId,
            organizationId,
            properties: {
              email: String(email).trim().toLowerCase(),
              idNumber,
              password: finalPassword,
              fullName: fullName?.trim() || "",
              phone: phone?.trim() || "",
              specialty: specialty?.trim() || "",
            },
          });
          const memberDto = (memberCreated?.data ?? memberCreated) as any;
          memberId = memberDto?._id ?? memberCreated?._id ?? memberCreated?.data?._id;
        } catch (err) {
          // 2) Email ya existe en Firebase → resolver SOLO por DB propia (sin validar Firebase)
          if (isEmailAlreadyInUse(err)) {
            const probe = await resolveUserMemberByEmailNoFirebase(email);
            if (probe.ok) {
              const upsert = await upsertAttendeeByMemberEvent({
                userId: probe.mongoUserId!,
                eventId,
                memberId: probe.memberId!,
                attended: true,
                certificationHours: certificationHoursStr,
                typeAttendee,
              });

              if (upsert.created) {
                runReport.push({
                  email,
                  action: "created_attendee",
                  status: "OK",
                  message:
                    "Attendee creado (email ya existía en Firebase; resuelto por DB) [memberId+eventId]",
                  userId: probe.mongoUserId,
                  memberId: probe.memberId,
                  eventId,
                });
              } else if (upsert.updated) {
                runReport.push({
                  email,
                  action: "updated_attendee",
                  status: "OK",
                  message:
                    "Attendee actualizado (email ya existía; resuelto por DB) [memberId+eventId]",
                  userId: probe.mongoUserId,
                  memberId: probe.memberId,
                  eventId,
                });
              }

              setProcessedCount((p) => p + 1);
              continue;
            } else {
              runReport.push({
                email,
                action: "error",
                status: "ERROR",
                message:
                  "Firebase tiene el email, pero no se encontró member con userId en la DB para resolver",
                eventId,
              });
              setErrorCount((p) => p + 1);
              continue;
            }
          }
          // Otro error: propaga
          throw err;
        }

        // 3) Si se creó user+member arriba, upsert attendee por memberId+eventId
        if (mongoUserId && memberId) {
          const upsert = await upsertAttendeeByMemberEvent({
            userId: mongoUserId,
            eventId,
            memberId,
            attended: true,
            certificationHours: certificationHoursStr,
            typeAttendee,
          });

          if (upsert.created) {
            runReport.push({
              email,
              action: "created_attendee",
              status: "OK",
              message: "Attendee creado [memberId+eventId]",
              userId: mongoUserId,
              memberId,
              eventId,
            });
          } else if (upsert.updated) {
            runReport.push({
              email,
              action: "updated_attendee",
              status: "OK",
              message: "Attendee actualizado [memberId+eventId]",
              userId: mongoUserId,
              memberId,
              eventId,
            });
          }

          setProcessedCount((p) => p + 1);
        } else {
          runReport.push({
            email,
            action: "error",
            status: "ERROR",
            message: "No se pudo crear user y/o member",
            eventId,
          });
          setErrorCount((p) => p + 1);
        }
      } catch (error: any) {
        console.error("Error al crear o actualizar el usuario:", error);
        runReport.push({
          email: row.email,
          action: "error",
          status: "ERROR",
          message: error?.message || "Error desconocido",
          eventId,
        });
        setErrorCount((prev) => prev + 1);
      }
    }

    setReport(runReport);
    setLoading(false);
  };

  const [membersState, setMembersState] = useState<MemberRow[]>([]);
  useEffect(() => setMembersState(members), [members]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.currentTarget.value);
    setActivePage(1);
  };

  const filteredMembers = membersState.filter((member) =>
    ((member?.properties?.email as string) || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pageSize = 10;
  const startIndex = (activePage - 1) * pageSize;
  const paginatedMembers = filteredMembers.slice(startIndex, startIndex + pageSize);
  const totalPages = Math.ceil(filteredMembers.length / pageSize);

  const templateHeaders = [
    "email",
    "idNumber",
    "password",
    "fullName",
    "phone",
    "specialty",
    "certificationHours",
    "typeAttendee",
  ];

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([templateHeaders]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
    XLSX.writeFile(wb, "usuarios_template.xlsx");
  };

  const handleDownloadReport = () => {
    if (report.length === 0) return;
    const headers = ["email", "status", "action", "message", "userId", "memberId", "eventId"];
    const data = report.map((r) => [
      r.email,
      r.status,
      r.action,
      r.message,
      r.userId || "",
      r.memberId || "",
      r.eventId || "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, "bulk_attendees_report.xlsx");
  };

  return (
    <div>
      <LoadingOverlay visible={loading} />

      <Group justify="space-between" mb="sm">
        <Button onClick={handleDownloadTemplate} color="teal">
          Descargar template Excel
        </Button>
        <Button variant="outline" onClick={handleDownloadReport} disabled={report.length === 0}>
          Descargar informe
        </Button>
      </Group>

      <Button component="label" mb="md">
        Cargar archivo de Excel
        <input type="file" accept=".xlsx, .xls" hidden onChange={handleFileUpload} />
      </Button>

      {fileData.length > 0 && (
        <Modal opened onClose={() => setFileData([])} title="Usuarios para registrar" size="xl">
          <Table stickyHeader striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                {Object.keys(fileData[0]).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {fileData.map((row, idx) => (
                <Table.Tr key={idx}>
                  {Object.values(row).map((value, index) => (
                    <Table.Td key={index}>{String(value)}</Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Button onClick={handleBulkCreate} fullWidth mt="md">
            Crear o Actualizar Usuarios
          </Button>
        </Modal>
      )}

      <TextInput
        placeholder="Buscar miembros por correo electrónico"
        value={searchTerm}
        onChange={handleSearchChange}
        mb="md"
      />

      <Text>Evento:{eventId}</Text>

      <Group gap="lg" mb="sm">
        <Text>Usuarios a procesar: <b>{totalToProcess}</b></Text>
        <Text>Procesados: <b>{processedCount}</b></Text>
        <Text>Errores: <Badge color="red">{errorCount}</Badge></Text>
        <Text>Reporte: <Badge color={report.length ? "blue" : "gray"}>{report.length} filas</Badge></Text>
      </Group>

      <Table highlightOnHover withRowBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nombres</Table.Th>
            <Table.Th>Correo Electrónico</Table.Th>
            <Table.Th>Número de Identificación</Table.Th>
            <Table.Th>Activo para votar</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paginatedMembers.map((member, idx) => (
            <Table.Tr key={idx}>
              <Table.Td>{(member.properties?.fullName as string) ?? ""}</Table.Td>
              <Table.Td>{(member.properties?.email as string) ?? ""}</Table.Td>
              <Table.Td>{(member.properties?.idNumber as string) ?? ""}</Table.Td>
              <Table.Td>{(member.memberActive ?? member.activeMember) === true ? "Activo" : "Inactivo"}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Pagination value={activePage} onChange={setActivePage} total={totalPages} mt="md" />

      {report.length > 0 && (
        <>
          <Text mt="xl" mb="xs" fw={600}>
            Resultado de la última ejecución
          </Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Email</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Acción</Table.Th>
                <Table.Th>Mensaje</Table.Th>
                <Table.Th>UserId</Table.Th>
                <Table.Th>MemberId</Table.Th>
                <Table.Th>EventId</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {report.map((r, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{r.email}</Table.Td>
                  <Table.Td>
                    <Badge color={r.status === "OK" ? "green" : r.status === "SKIPPED" ? "yellow" : "red"}>
                      {r.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{r.action}</Table.Td>
                  <Table.Td>{r.message}</Table.Td>
                  <Table.Td>{r.userId || ""}</Table.Td>
                  <Table.Td>{r.memberId || ""}</Table.Td>
                  <Table.Td>{r.eventId || ""}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </div>
  );
};

export default BulkUserUpload;
