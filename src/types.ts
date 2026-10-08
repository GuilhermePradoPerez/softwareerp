export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  crea_registro: string;
  created_at: string;
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  cnpj: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  lead_time_days: number;
  created_at: string;
}

export interface RawMaterial {
  id: number;
  code: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  unit_cost: number;
  supplier_id: number | null;
  supplier_name?: string;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  raw_material_id: number;
  material_code: string;
  material_name: string;
  material_unit: string;
  movement_type: 'ENTRADA' | 'SAIDA_OP' | 'AJUSTE';
  quantity: number;
  reference: string;
  responsible_user: string;
  created_at: string;
}

export interface ProductBomItem {
  id?: number;
  product_id?: number;
  raw_material_id: number;
  material_code?: string;
  material_name?: string;
  material_unit?: string;
  unit_cost?: number;
  current_stock?: number;
  quantity_required: number;
  total_required?: number;
  stage_notes: string;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  category: string;
  description: string;
  process_time_minutes: number;
  setup_time_minutes: number;
  unit_price: number;
  technical_notes: string;
  material_cost: number;
  bom: ProductBomItem[];
  created_at: string;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
  document: string;
  contact_person: string;
  phone: string;
  email: string;
  city_state: string;
  address: string;
  created_at: string;
}

export interface Capacity {
  id: number;
  period_code: string;
  period_label: string;
  work_center: string;
  shifts_per_day: number;
  hours_per_shift: number;
  working_days: number;
  operators_count: number;
  efficiency_factor: number;
  available_minutes: number;
  allocated_minutes: number;
  completed_minutes: number;
  utilization_percent: number;
  orders_count: number;
  notes: string;
  created_at: string;
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_id: number;
  product_code?: string;
  product_name?: string;
  process_time_minutes?: number;
  setup_time_minutes?: number;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name: string;
  customer_code: string;
  customer_city: string;
  order_date: string;
  delivery_date: string;
  priority: 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE';
  status: 'ABERTO' | 'EM_PRODUCAO' | 'CONCLUIDO' | 'CANCELADO';
  notes: string;
  created_by: string;
  created_at: string;
  items: OrderItem[];
  total_value: number;
  total_process_minutes: number;
  ops_count: number;
  linked_ops: { id: number; op_number: string; status: string }[];
}

export interface ProductionOrder {
  id: number;
  op_number: string;
  order_id: number | null;
  order_number?: string;
  order_delivery_date?: string;
  customer_name?: string;
  customer_code?: string;
  customer_city?: string;
  product_id: number;
  product_code: string;
  product_name: string;
  product_category: string;
  product_technical_notes: string;
  capacity_period_id: number | null;
  capacity_period_label?: string;
  capacity_period_code?: string;
  quantity: number;
  unit_process_time_minutes: number;
  setup_time_minutes: number;
  planned_total_minutes: number;
  actual_total_minutes: number | null;
  status: 'PLANEJADA' | 'EM_PROCESSO' | 'PAUSADA' | 'CONCLUIDA' | 'CANCELADA';
  current_stage: string;
  priority: 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE';
  start_date: string;
  due_date: string;
  started_at: string | null;
  completed_at: string | null;
  technical_responsible: string;
  technical_crea: string;
  completion_notes: string;
  batch_code: string;
  materials_deducted: number;
  bom: ProductBomItem[];
  created_at: string;
}

export interface ErpState {
  users: User[];
  suppliers: Supplier[];
  rawMaterials: RawMaterial[];
  stockMovements: StockMovement[];
  products: Product[];
  customers: Customer[];
  capacities: Capacity[];
  orders: Order[];
  productionOrders: ProductionOrder[];
}
