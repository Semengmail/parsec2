/**
 * Денежные утилиты для значений в тысячных долях рубля (1 юнит = 0.001 ₽).
 * Вход/выход всех функций — строки с целыми числами (например: "123450" → 123.450 ₽).
 * Без BigInt: только строковые операции — хорошо работает и в старых браузерах.
 */

export type FormatMoneyOptions = {
  /** Добавлять ли пробел перед символом валюты. По умолчанию `true` → `123.000 ₽`. */
  spaceBeforeCurrency?: boolean;
  /** Символ валюты. По умолчанию «₽». Можно задать пустую строку. */
  currency?: string;
  /** Группировать ли тысячи в целой части (разделитель — пробел). По умолчанию `false`. */
  groupThousands?: boolean;
  /**
   * Обрезать ли нули в дробной части справа.
   * - `false` (по умолчанию): всегда три знака после точки — `123.000 ₽`
   * - `true`: `123 ₽`, `123.4 ₽`, `123.45 ₽`
   */
  trimTrailingZeros?: boolean;
};

export type FormatRubHumanOptions = {
  useComma?: boolean; // по умолчанию запятая
  groupThousands?: boolean; // группировка тысяч в целой части
  spaceBeforeCurrency?: boolean; // пробел перед валютой
  currency?: string; // символ валюты, по умолчанию "₽"
};

/** Вспомогательное: разделить знак и цифры, убрать мусор/пробелы; " -0012 " → ["-", "12"] */
function splitSign(raw: string): { sign: '' | '-'; digits: string } {
  const s = String(raw).trim();
  const negative = s.startsWith('-');
  const onlyDigits = s.replace(/^[+-]/, '').replace(/\D/g, '');
  // убираем ведущие нули, но не все
  const normalized = onlyDigits.replace(/^0+(?=\d)/, '') || '0';
  return {
    sign: normalized === '0' ? '' : negative ? '-' : '',
    digits: normalized,
  };
}

