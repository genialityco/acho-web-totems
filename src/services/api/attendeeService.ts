/* eslint-disable @typescript-eslint/no-explicit-any */
// services/api/attendeeService.ts
import api from "./api";

export interface Attendee {
  userId?: string | null;
  eventId: string;
  memberId: string;
  attended?: boolean;
  certificationHours?: string | null; // String en el schema
  typeAttendee?: string | null;
  certificateDownloads?: number;
  createdAt?: string;
  updatedAt?: string;
  _id?: string;
}

// ----------------------------
// CRUD básico
// ----------------------------
export const fetchAttendees = async () => {
  const res = await api.get("/attendees");
  // ResponseDto<{ items, totalItems, totalPages, currentPage }>
  return res.data as {
    status: string;
    message: string;
    data?: {
      items: Attendee[];
      totalItems: number;
      totalPages: number;
      currentPage: number;
    };
    error?: any;
  };
};

export const fetchAttendeeById = async (id: string) => {
  const res = await api.get(`/attendees/${id}`);
  // ResponseDto<Attendee>
  return res.data as {
    status: string;
    message: string;
    data?: Attendee;
    error?: any;
  };
};

export const createAttendee = async (attendeeData: Partial<Attendee>) => {
  const res = await api.post("/attendees", attendeeData);
  // ResponseDto<Attendee>
  return res.data as {
    status: string;
    message: string;
    data?: Attendee;
    error?: any;
  };
};

export const updateAttendee = async (
  id: string,
  attendeeData: Partial<Attendee>
) => {
  const res = await api.put(`/attendees/${id}`, attendeeData);
  // ResponseDto<Attendee>
  return res.data as {
    status: string;
    message: string;
    data?: Attendee;
    error?: any;
  };
};

export const deleteAttendee = async (id: string) => {
  const res = await api.delete(`/attendees/${id}`);
  // ResponseDto<Attendee>
  return res.data as {
    status: string;
    message: string;
    data?: Attendee;
    error?: any;
  };
};

// ----------------------------
// Búsqueda con filtros (usa page/limit del backend)
// ----------------------------
export const searchAttendees = async (filters: Record<string, any>) => {
  // Asegúrate de mandar page y limit, porque tu backend usa esos nombres
  const params: Record<string, any> = {
    page: 1,
    limit: 1,
    ...filters,
  };
  const res = await api.get("/attendees/search", { params });
  // Puede venir status:"success" con data, o status:"error" sin data
  return res.data as {
    status: "success" | "error";
    message: string;
    data?: {
      items: Attendee[];
      totalItems: number;
      totalPages: number;
      currentPage: number;
    };
    error?: any;
  };
};

// ----------------------------
// Helpers para extraer items de tu ResponseDto
// ----------------------------
const pickFirstItem = (dto: any): Attendee | null => {
  if (!dto) return null;
  // Cuando hay éxito: { status, message, data: { items: [...] } }
  if (dto.data?.items && Array.isArray(dto.data.items)) {
    return dto.data.items[0] ?? null;
  }
  // Si el backend devolvió status:error sin data, no hay items
  return null;
};

// Normaliza a string sin espacios
const toId = (v: any) => String(v ?? "").trim();

