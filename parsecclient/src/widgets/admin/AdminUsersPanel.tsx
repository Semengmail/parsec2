'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, Pagination, Stack, Table, Text, TextInput } from '@mantine/core';
import { AdminUser, clearAdminUserBalance, fetchAdminUsers } from '@/entities/admin/api/admin-api';

const PAGE_SIZE = 300;

function formatRubles(balance: string): string {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(Number(balance) / 1000);
}

export function AdminUsersPanel() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminUsers({ page, search });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void load(); }, [load]);

  const applySearch = () => { setPage(1); setSearch(searchInput); };
  const confirmClear = async () => {
    if (!selected) return;
    setClearing(true);
    setError(null);
    try {
      await clearAdminUserBalance(selected.id);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обнулить баланс');
    } finally {
      setClearing(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <Stack>
      <Group align="end">
        <TextInput label="Поиск" placeholder="Email или ID" value={searchInput} onChange={(event) => setSearchInput(event.currentTarget.value)} onKeyDown={(event) => event.key === 'Enter' && applySearch()} w={320} />
        <Button onClick={applySearch}>Найти</Button>
      </Group>
      {error && <Alert color="red">{error}</Alert>}
      <Text c="dimmed">Найдено пользователей: {total}. На странице до 300 записей.</Text>
      <Table.ScrollContainer minWidth={760}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead><Table.Tr><Table.Th>ID</Table.Th><Table.Th>Имя</Table.Th><Table.Th>Email</Table.Th><Table.Th>Баланс, ₽</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {items.map((item) => <Table.Tr key={item.id}><Table.Td>{item.id}</Table.Td><Table.Td>{item.name || '—'}</Table.Td><Table.Td>{item.email}</Table.Td><Table.Td>{formatRubles(item.balance)}</Table.Td><Table.Td><Button color="red" size="xs" onClick={() => setSelected(item)}>Обнулить баланс</Button></Table.Td></Table.Tr>)}
            {!loading && items.length === 0 && <Table.Tr><Table.Td colSpan={5}>Пользователи не найдены</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {loading && <Text>Загрузка…</Text>}
      {pages > 1 && <Pagination value={page} onChange={setPage} total={pages} />}
      <Modal opened={Boolean(selected)} onClose={() => !clearing && setSelected(null)} title="Подтвердите обнуление баланса" centered>
        {selected && <Stack><Alert color="red">Это действие нельзя отменить. Перед обнулением убедитесь, что возврат средств уже согласован.</Alert><Text>Email: <b>{selected.email}</b></Text><Text>Сумма к обнулению: <b>{formatRubles(selected.balance)} ₽</b></Text><Group justify="flex-end"><Button variant="default" onClick={() => setSelected(null)} disabled={clearing}>Отмена</Button><Button color="red" onClick={() => void confirmClear()} loading={clearing}>Обнулить баланс</Button></Group></Stack>}
      </Modal>
    </Stack>
  );
}
