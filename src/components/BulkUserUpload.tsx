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
} from "@mantine/core";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { createUser } from "../services/api/userService";
import {
  createMember,
  searchMembers,
  updateMember,
  fetchMembers,
} from "../services/api/memberService";

const BulkUserUpload = () => {
  const [loading, setLoading] = useState(false);
  const [fileData, setFileData] = useState<UserData[]>([]);
  const [members, setMembers] = useState<UserData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activePage, setActivePage] = useState(1);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const pageSize = 10;

  interface UserData {
    email: string;
    idNumber: string;
    properties: Record<string, unknown>;
    [key: string]: unknown;
  }

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const response = await fetchMembers();
      setMembers(response.data.items);
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
        const parsedData = (XLSX.utils.sheet_to_json(sheet) as UserData[]).map(
          (row: UserData) => {
            Object.keys(row).forEach((key) => {
              if (typeof row[key] === "string") {
                row[key] = row[key].trim();
              }
            });
            return row;
          }
        );
        setFileData(parsedData as UserData[]);
        setTotalToProcess(parsedData.length);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const handleBulkCreate = async () => {
    setLoading(true);
    setProcessedCount(0);
    setErrorCount(0);
    const organizationId = "66f1d236ee78a23c67fada2a";

    for (const user of fileData) {
      const { email, idNumber, ...userData } = user;

      try {
        const filters = { "properties.email": email };
        const userExistinFirebase = await searchMembers(filters);
        const password = idNumber;

        if (userExistinFirebase?.data?.items?.length > 0) {
          const mongoUserId = userExistinFirebase?.data?.items[0]._id;
          const idNumberString = String(idNumber);
          const memberData = {
            ...userExistinFirebase.data.items[0],
            properties: {
              email,
              idNumber: idNumberString,
              password,
              ...userData,
            },
          };
          await updateMember(mongoUserId, memberData);
        } else {
          // Crear usuario en Firebase con un retraso para evitar el error de too-many-requests
          await sleep(1000);
          const firebaseUser = await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );
          const mongoUserResponse = await createUser({
            firebaseUid: firebaseUser.user.uid,
          });
          const mongoUserId = mongoUserResponse.data._id;
          const idNumberString = String(idNumber);
          await createMember({
            userId: mongoUserId,
            organizationId,
            properties: {
              email,
              idNumber: idNumberString,
              password,
              ...userData,
            },
          });
        }

        setProcessedCount((prev) => prev + 1);
      } catch (error) {
        console.error("Error al crear o actualizar el usuario:", error);
        setErrorCount((prev) => prev + 1);
      }
    }

    setLoading(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.currentTarget.value);
    setActivePage(1);
  };

  const filteredMembers = members.filter((member) =>
    ((member?.properties?.email as string) || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const startIndex = (activePage - 1) * pageSize;
  const paginatedMembers = filteredMembers.slice(
    startIndex,
    startIndex + pageSize
  );
  const totalPages = Math.ceil(filteredMembers.length / pageSize);

  return (
    <div>
      <LoadingOverlay visible={loading} />

      <Button component="label">
        Cargar archivo de Excel
        <input
          type="file"
          accept=".xlsx, .xls"
          hidden
          onChange={handleFileUpload}
        />
      </Button>

      {fileData.length > 0 && (
        <Modal
          opened
          onClose={() => setFileData([])}
          title="Usuarios para registrar"
        >
          <Table>
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
                    <Table.Td key={index}>{value as React.ReactNode}</Table.Td>
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

      <Text>Usuarios a procesar: {totalToProcess}</Text>
      <Text>Usuarios procesados: {processedCount}</Text>
      <Text>Errores: {errorCount}</Text>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Td>Nombres</Table.Td>
            <Table.Th>Correo Electrónico</Table.Th>
            <Table.Th>Número de Identificación</Table.Th>
            <Table.Th>Activo para votar</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paginatedMembers.map((member, idx) => (
            <Table.Tr key={idx}>
              <Table.Td>{member.properties.fullName as string}</Table.Td>
              <Table.Td>{member.properties.email as string}</Table.Td>
              <Table.Td>{member.properties.idNumber as string}</Table.Td>
              <Table.Td>
                {member.activeMember === true ? "Activo" : "Inactivo"}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Pagination
        value={activePage}
        onChange={setActivePage}
        total={totalPages}
        mt="md"
      />
    </div>
  );
};

export default BulkUserUpload;
