import {
  TestBenchEngineConfig,
  UpdateConfigDto,
} from '@/features/test-bench/api';
import {
  Button,
  NumberInput,
  Switch,
  TextInput,
  Group,
  Stack,
} from '@mantine/core';
import { useState, useEffect } from 'react';

interface Props {
  config: TestBenchEngineConfig;
  onSave: (dto: UpdateConfigDto) => Promise<void>;
}

export function CaptchaConfigForm({ config, onSave }: Props) {
  const [form, setForm] = useState<UpdateConfigDto>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm({
      captchaAlertsEnabled: config.captchaAlertsEnabled,
      captchaAvgNonZeroLimitDesktop: config.captchaAvgNonZeroLimitDesktop,
      captchaAvgNonZeroLimitMobile: config.captchaAvgNonZeroLimitMobile,
      captchaZeroPercentLimitDesktop: config.captchaZeroPercentLimitDesktop,
      captchaZeroPercentLimitMobile: config.captchaZeroPercentLimitMobile,
      captchaScheduleTimes: config.captchaScheduleTimes,

      // 🔥 новые поля
      captchaAvgNonZeroMinDesktop: config.captchaAvgNonZeroMinDesktop,
      captchaAvgNonZeroMinMobile: config.captchaAvgNonZeroMinMobile,
      captchaMinAvgAlertEnabled: config.captchaMinAvgAlertEnabled,
    });
    setDirty(false);
  }, [config]);

  function update<K extends keyof UpdateConfigDto>(
    key: K,
    value: UpdateConfigDto[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  return (
    <Stack>
      <Switch
        label="Включить алерты по капчам (превышение лимитов)"
        checked={form.captchaAlertsEnabled ?? false}
        onChange={(e) =>
          update('captchaAlertsEnabled', e.currentTarget.checked)
        }
      />

      <Group grow>
        <NumberInput
          label="AVG без нулей (Desktop) — верхний лимит"
          value={form.captchaAvgNonZeroLimitDesktop ?? 0}
          onChange={(v) => update('captchaAvgNonZeroLimitDesktop', Number(v))}
          decimalScale={2}
        />
        <NumberInput
          label="AVG без нулей (Mobile) — верхний лимит"
          value={form.captchaAvgNonZeroLimitMobile ?? 0}
          onChange={(v) => update('captchaAvgNonZeroLimitMobile', Number(v))}
          decimalScale={2}
        />
      </Group>

      <Group grow>
        <NumberInput
          label="% нулей (Desktop) — верхний лимит"
          value={form.captchaZeroPercentLimitDesktop ?? 0}
          onChange={(v) => update('captchaZeroPercentLimitDesktop', Number(v))}
          decimalScale={2}
        />
        <NumberInput
          label="% нулей (Mobile) — верхний лимит"
          value={form.captchaZeroPercentLimitMobile ?? 0}
          onChange={(v) => update('captchaZeroPercentLimitMobile', Number(v))}
          decimalScale={2}
        />
      </Group>

      {/* 🔥 НОВЫЙ блок — алерт на слишком маленькое среднее до капчи */}
      <Switch
        label="Включить алерт при слишком маленьком среднем до капчи"
        checked={form.captchaMinAvgAlertEnabled ?? false}
        onChange={(e) =>
          update('captchaMinAvgAlertEnabled', e.currentTarget.checked)
        }
      />

      <Group grow>
        <NumberInput
          label="Минимальный AVG без нулей (Desktop)"
          value={form.captchaAvgNonZeroMinDesktop ?? 0}
          onChange={(v) => update('captchaAvgNonZeroMinDesktop', Number(v))}
          decimalScale={2}
        />
        <NumberInput
          label="Минимальный AVG без нулей (Mobile)"
          value={form.captchaAvgNonZeroMinMobile ?? 0}
          onChange={(v) => update('captchaAvgNonZeroMinMobile', Number(v))}
          decimalScale={2}
        />
      </Group>

      <TextInput
        label="Расписание (через запятую, формат HH:MM)"
        value={form.captchaScheduleTimes?.join(', ') ?? ''}
        onChange={(e) =>
          update(
            'captchaScheduleTimes',
            e.currentTarget.value
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
          )
        }
      />

      <Button disabled={!dirty} onClick={() => onSave(form)}>
        Сохранить
      </Button>
    </Stack>
  );
}
