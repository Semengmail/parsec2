import { dayjs } from './dayjs';

export const ruToNumDayMap: Record<string, number> = {
  Пн: 1,
  Вт: 2,
  Ср: 3,
  Чт: 4,
  Пт: 5,
  Сб: 6,
  Вс: 0,
};

export const numToRuDayMap: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  0: 'Вс',
};

export const getUserTimezone = () => dayjs.tz.guess();

export const checkDateFormat = (
  date: string
): { isNewFormat: boolean; isOldFormat: boolean; isDate: boolean } => {
  date = date.slice(-5) === '00-00' ? date.slice(0, 10) : date;
  const isNewFormat = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(date);
  const isOldFormat = /^\d{4}-\d{2}-\d{2}$/.test(date);
  return { isNewFormat, isOldFormat, isDate: isNewFormat || isOldFormat };
};

export function getFormattedDate(date: string, format?: 'single'): string;
export function getFormattedDate(
  date: string,
  format: 'different'
): { date: string; hours: string };
export function getFormattedDate(
  date: string,
  format: 'single' | 'different' = 'single'
): string | { date: string; hours: string } {
  const { isNewFormat, isDate } = checkDateFormat(date);
  if (!isDate) return date;

  const userTimezone = getUserTimezone();
  const parsedDate = dayjs.utc(
    date,
    isNewFormat ? 'YYYY-MM-DD-HH-mm' : 'YYYY-MM-DD'
  );
  const localizedDate = parsedDate.tz(userTimezone);

  if (format === 'single') {
    return isNewFormat
      ? localizedDate.format('DD.MM HH:mm')
      : localizedDate.format('DD.MM');
  } else {
    return {
      date: localizedDate.format('DD.MM'),
      hours: localizedDate.format('HH:mm'),
    };
  }
}

export const compareDates = (a: string, b: string) => {
  const normalizeDate = (date: string) => {
    const { isNewFormat } = checkDateFormat(date);
    return isNewFormat ? date : `${date}-00-00`;
  };

  const dateA = dayjs(normalizeDate(a), 'YYYY-MM-DD-HH-mm');
  const dateB = dayjs(normalizeDate(b), 'YYYY-MM-DD-HH-mm');

  return dateB.isBefore(dateA) ? 1 : -1;
};

export const extractDate = (input: string): string | null => {
  const match = input.match(/\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/);
  return match ? match[0] : null;
};

export const isValidDate = (
  date: unknown,
  format: string = 'YYYY-MM-DD'
): date is string =>
  typeof date === 'string' && dayjs(date, format, true).isValid();

export const formatShortDate = (date: string): string => {
  const { isNewFormat, isOldFormat } = checkDateFormat(date);
  if (!isNewFormat && !isOldFormat) return '';

  const normalized = isOldFormat ? `${date}-00-00` : date;

  const parsed = dayjs(normalized, 'YYYY-MM-DD-HH-mm');
  if (!parsed.isValid()) return '';

  return parsed.format('DD.MM.YY');
};

export const getFormattedDateWithWeekday = (
  date: string
): { date: string; weekday: string } => {
  const { isNewFormat, isOldFormat } = checkDateFormat(date);
  if (!isNewFormat && !isOldFormat) return { date: '', weekday: '' };

  const userTimezone = getUserTimezone();
  const normalized = isOldFormat ? `${date}-00-00` : date;

  const parsed = dayjs.utc(normalized, 'YYYY-MM-DD-HH-mm').tz(userTimezone);
  if (!parsed.isValid()) return { date: '', weekday: '' };

  return {
    date: parsed.format('DD.MM.YY'),
    weekday: numToRuDayMap[parsed.day()],
  };
};

export const formatFullDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  const [yyyy, mm, dd, hh, min] = dateStr.split('-').map(Number);
  const date = dayjs(new Date(yyyy, mm - 1, dd, hh, min));
  return date.format('D MMMM YYYY, HH:mm:ss');
};

export function getAgeAgoText(createdAt: string | Date): string {
  return dayjs(createdAt).fromNow(); // "7 месяцев назад", "год назад"
}

export function getAgeText(createdAt: string | Date): string {
  const start = dayjs(createdAt);
  const now = dayjs();

  const totalMonths = now.diff(start, 'month');
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years === 0 && months === 0) return 'меньше месяца';
  if (years === 0) return `${months} мес.`;
  if (months === 0) return `${years} ${getYearWord(years)}`;
  return `${years} ${getYearWord(years)} и ${months} мес.`;
}

export function getYearWord(years: number): string {
  if (years % 10 === 1 && years % 100 !== 11) return 'год';
  if ([2, 3, 4].includes(years % 10) && ![12, 13, 14].includes(years % 100))
    return 'года';
  return 'лет';
}
