'use client';

import { Table } from '@mantine/core';
import type { PartnerBillingReportRow } from '../api/partnerBillingApi';

interface Props {
  rows: PartnerBillingReportRow[];
}

export function PartnerBillingTable({ rows }: Props) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Дата</Table.Th>
          <Table.Th>Запросы</Table.Th>
          <Table.Th>Сумма</Table.Th>
          {/* <Table.Th>Сервис</Table.Th> */}
        </Table.Tr>
      </Table.Thead>

      <Table.Tbody>
        {rows.map((row) => (
          <Table.Tr key={`${row.date}-${row.service ?? ''}`}>
            <Table.Td>{row.date}</Table.Td>
            <Table.Td>{row.requests}</Table.Td>
            <Table.Td>{(Number(row.amount) / 1000).toFixed(2)} ₽</Table.Td>
            {/* <Table.Td>{row.service ?? '-'}</Table.Td> */}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
