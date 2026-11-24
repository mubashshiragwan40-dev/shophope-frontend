// lib/orders.ts
// Safe to import from client components. Keep this file free of server-only code.

/* ============================================================
   CONSTANTS
   ============================================================ */

/** Flat delivery fee in KD. The checkout page and the server both use this value. */
export const DELIVERY_FEE_KD: number = 1.0;

export const KUWAIT_GOVERNORATES: readonly string[] = [
  "Al Asimah",
  "Hawalli",
  "Farwaniya",
  "Mubarak Al-Kabeer",
  "Al Ahmadi",
  "Al Jahra",
];

export const KUWAIT_AREAS_BY_GOVERNORATE: Record<string, readonly string[]> = {
  "Al Asimah": [
    "Kuwait City",
    "Sharq",
    "Dasman",
    "Mirqab",
    "Dasma",
    "Daiya",
    "Mansouriya",
    "Abdullah Al-Salem",
    "Nuzha",
    "Faiha",
    "Shamiya",
    "Rawda",
    "Adailiya",
    "Khaldiya",
    "Kaifan",
    "Qadsiya",
    "Surra",
    "Qortuba",
    "Yarmouk",
    "Shuwaikh",
  ],
  Hawalli: [
    "Hawalli",
    "Salmiya",
    "Jabriya",
    "Rumaithiya",
    "Salwa",
    "Bayan",
    "Mishref",
    "Mubarak Al-Abdullah",
    "Shaab",
    "Zahra",
    "Hateen",
    "Shuhada",
    "Siddiq",
    "Salam",
  ],
  Farwaniya: [
    "Farwaniya",
    "Khaitan",
    "Jleeb Al-Shuyoukh",
    "Abbasiya",
    "Ardiya",
    "Rabiya",
    "Rehab",
    "Omariya",
    "Andalous",
    "Riggae",
    "Firdous",
    "Sabah Al-Nasser",
    "Abdullah Al-Mubarak",
    "Ishbiliya",
    "Dajeej",
  ],
  "Mubarak Al-Kabeer": [
    "Mubarak Al-Kabeer",
    "Sabah Al-Salem",
    "Qurain",
    "Qusour",
    "Adan",
    "Messila",
    "Abu Fatira",
    "Abu Al Hasaniya",
    "Fnaitees",
    "Masayel",
  ],
  "Al Ahmadi": [
    "Fahaheel",
    "Mangaf",
    "Mahboula",
    "Abu Halifa",
    "Fintas",
    "Eqaila",
    "Riqqa",
    "Hadiya",
    "Sabahiya",
    "Ahmadi",
    "Jaber Al-Ali",
    "Fahad Al-Ahmad",
    "Ali Sabah Al-Salem",
    "Sabah Al-Ahmad",
  ],
  "Al Jahra": [
    "Jahra",
    "Saad Al-Abdullah",
    "Qasr",
    "Naeem",
    "Oyoun",
    "Taima",
    "Waha",
    "Naseem",
    "Sulaibiya",
    "Abdali",
  ],
};

/* ============================================================
   CHECKOUT TYPES
   ============================================================ */

export type DeliveryMethod = "standard";
export type PaymentMethod = "cod";

export interface CartLine {
  id: string; // WPGraphQL global ID or plain WooCommerce product ID
  quantity: number;
}

export interface CheckoutCustomer {
  firstName: string;
  lastName: string;
  email?: string; // Optional for WhatsApp-first checkout
  phone: string; // stored as +965XXXXXXXX
  governorate: string;
  area: string;
  block: string;
  street: string;
  building: string;
  floor?: string;
  apartment?: string;
  deliveryNote?: string;
}

export interface CreateOrderRequest {
  customer: CheckoutCustomer;
  items: CartLine[];
  delivery: DeliveryMethod;
  payment: PaymentMethod;
}

export interface CreateOrderResponse {
  orderId: number;
  orderNumber: string;
  email?: string;
  phone: string;
}

/* ============================================================
   ORDER TRACKING TYPES
   ============================================================ */

export type OrderStatus =
  | "pending"
  | "processing"
  | "on-hold"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed";

export interface TimelineStep {
  key: OrderStatus;
  label: string;
  done: boolean;
  current: boolean;
}

export interface TrackedItem {
  name: string;
  quantity: number;
  total: string;
}

export interface TrackedOrder {
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  dateCreated: string;
  total: string;
  currency: string;
  shippingTotal: string;
  items: TrackedItem[];
  trackingNumber: string | null;
  carrier: string | null;
  trackingUrl: string | null;
  timeline: TimelineStep[];
}

/* ============================================================
   LABELS AND TIMELINE
   ============================================================ */

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Order placed",
  processing: "Processing",
  "on-hold": "On hold",
  completed: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

export const TIMELINE_STEPS: ReadonlyArray<{ key: OrderStatus; label: string }> = [
  { key: "pending", label: "Order placed" },
  { key: "processing", label: "Processing" },
  { key: "completed", label: "Delivered" },
];