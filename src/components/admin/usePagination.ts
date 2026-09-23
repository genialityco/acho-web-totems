import { useState } from "react";

export const usePagination = <T>(items: T[], pageSize = 25) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return { page: currentPage, setPage, totalPages, pageItems };
};
