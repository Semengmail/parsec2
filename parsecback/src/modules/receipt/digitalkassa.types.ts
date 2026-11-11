export interface DKReceiptDoc {
  reg_time?: string;
  shift_num?: number;
  index?: number;
  fiscal_sign?: string;
  fiscal_num?: string;
}

export interface DKReceiptCashbox {
  rn?: string;
  ffd?: string;
  fn_num?: string;
  factory_num?: string;
}

export interface DKReceiptService {
  receipt_url?: string;
}

export interface DKReceiptResponse {
  doc?: DKReceiptDoc;
  cashbox?: DKReceiptCashbox;
  service?: DKReceiptService;
}

export interface DKErrorResponse {
  code?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface DKReceiptItem {
  name: string;
  price: number;
  quantity: number;
  amount: number;

  type: number; // Тег 1212 (предмет расчёта) → 10 (платёж)
  vat: number; // 6 = НДС не облагается
  unit: number; // 0 = штука

  payment_method: number; // 4 = полный расчёт
  payment_object: number; // 10 = платёж
}

export interface CreateReceiptBody {
  type: number; // 1 - приход
  taxation: number; // 32 - ПСН
  is_internet: number;
  timezone: number;

  items: DKReceiptItem[];

  amount: {
    cash: number;
    cashless: number;
  };

  notify: {
    emails?: string[];
    phone?: string;
  };

  loc: {
    billing_place: string;
  };
}
