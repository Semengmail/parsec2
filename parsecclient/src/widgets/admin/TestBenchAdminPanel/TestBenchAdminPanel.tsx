'use client';

import { useEffect, useState } from 'react';
import { useTestBenchStore } from '@/features/test-bench/store';

import {
  Card,
  Group,
  Button,
  Switch,
  Text,
  NumberInput,
  TextInput,
  Select,
  Modal,
  Table,
  Divider,
  Badge,
  Stack,
  Title,
  ScrollArea,
} from '@mantine/core';

import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react';

import type {
  TestBenchPhraseType,
  CreatePhraseDto,
  UpdatePhraseDto,
  TestBenchEngineConfig,
} from '@/features/test-bench/api';

type Engine = 'yandex' | 'google';
type TestBenchPhraseEngine = 'yandex' | 'google' | null;

/* -----------------------------------------
 *  Формы
 * ----------------------------------------- */
interface PhraseFormState {
  phrase: string;
  active: boolean;
  type: TestBenchPhraseType;
  searchEngine: TestBenchPhraseEngine;
}

const initialForm: PhraseFormState = {
  phrase: '',
  active: true,
  type: 'speed',
  searchEngine: null,
};

/* -----------------------------------------
 *  Главный компонент
 * ----------------------------------------- */
export default function TestBenchAdminPanel() {
  const {
    configs,
    phrases,
    loadConfigs,
    loadPhrases,
    saveConfig,
    setBlock,
    addPhrase,
    editPhrase,
    removePhrase,
  } = useTestBenchStore();

  /* ------------------ Состояния для фраз ------------------ */
  const [phraseModal, setPhraseModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PhraseFormState>(initialForm);
  const [phraseFilters, setPhraseFilters] = useState<{
    speed: TestBenchPhraseEngine;
    position: TestBenchPhraseEngine;
    selector: TestBenchPhraseEngine;
  }>({
    speed: null,
    position: null,
    selector: null,
  });

  /* ------------------ Состояния конфигов ------------------ */
  const [editedConfig, setEditedConfig] = useState<
    Partial<Record<Engine, Partial<TestBenchEngineConfig>>>
  >({
    yandex: {},
    google: {},
  });

  const [dirtyConfig, setDirtyConfig] = useState<Record<Engine, boolean>>({
    yandex: false,
    google: false,
  });

  useEffect(() => {
    void loadConfigs();
    void loadPhrases();
  }, [loadConfigs, loadPhrases]);

  if (!configs) return <Text>Загрузка…</Text>;

  const engines: Engine[] = ['yandex', 'google'];

  /* -----------------------------------------
   *  Utils
   * ----------------------------------------- */
  const updateForm = <K extends keyof PhraseFormState>(
    key: K,
    value: PhraseFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateConfig = <K extends keyof TestBenchEngineConfig>(
    engine: Engine,
    key: K,
    value: TestBenchEngineConfig[K],
  ) => {
    setEditedConfig((prev) => ({
      ...prev,
      [engine]: { ...prev[engine], [key]: value },
    }));
    setDirtyConfig((prev) => ({ ...prev, [engine]: true }));
  };

  const saveConfigChanges = async (engine: Engine) => {
    const dto = editedConfig[engine];
    if (!dto || Object.keys(dto).length === 0) return;

    await saveConfig(engine, dto);
    setEditedConfig((prev) => ({ ...prev, [engine]: {} }));
    setDirtyConfig((prev) => ({ ...prev, [engine]: false }));
  };

  /* -----------------------------------------
   *  Фильтрация фраз
   * ----------------------------------------- */
  const filterPhrases = (
    type: TestBenchPhraseType,
    engineFilter: TestBenchPhraseEngine,
  ) => {
    return phrases.filter((p) => {
      if (p.type !== type) return false;
      if (engineFilter && p.searchEngine !== engineFilter) return false;
      return true;
    });
  };

  /* -----------------------------------------
   *  Render блока фраз
   * ----------------------------------------- */
  const renderPhraseBlock = (
    type: TestBenchPhraseType,
    title: string,
    filterKey: keyof typeof phraseFilters,
  ) => {
    const engineFilter = phraseFilters[filterKey];
    const list = filterPhrases(type, engineFilter);

    return (
      <Card shadow="sm" p="lg" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={4}>{title}</Title>

          <Group>
            <Select
              value={engineFilter ?? 'all'}
              data={[
                { value: 'all', label: 'Все' },
                { value: 'yandex', label: 'Yandex' },
                { value: 'google', label: 'Google' },
              ]}
              w={160}
              onChange={(v) =>
                setPhraseFilters((prev) => ({
                  ...prev,
                  [filterKey]:
                    v === 'all' ? null : (v as TestBenchPhraseEngine),
                }))
              }
            />

            <Button
              onClick={() => void loadPhrases({ type })}
              variant="default"
            >
              Обновить
            </Button>

            <Button
              leftSection={<IconPlus size={14} />}
              onClick={() => {
                setEditId(null);
                setForm({ ...initialForm, type });
                setPhraseModal(true);
              }}
            >
              Добавить
            </Button>
          </Group>
        </Group>

        <ScrollArea h={260}>
          <Table striped highlightOnHover>
            <thead>
              <tr>
                <th>ID</th>
                <th>Фраза</th>
                <th>ПС</th>
                <th>Активна</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.phrase}</td>
                  <td>{p.searchEngine ?? 'all'}</td>
                  <td>{p.active ? 'Да' : 'Нет'}</td>
                  <td>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconEdit size={14} />}
                        onClick={() => {
                          setEditId(p.id);
                          setForm({
                            phrase: p.phrase,
                            active: p.active,
                            type: p.type,
                            searchEngine: p.searchEngine,
                          });
                          setPhraseModal(true);
                        }}
                      >
                        Изм.
                      </Button>

                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => void removePhrase(p.id)}
                      >
                        Удалить
                      </Button>
                    </Group>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </ScrollArea>
      </Card>
    );
  };

  /* -----------------------------------------
   *  Save phrase
   * ----------------------------------------- */
  const savePhrase = () => {
    const dto: CreatePhraseDto | UpdatePhraseDto = {
      phrase: form.phrase,
      active: form.active,
      type: form.type,
      searchEngine: form.searchEngine,
    };

    if (editId) void editPhrase(editId, dto as UpdatePhraseDto);
    else void addPhrase(dto as CreatePhraseDto);

    setPhraseModal(false);
  };

  /* -----------------------------------------
   *  Render
   * ----------------------------------------- */
  return (
    <Stack gap="xl" p="lg">
      <Title order={2}>⚙️ TestBench — Панель управления</Title>

      {/* --------------------- КОНФИГИ --------------------- */}
      {engines.map((engine) => {
        const cfg = configs[engine];
        const edited = editedConfig[engine] ?? {};
        const dirty = dirtyConfig[engine];

        const getValue = <K extends keyof TestBenchEngineConfig>(
          key: K,
        ): TestBenchEngineConfig[K] =>
          (edited[key] as TestBenchEngineConfig[K]) ?? cfg[key];

        return (
          <Card key={engine} shadow="sm" p="lg" withBorder>
            <Group justify="space-between">
              <Title order={3}>{engine.toUpperCase()}</Title>

              <Group>
                <Text>
                  Статус:{' '}
                  {cfg.blocked ? (
                    <Badge color="red">Заблокирован</Badge>
                  ) : (
                    <Badge color="green">Работает</Badge>
                  )}
                </Text>

                <Button
                  color={cfg.blocked ? 'green' : 'red'}
                  onClick={() => void setBlock(engine, !cfg.blocked)}
                >
                  {cfg.blocked ? 'Разблокировать' : 'Заблокировать'}
                </Button>
              </Group>
            </Group>

            <Divider my="sm" />

            <Stack gap="sm">
              <Group grow>
                <Switch
                  label="Автоблокировка"
                  checked={getValue('autoblockEnabled')}
                  onChange={(e) =>
                    updateConfig(
                      engine,
                      'autoblockEnabled',
                      e.currentTarget.checked,
                    )
                  }
                />
                <Switch
                  label="Селекторы"
                  checked={getValue('autoblockSelectors')}
                  onChange={(e) =>
                    updateConfig(
                      engine,
                      'autoblockSelectors',
                      e.currentTarget.checked,
                    )
                  }
                />
                <Switch
                  label="Прыжки"
                  checked={getValue('autoblockPositionsJump')}
                  onChange={(e) =>
                    updateConfig(
                      engine,
                      'autoblockPositionsJump',
                      e.currentTarget.checked,
                    )
                  }
                />
                <Switch
                  label="Пропуски"
                  checked={getValue('autoblockPositionsMissing')}
                  onChange={(e) =>
                    updateConfig(
                      engine,
                      'autoblockPositionsMissing',
                      e.currentTarget.checked,
                    )
                  }
                />
                <Switch
                  label="Telegram"
                  checked={getValue('telegramAlertsEnabled')}
                  onChange={(e) =>
                    updateConfig(
                      engine,
                      'telegramAlertsEnabled',
                      e.currentTarget.checked,
                    )
                  }
                />
              </Group>

              <Group grow>
                <NumberInput
                  label="Порог прыжка"
                  value={getValue('positionJumpDiffWarning')}
                  onChange={(v) =>
                    typeof v === 'number' &&
                    updateConfig(engine, 'positionJumpDiffWarning', v)
                  }
                />
                <NumberInput
                  label="Пропусков допустимо"
                  value={getValue('maxMissingPositionsPerRun')}
                  onChange={(v) =>
                    typeof v === 'number' &&
                    updateConfig(engine, 'maxMissingPositionsPerRun', v)
                  }
                />
                <NumberInput
                  label="Лимит Speed"
                  value={getValue('speedTestLimit')}
                  onChange={(v) =>
                    typeof v === 'number' &&
                    updateConfig(engine, 'speedTestLimit', v)
                  }
                />
                <NumberInput
                  label="Лимит Position"
                  value={getValue('positionTestLimit')}
                  onChange={(v) =>
                    typeof v === 'number' &&
                    updateConfig(engine, 'positionTestLimit', v)
                  }
                />
              </Group>

              <TextInput
                label="Тестовый сайт"
                value={getValue('positionTestSite')}
                onChange={(e) =>
                  updateConfig(
                    engine,
                    'positionTestSite',
                    e.currentTarget.value,
                  )
                }
              />

              <Button
                disabled={!dirty}
                onClick={() => void saveConfigChanges(engine)}
              >
                Сохранить изменения
              </Button>
            </Stack>
          </Card>
        );
      })}

      {/* --------------------- Блоки фраз --------------------- */}
      {renderPhraseBlock('speed', 'Фразы для Speed-теста', 'speed')}
      {renderPhraseBlock('position', 'Фразы для Position-теста', 'position')}
      {renderPhraseBlock('selector', 'Фразы для Selector-теста', 'selector')}

      {/* --------------------- MODAL --------------------- */}
      <Modal
        opened={phraseModal}
        onClose={() => setPhraseModal(false)}
        title={editId ? 'Редактировать фразу' : 'Добавить фразу'}
        centered
      >
        <Stack>
          <TextInput
            label="Фраза"
            value={form.phrase}
            onChange={(e) => updateForm('phrase', e.currentTarget.value)}
          />

          <Select
            label="Тип"
            data={[
              { value: 'speed', label: 'Speed' },
              { value: 'position', label: 'Position' },
              { value: 'selector', label: 'Selector' },
            ]}
            value={form.type}
            onChange={(v) => v && updateForm('type', v as TestBenchPhraseType)}
          />

          <Select
            label="Поисковик"
            data={[
              { value: 'all', label: 'Все' },
              { value: 'yandex', label: 'Yandex' },
              { value: 'google', label: 'Google' },
            ]}
            value={form.searchEngine ?? 'all'}
            onChange={(v) =>
              updateForm(
                'searchEngine',
                v === 'all' ? null : (v as TestBenchPhraseEngine),
              )
            }
          />

          <Switch
            label="Активна"
            checked={form.active}
            onChange={(e) => updateForm('active', e.currentTarget.checked)}
          />

          <Button onClick={savePhrase}>Сохранить</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
