// Language
export type Language = "en" | "zh";

// Menu hierarchy
export interface Modifier {
  id: string;
  name: string;
  nameCn?: string;
  price: number; // additional price
}

export interface ModifierGroup {
  id: string;
  name: string;
  nameCn?: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: Modifier[];
  // Optional conditional visibility: this group is only shown (and only
  // counts toward required completion) when ANY of `modifierIds` is
  // currently selected in the group identified by `groupId`.
  showIf?: { groupId: string; modifierIds: string[] };
}

export interface ComboComponent {
  id: string;
  name: string;
  nameCn?: string;
  price: number; // 0 = included, positive = upcharge
  modifierGroups: ModifierGroup[]; // nested modifiers (e.g. steak temperature)
}

export interface ComboGroup {
  id: string;
  name: string; // "Choose Your Steak", "Choose Your Side"
  nameCn?: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  components: ComboComponent[];
}

export interface MenuItem {
  id: string;
  name: string;
  nameCn?: string;
  price: number;
  description?: string;
  modifierGroups: ModifierGroup[];
  isCombo?: boolean;
  comboGroups?: ComboGroup[];
  soldOut?: boolean;
}

export interface Category {
  id: string;
  name: string;
  nameCn?: string;
  items: MenuItem[];
}

export interface MenuBook {
  id: string;
  name: string;
  categories: Category[];
}

// Table / Floor
export type TableStatus = "available" | "occupied" | "checkout" | "unavailable";
export type TableShape = "circle" | "rect";

export interface Table {
  id: string;
  name: string;
  area: string; // "Main", "Bar", "Patio"
  status: TableStatus;
  shape: TableShape;
  x: number; // position as percentage (0-100) of map width
  y: number; // position as percentage (0-100) of map height
  w: number; // width in px
  h: number; // height in px
  guestCount?: number;
  serverName?: string;
  hasActiveOrder?: boolean;
  orderStatus?: OrderStatus;
}

// Staff
export interface Staff {
  id: string;
  name: string;
  pin: string;
  role: string;
}

// Cart / Order
export interface CartItemModifier {
  groupId: string;
  groupName: string;
  modifiers: Modifier[];
}

export interface CartComboSelection {
  groupId: string;
  groupName: string;
  component: ComboComponent;
  modifiers: CartItemModifier[]; // nested modifiers for this component
}

export interface CartItemDiscount {
  type: "percent" | "amount";
  value: number; // e.g. 10 for 10%, or 5.00 for $5 off
}

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  basePrice: number;
  quantity: number;
  modifiers: CartItemModifier[];
  comboSelections?: CartComboSelection[];
  note?: string;
  priceAdjustment?: number;
  discount?: CartItemDiscount | null;
  comped?: boolean;
  toGo?: boolean;
  priceOverride?: number | null;
  breaklineAbove?: boolean;
  breaklineBelow?: boolean;
  sent: boolean;
  totalPrice: number;
  voided?: boolean;
  voidedReason?: string;
}

export type OrderStatus = "editing" | "sent" | "closed" | "voided";

export interface Order {
  id: string;
  orderNumber: string;
  tableId: string;
  tableName: string;
  guestCount: number;
  serverId: string;
  serverName: string;
  items: CartItem[];
  status: OrderStatus;
  orderType: "dine-in" | "takeout";
  total: number;
  createdAt: string;
}