// ----------------------------
// UPSERT por (memberId + eventId)  ← Recomendado con tu schema
// - Busca exacto por memberId+eventId usando page/limit
// - Si existe → PUT (update selectivo)
// - Si no → POST
// - Si POST choca con índice único (E11000/409) → re-busca y hace PUT
// ----------------------------
export const upsertAttendeeByMemberEvent = async (payload: {
  eventId: string;
  memberId: string;
  userId?: string; // opcional
  attended?: boolean;
  certificationHours?: string; // string
  typeAttendee?: string;
  certificateDownloads?: number;
}) => {
  const memberId = toId(payload.memberId);
  const eventId = toId(payload.eventId);

  // 1) Buscar existente (usa page/limit, NO current/pageSize)
  const searchDto = await searchAttendees({
    memberId,
    eventId,
    page: 1,
    limit: 1,
  });
  const found = pickFirstItem(searchDto);

  const buildUpdate = (): Partial<Attendee> => {
    const update: Partial<Attendee> = {};
    if (payload.userId !== undefined) update.userId = payload.userId;
    if (payload.attended !== undefined) update.attended = payload.attended;
    if (payload.certificationHours !== undefined)
      update.certificationHours = payload.certificationHours;
    if (payload.typeAttendee !== undefined)
      update.typeAttendee = payload.typeAttendee;
    if (payload.certificateDownloads !== undefined)
      update.certificateDownloads = payload.certificateDownloads;
    return update;
  };

  if (found?._id) {
    const dto = await updateAttendee(found._id, buildUpdate());
    return {
      created: false as const,
      updated: true as const,
      id: found._id,
      dto,
    };
  }

  // 2) No existe → intentar crear
  try {
    const dto = await createAttendee({ ...payload, memberId, eventId });
    return { created: true as const, updated: false as const, dto };
  } catch (e: any) {
    const msg = String(e?.response?.data?.message ?? e?.message ?? "");
    const status = e?.response?.status;

    const isDup =
      status === 409 ||
      msg.includes("duplicate key") ||
      msg.includes("E11000") ||
      msg.toLowerCase().includes("already exists");

    if (!isDup) throw e;

    // 3) Hubo duplicado (índice único) → re-buscar y actualizar
    const retryDto = await searchAttendees({
      memberId,
      eventId,
      page: 1,
      limit: 1,
    });
    const retry = pickFirstItem(retryDto);
    if (!retry?._id) throw e;

    const dto = await updateAttendee(retry._id, buildUpdate());
    return {
      created: false as const,
      updated: true as const,
      id: retry._id,
      dto,
    };
  }
};

// ----------------------------
// Variante: unicidad por (userId + memberId + eventId)
// ----------------------------
export const upsertAttendeeByTriplet = async (payload: {
  eventId: string;
  memberId: string;
  userId: string; // obligatorio aquí
  attended?: boolean;
  certificationHours?: string;
  typeAttendee?: string;
  certificateDownloads?: number;
}) => {
  const userId = toId(payload.userId);
  const memberId = toId(payload.memberId);
  const eventId = toId(payload.eventId);

  const searchDto = await searchAttendees({
    userId,
    memberId,
    eventId,
    page: 1,
    limit: 1,
  });
  const found = pickFirstItem(searchDto);

  const buildUpdate = (): Partial<Attendee> => {
    const update: Partial<Attendee> = {};
    if (payload.attended !== undefined) update.attended = payload.attended;
    if (payload.certificationHours !== undefined)
      update.certificationHours = payload.certificationHours;
    if (payload.typeAttendee !== undefined)
      update.typeAttendee = payload.typeAttendee;
    if (payload.certificateDownloads !== undefined)
      update.certificateDownloads = payload.certificateDownloads;
    return update;
  };

  if (found?._id) {
    const dto = await updateAttendee(found._id, buildUpdate());
    return {
      created: false as const,
      updated: true as const,
      id: found._id,
      dto,
    };
  }

  try {
    const dto = await createAttendee({ ...payload, userId, memberId, eventId });
    return { created: true as const, updated: false as const, dto };
  } catch (e: any) {
    const msg = String(e?.response?.data?.message ?? e?.message ?? "");
    const status = e?.response?.status;
    const isDup =
      status === 409 ||
      msg.includes("duplicate key") ||
      msg.includes("E11000") ||
      msg.toLowerCase().includes("already exists");
    if (!isDup) throw e;

    const retryDto = await searchAttendees({
      userId,
      memberId,
      eventId,
      page: 1,
      limit: 1,
    });
    const retry = pickFirstItem(retryDto);
    if (!retry?._id) throw e;

    const dto = await updateAttendee(retry._id, buildUpdate());
    return {
      created: false as const,
      updated: true as const,
      id: retry._id,
      dto,
    };
  }
};
