'use client';

import { Table } from '@mantine/core';
import type { AdminBillingReportRow } from '../api/partnerBillingApi';

interface Props {
  rows: AdminBillingReportRow[];
}

export function AdminPartnerBillingTable({ rows }: Props) {
  return (
    <Table striped highlightOnHover withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>softId</Table.Th>
          <Table.Th>User ID</Table.Th>
          <Table.Th>Email</Table.Th>
          <Table.Th>Дата</Table.Th>
          <Table.Th>Запросов</Table.Th>
          <Table.Th>Сумма</Table.Th>
        </Table.Tr>
      </Table.Thead>

      <Table.Tbody>
        {rows.map((r) => (
          <Table.Tr key={`${r.softId}-${r.userId}-${r.date}`}>
            <Table.Td>{r.softId}</Table.Td>
            <Table.Td>{r.userId}</Table.Td>
            <Table.Td>{r.email}</Table.Td>
            <Table.Td>{r.date}</Table.Td>
            <Table.Td>{r.totalRequests}</Table.Td>
            <Table.Td>{(Number(r.totalAmount) / 1000).toFixed(2)} ₽</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