/** Группировка тысяч: "1234567" → "1 234 567" */
function group3(x: string): string {
  return x.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Форматировать тысячные рубли в человекочитаемую строку.
 * Пример: "123450" → "123.450 ₽"
 */
export function formatRubThousandths(
  value: string,
  opts?: FormatMoneyOptions
): string {
  const o: Required<FormatMoneyOptions> = {
    spaceBeforeCurrency: opts?.spaceBeforeCurrency ?? true,
    currency: opts?.currency ?? '₽',
    groupThousands: opts?.groupThousands ?? false,
    trimTrailingZeros: opts?.trimTrailingZeros ?? false,
  };

  const { sign, digits } = splitSign(value);

  // целая и дробная части (в тысячных)
  const len = digits.length;
  const rub = len > 3 ? digits.slice(0, len - 3) : '0';
  const fracRaw = len > 3 ? digits.slice(len - 3) : digits.padStart(3, '0');

  const rubFormatted = o.groupThousands ? group3(rub) : rub;

  const frac = o.trimTrailingZeros ? fracRaw.replace(/0+$/, '') : fracRaw;
  const withFrac = frac.length > 0 ? `${rubFormatted}.${frac}` : rubFormatted;

  const currencyPart = o.currency
    ? o.spaceBeforeCurrency
      ? ` ${o.currency}`
      : o.currency
    : '';
  return `${sign}${withFrac}${currencyPart}`;
}

/**
 * Нормализовать строку-целое (тысячные): убрать знак '+' и пробелы, привести "-000" к "0".
 * Сохраняем знак только для ненулевых значений.
 */
export function normalizeThousandths(raw: string): string {
  const { sign, digits } = splitSign(raw);
  return (sign ? '-' : '') + digits;
}

export type RubToThousandthsOptions = {
  /**
   * Стратегия округления при >3 знаков после разделителя:
   * - 'round' (по умолчанию): классическое банковское округление 0.5↑
   * - 'floor': отбрасываем лишние знаки вниз
   * - 'ceil' : отбрасываем лишние знаки вверх
   */
  mode?: 'round' | 'floor' | 'ceil';
  /** Допустимые разделители дробной части. По умолчанию и точка, и запятая. */
  decimalSeparators?: ('.' | ',')[];
};

/**
 * Конвертировать рубли (строка с дробной частью) → строка тысячных.
 * Примеры:
 *  - "123"       → "123000"
 *  - "123.4"     → "123400"
 *  - "123,45"    → "123450"
 *  - "123.4567"  → "123457" (mode: 'round')
 */
export function rubToThousandths(
  input: string,
  options?: RubToThousandthsOptions
): string {
  const mode = options?.mode ?? 'round';
  const seps = options?.decimalSeparators ?? ['.', ','];

  const s = String(input).trim();
  const neg = s.startsWith('-');
  const core = s.replace(/^[+-]/, '');

  // ищем разделитель (первый из допустимых)
  const sepIndex = seps
    .map((sep) => ({ sep, idx: core.indexOf(sep) }))
    .filter((x) => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx)[0];

  let whole = '';
  let frac = '';

  if (!sepIndex) {
    whole = core.replace(/\D/g, '') || '0';
    frac = '';
  } else {
    const sep = sepIndex.sep;
    const parts = core.split(sep);
    whole = (parts[0] || '0').replace(/\D/g, '') || '0';
    frac = (parts[1] || '').replace(/\D/g, '');
  }

  // приводим дробную часть к 3 знакам с нужным округлением
  const frac3 = (() => {
    if (frac.length === 0) return '000';
    if (frac.length === 1) return `${frac}00`;
    if (frac.length === 2) return `${frac}0`;

    const major = frac.slice(0, 3);
    const rest = frac.slice(3);

    if (rest.length === 0) return major;

    if (mode === 'floor') return major;
    if (mode === 'ceil') {
      // если есть хвост и он не нули — инкремент
      const needsUp = /[1-9]/.test(rest);
      if (!needsUp) return major;
      return inc3(major);
    }
    // round: смотрим первый лишний знак
    const firstExtra = rest.charCodeAt(0) - 48; // 0..9
    if (firstExtra >= 5) return inc3(major);
    return major;
  })();

  // инкрементируем целую часть, если дробная “переполнилась” до 1000
  let w = whole.replace(/^0+(?=\d)/, '') || '0';
  let f = frac3;
  if (f === '1000') {
    f = '000';
    w = addIntStr(w, '1');
  }

  const digits = `${w}${f}`.replace(/^0+(?=\d)/, '') || '0';
  return (neg && digits !== '0' ? '-' : '') + digits;
}

/** Увеличить строку-целое на строку-целое (оба ≥ 0), без BigInt. */
function addIntStr(a: string, b: string): string {
  let i = a.length - 1;
  let j = b.length - 1;
  let carry = 0;
  const out: string[] = [];
  while (i >= 0 || j >= 0 || carry) {
    const da = i >= 0 ? a.charCodeAt(i) - 48 : 0;
    const db = j >= 0 ? b.charCodeAt(j) - 48 : 0;
    const sum = da + db + carry;
    out.push(String(sum % 10));
    carry = Math.floor(sum / 10);
    i -= 1;
    j -= 1;
  }
  return out.reverse().join('');
}

/** Инкрементировать трехзначную строку "000".."999" → "001".."1000" */
function inc3(x: string): string {
  const n0 = x.charCodeAt(2) - 48;
  const n1 = x.charCodeAt(1) - 48;
  const n2 = x.charCodeAt(0) - 48;
  let c0 = n0 + 1;
  let c1 = n1;
  let c2 = n2;
  if (c0 >= 10) {
    c0 = 0;
    c1 += 1;
  }
  if (c1 >= 10) {
    c1 = 0;
    c2 += 1;
  }
  if (c2 >= 10) {
    return '1000';
  }
  return `${c2}${c1}${c0}`;
}

export function formatRubHumanThousandths(
  value: string,
  opts?: FormatRubHumanOptions
): string {
  const o: Required<FormatRubHumanOptions> = {
    useComma: opts?.useComma ?? true,
    groupThousands: opts?.groupThousands ?? false,
    spaceBeforeCurrency: opts?.spaceBeforeCurrency ?? true,
    currency: opts?.currency ?? '₽',
  };

  const { sign, digits } = splitSign(value); // из этого же файла
  const len = digits.length;
  const rubRaw = len > 3 ? digits.slice(0, len - 3) : '0';
  const fracRaw = len > 3 ? digits.slice(len - 3) : digits.padStart(3, '0');

  const rub = o.groupThousands ? group3(rubRaw) : rubRaw; // из этого же файла
  const frac = fracRaw.replace(/0+$/, ''); // срезаем хвостовые нули
  const currencyPart = o.currency
    ? o.spaceBeforeCurrency
      ? ` ${o.currency}`
      : o.currency
    : '';

  if (frac.length === 0) return `${sign}${rub}${currencyPart}`;
  const sep = o.useComma ? ',' : '.';
  return `${sign}${rub}${sep}${frac}${currencyPart}`;
}
