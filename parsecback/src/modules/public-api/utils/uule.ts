export type UuleOptions = {
  /** микросекунды; по умолчанию текущее время */
  timestampMicros?: number;
  /** радиус (м), -1 = точка; по умолчанию -1 */
  radiusMeters?: number;
};

/** Генерирует 'a+' UULE из десятичных широты/долготы */
export function generateUuleA(
  lat: number,
  lon: number,
  opts?: UuleOptions,
): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('generateUuleA: lat/lon must be finite numbers');
  }
  const latE7 = Math.round(lat * 1e7);
  const lonE7 = Math.round(lon * 1e7);
  const ts = opts?.timestampMicros ?? Math.floor(Date.now() * 1000);
  const radius = Number.isFinite(opts?.radiusMeters) ? opts!.radiusMeters! : -1;

  const payload =
    `role:1\n` +
    `producer:12\n` +
    `provenance:6\n` +
    `timestamp:${ts}\n` +
    `latlng{\n` +
    `latitude_e7:${latE7}\n` +
    `longitude_e7:${lonE7}\n` +
    `}\n` +
    `radius:${radius}\n`;

  const base64 = Buffer.from(payload, 'ascii').toString('base64');
  return `a+${base64}`;
}

function writeVarint(n: number): number[] {
  const out: number[] = [];
  let v = n >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return out;
}

/**
 * Генерирует 'w+' UULE из названия города.
 * Пример: "Omsk" -> w+CAIQICIET21zaw
 * Для русских названий (UTF-8) работает так же: "Омск" и т.д. — транслит НЕ нужен.
 *
 * Поля protobuf (по факту):
 *  1: varint = 2
 *  2: varint = 32 (precision)
 *  4: bytes  = UTF-8 строка города
 */
export function generateUuleW(cityName: string, precision = 32): string {
  const name = String(cityName ?? '').trim();
  if (!name) throw new Error('generateUuleW: cityName is empty');

  // field 1 (tag = 0x08), value = 2
  const f1 = [0x08, ...writeVarint(2)];
  // field 2 (tag = 0x10), value = precision (обычно 32)
  const f2 = [0x10, ...writeVarint(precision)];
  // field 4 (tag = 0x22), length-delimited UTF-8 bytes
  const nameBytes = Buffer.from(name, 'utf8');
  const f4 = [0x22, ...writeVarint(nameBytes.length), ...nameBytes];

  const payload = Buffer.from([...f1, ...f2, ...f4]);
  return 'w+' + payload.toString('base64').replace(/=+$/g, '');
}
