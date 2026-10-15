import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const app = express();
app.use(express.json());

const dbPath = path.resolve(process.cwd(), 'erp_database.sqlite');
const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Initialize relational schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Engenheiro de Produção',
    crea_registro TEXT NOT NULL DEFAULT 'CREA-SP 5069182340',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT NOT NULL,
    lead_time_days INTEGER NOT NULL DEFAULT 5,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS raw_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    current_stock REAL NOT NULL DEFAULT 0,
    min_stock REAL NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0,
    supplier_id INTEGER,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_material_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL, -- 'ENTRADA', 'SAIDA_OP', 'AJUSTE'
    quantity REAL NOT NULL,
    reference TEXT NOT NULL,
    responsible_user TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    process_time_minutes INTEGER NOT NULL,
    setup_time_minutes INTEGER NOT NULL DEFAULT 15,
    unit_price REAL NOT NULL DEFAULT 0,
    technical_notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_bom (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    raw_material_id INTEGER NOT NULL,
    quantity_required REAL NOT NULL,
    stage_notes TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    document TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    city_state TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS capacities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_code TEXT NOT NULL UNIQUE,
    period_label TEXT NOT NULL,
    work_center TEXT NOT NULL,
    shifts_per_day INTEGER NOT NULL,
    hours_per_shift REAL NOT NULL,
    working_days INTEGER NOT NULL,
    operators_count INTEGER NOT NULL,
    efficiency_factor REAL NOT NULL DEFAULT 0.85,
    available_minutes INTEGER NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    order_date TEXT NOT NULL,
    delivery_date TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'NORMAL', -- 'BAIXA', 'NORMAL', 'ALTA', 'URGENTE'
    status TEXT NOT NULL DEFAULT 'ABERTO', -- 'ABERTO', 'EM_PRODUCAO', 'CONCLUIDO', 'CANCELADO'
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS production_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    op_number TEXT NOT NULL UNIQUE,
    order_id INTEGER,
    product_id INTEGER NOT NULL,
    capacity_period_id INTEGER,
    quantity INTEGER NOT NULL,
    unit_process_time_minutes INTEGER NOT NULL,
    setup_time_minutes INTEGER NOT NULL,
    planned_total_minutes INTEGER NOT NULL,
    actual_total_minutes INTEGER,
    status TEXT NOT NULL DEFAULT 'PLANEJADA', -- 'PLANEJADA', 'EM_PROCESSO', 'PAUSADA', 'CONCLUIDA', 'CANCELADA'
    current_stage TEXT NOT NULL DEFAULT 'Aguardando Liberação',
    priority TEXT NOT NULL DEFAULT 'NORMAL',
    start_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    technical_responsible TEXT NOT NULL,
    technical_crea TEXT NOT NULL,
    completion_notes TEXT NOT NULL DEFAULT '',
    batch_code TEXT NOT NULL DEFAULT '',
    materials_deducted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (capacity_period_id) REFERENCES capacities(id) ON DELETE SET NULL
  );
`);

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_forja_salt').digest('hex');
}

function getNextOpNumber(): string {
  const allOps = db.prepare('SELECT op_number FROM production_orders').all() as { op_number: string }[];
  let maxSeq = 0;
  for (const row of allOps) {
    const match = row.op_number.match(/OP-\d{4}-(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  const nextSeq = Math.max(maxSeq + 1, allOps.length + 1);
  return `OP-2026-${String(nextSeq).padStart(3, '0')}`;
}

function getNextOrderNumber(): string {
  const allOrders = db.prepare('SELECT order_number FROM orders').all() as { order_number: string }[];
  let maxSeq = 100;
  for (const row of allOrders) {
    const match = row.order_number.match(/PED-\d{4}-(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  const nextSeq = Math.max(maxSeq + 1, 100 + allOrders.length + 1);
  return `PED-2026-${String(nextSeq).padStart(4, '0')}`;
}

// Seed initial realistic Brazilian SME manufacturing data if empty
function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) return;

  const now = new Date().toISOString();

  // Users (Responsáveis Técnicos)
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, crea_registro, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertUser.run('Eng. Carlos Eduardo Mendes', 'carlos.mendes@forjaindustrial.com.br', hashPassword('123456'), 'Engenheiro Chefe de Produção', 'CREA-SP 5069182340', now);
  insertUser.run('Eng. Helena Vasconcelos', 'helena.v@forjaindustrial.com.br', hashPassword('123456'), 'Supervisora de PCP e Qualidade', 'CREA-SP 5071928311', now);
  insertUser.run('Téc. Roberto Almeida', 'roberto.almeida@forjaindustrial.com.br', hashPassword('123456'), 'Coordenador Técnico de Usinagem', 'CFT-SP 0849123490', now);

  // Suppliers
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (code, name, cnpj, contact_person, phone, email, address, lead_time_days, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertSupplier.run('FOR-001', 'Aços Anhangüera Distribuidora Ltda', '45.192.830/0001-18', 'Marcos Farias', '(11) 3942-8800', 'vendas@acosanhanguera.com.br', 'Av. Industrial, 1420 - Santo André/SP', 4, now);
  insertSupplier.run('FOR-002', 'Polímeros & Elastômeros Sul Brasil S.A.', '19.402.110/0001-92', 'Patrícia Nogueira', '(47) 3433-1900', 'comercial@polimerossul.com.br', 'Rua Dona Francisca, 8300 - Joinville/SC', 7, now);
  insertSupplier.run('FOR-003', 'Fixadores Precisão Piracicaba Ltda', '62.881.094/0001-45', 'Sérgio Camargo', '(19) 3421-5510', 'pedidos@fixadoresprecisao.com.br', 'Rod. Luiz de Queiroz, Km 154 - Piracicaba/SP', 3, now);
  insertSupplier.run('FOR-004', 'Motores e Bobinas EletroSul Ltda', '08.712.903/0001-60', 'Fernanda Klein', '(54) 3218-4400', 'atendimento@eletrosul.ind.br', 'Av. Ruben Bento Alves, 2100 - Caxias do Sul/RS', 6, now);

  // Raw Materials
  const insertRM = db.prepare(`
    INSERT INTO raw_materials (code, name, unit, current_stock, min_stock, unit_cost, supplier_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRM.run('MP-101', 'Barra Redonda Aço SAE 1045 Ø 50mm', 'kg', 480, 150, 14.50, 1, now);
  insertRM.run('MP-102', 'Chapa Aço Carbono ASTM A36 6.35mm', 'm²', 85, 30, 195.00, 1, now);
  insertRM.run('MP-103', 'Rolamento Rígido de Esferas 6205-2RS', 'un', 140, 40, 28.90, 3, now);
  insertRM.run('MP-104', 'Retentor Nitrílico 35x52x7mm Alta Temp.', 'un', 210, 60, 12.40, 2, now);
  insertRM.run('MP-105', 'Kit Parafuso Sextavado Inox M10x35 + Porca', 'cj', 600, 150, 4.20, 3, now);
  insertRM.run('MP-106', 'Tinta Epóxi Poliamida Cinza Munsell N6.5', 'L', 45, 20, 68.00, 2, now);
  insertRM.run('MP-107', 'Motor Elétrico Trifásico 2CV 4 Polos 220/380V', 'un', 18, 10, 890.00, 4, now);
  insertRM.run('MP-108', 'Bucha de Bronze TM-23 Usinada Ø 35mm', 'un', 32, 25, 46.00, 1, now);

  // Initial Stock Movements
  const insertMov = db.prepare(`
    INSERT INTO stock_movements (raw_material_id, movement_type, quantity, reference, responsible_user, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertMov.run(1, 'ENTRADA', 480, 'NF-e 49812 - Saldo Inicial', 'Eng. Carlos Eduardo Mendes', now);
  insertMov.run(2, 'ENTRADA', 85, 'NF-e 49815 - Saldo Inicial', 'Eng. Carlos Eduardo Mendes', now);
  insertMov.run(3, 'ENTRADA', 140, 'NF-e 11029 - Saldo Inicial', 'Eng. Helena Vasconcelos', now);
  insertMov.run(7, 'ENTRADA', 18, 'NF-e 88321 - Lote Motores WEG/EletroSul', 'Eng. Helena Vasconcelos', now);

  // Products (Fichas Técnicas)
  const insertProduct = db.prepare(`
    INSERT INTO products (code, name, category, description, process_time_minutes, setup_time_minutes, unit_price, technical_notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertProduct.run(
    'PRD-001',
    'Redutor Planetário Industrial RP-400',
    'Transmissão Mecânica',
    'Redutor de velocidade planetário relação 1:25 para esteiras transportadoras pesadas.',
    95,
    30,
    2450.00,
    'Usinagem CNC do eixo principal com tolerância H7. Ensaio de ruído em bancada por 15 min antes da pintura.',
    now
  );
  insertProduct.run(
    'PRD-002',
    'Bomba Centrífuga Sanitária Inox BC-20',
    'Bombeamento de Fluidos',
    'Conjunto motobomba centrífugo 2CV com vedação dupla para linhas de processamento.',
    120,
    25,
    3890.00,
    'Teste hidrostático obrigatório a 6 bar. Verificar alinhamento axial do rotor e torque dos fixadores em 35 Nm.',
    now
  );
  insertProduct.run(
    'PRD-003',
    'Mancal de Rolamento Blindado MR-50',
    'Componentes de Apoio',
    'Caixa de mancal bipartida em aço usinado com dupla vedação labirinto e rolamento 6205.',
    45,
    15,
    620.00,
    'Aplicar graxa à base de lítio MP-2 em 40% do volume livre da caixa antes do fechamento.',
    now
  );
  insertProduct.run(
    'PRD-004',
    'Válvula Guilhotina Pneumática VG-150',
    'Controle de Fluxo',
    'Válvula de bloqueio para sólidos e polpas abrasivas DN 150mm com faca retificada.',
    75,
    20,
    1780.00,
    'Lapidação da faca e verificação de estanqueidade nos retentores nitrílicos.',
    now
  );

  // Product BOM (Itens da Ficha Técnica)
  const insertBom = db.prepare(`
    INSERT INTO product_bom (product_id, raw_material_id, quantity_required, stage_notes)
    VALUES (?, ?, ?, ?)
  `);
  // PRD-001: Redutor RP-400
  insertBom.run(1, 1, 8.5, 'Eixo solar e engrenagens planetárias');
  insertBom.run(1, 2, 0.45, 'Carcaça estrutural soldada');
  insertBom.run(1, 3, 2, 'Apoio do eixo de entrada e saída');
  insertBom.run(1, 4, 2, 'Vedação dos eixos');
  insertBom.run(1, 5, 8, 'Fechamento da tampa frontal');
  insertBom.run(1, 6, 0.35, 'Acabamento anticorrosivo externo');

  // PRD-002: Bomba Centrífuga BC-20
  insertBom.run(2, 1, 4.0, 'Eixo de acoplamento direto');
  insertBom.run(2, 2, 0.60, 'Base estrutural e voluta');
  insertBom.run(2, 4, 2, 'Selo e retenção secundária');
  insertBom.run(2, 5, 12, 'Fixação da base e flange');
  insertBom.run(2, 7, 1, 'Acionamento elétrico principal');
  insertBom.run(2, 6, 0.40, 'Pintura da base metálica');

  // PRD-003: Mancal MR-50
  insertBom.run(3, 1, 3.2, 'Corpo usinado do mancal');
  insertBom.run(3, 3, 2, 'Par de rolamentos internos');
  insertBom.run(3, 4, 2, 'Retentores laterais');
  insertBom.run(3, 5, 4, 'Parafusos de união da caixa');
  insertBom.run(3, 8, 1, 'Bucha espaçadora central');

  // PRD-004: Válvula VG-150
  insertBom.run(4, 2, 0.55, 'Corpo bipartido e faca');
  insertBom.run(4, 1, 2.5, 'Haste de acionamento');
  insertBom.run(4, 4, 2, 'Gaxeta e vedação superior');
  insertBom.run(4, 5, 10, 'União do castelo superior');
  insertBom.run(4, 8, 2, 'Guias de deslizamento em bronze');

  // Customers
  const insertCustomer = db.prepare(`
    INSERT INTO customers (code, name, document, contact_person, phone, email, city_state, address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCustomer.run('CLI-001', 'Usina Boa Vista Bioenergia S.A.', '51.902.441/0001-09', 'Eng. Ricardo Tavares', '(16) 3945-7700', 'suprimentos@usinaboavista.com.br', 'Sertãozinho/SP', 'Rod. Armando de Salles Oliveira, Km 332', now);
  insertCustomer.run('CLI-002', 'Laticínios Vale do Paraíba Ltda', '23.811.709/0001-88', 'Juliana Monteiro', '(12) 3632-4100', 'manutencao@laticiniosvaleparaiba.com.br', 'Taubaté/SP', 'Av. Dom Pedro I, 4800 - Distrito Industrial', now);
  insertCustomer.run('CLI-003', 'Mineração Serra Dourada S.A.', '04.119.582/0001-31', 'Gustavo Drumond', '(31) 3541-9020', 'compras.ind@serradourada.com.br', 'Nova Lima/MG', 'Via Expressa Mineração, 950', now);
  insertCustomer.run('CLI-004', 'Cooperativa Agroindustrial Oeste Paraná', '77.491.023/0001-55', 'Cláudio Zimmermann', '(45) 3220-6600', 'engenharia@cooperoeste.agr.br', 'Cascavel/PR', 'BR-277, Km 591 - Parque Industrial', now);

  // Productive Capacity
  const insertCapacity = db.prepare(`
    INSERT INTO capacities (period_code, period_label, work_center, shifts_per_day, hours_per_shift, working_days, operators_count, efficiency_factor, available_minutes, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // 2 shifts * 8h * 22 days * 4 operators * 60 * 0.85 = 71,808 min (or let's keep a focused cell with 2 operators or 1 shift so utilization shows realistic %)
  // Cell 1: 1 shift * 8h * 22 days * 2 operators * 60 * 0.85 = 17,952 min
  insertCapacity.run(
    'CAP-2026-10',
    'Outubro / 2026 — Célula Principal',
    'Usinagem CNC & Montagem Pesada',
    1,
    8,
    22,
    3,
    0.85,
    Math.round(1 * 8 * 22 * 3 * 60 * 0.85), // 26,928 min
    'Operação padrão em turno único com 3 operadores multifuncionais (Torno CNC, Centro de Usinagem e Bancada).',
    now
  );
  insertCapacity.run(
    'CAP-2026-11',
    'Novembro / 2026 — Alta Demanda Safra',
    'Usinagem CNC & Montagem Pesada',
    2,
    8,
    20,
    3,
    0.88,
    Math.round(2 * 8 * 20 * 3 * 60 * 0.88), // 50,688 min
    'Expansão planejada para segundo turno parcial visando atender parada de manutenção das usinas.',
    now
  );

  // Orders
  const insertOrder = db.prepare(`
    INSERT INTO orders (order_number, customer_id, order_date, delivery_date, priority, status, notes, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertOrder.run('PED-2026-0101', 1, '2026-10-01', '2026-10-14', 'ALTA', 'CONCLUIDO', 'Entrega urgente para linha de moenda B.', 'Eng. Carlos Eduardo Mendes', now);
  insertOrder.run('PED-2026-0102', 2, '2026-10-03', '2026-10-18', 'NORMAL', 'EM_PRODUCAO', 'Acompanha certificado de teste hidrostático.', 'Eng. Carlos Eduardo Mendes', now);
  insertOrder.run('PED-2026-0103', 3, '2026-10-06', '2026-10-22', 'URGENTE', 'EM_PRODUCAO', 'Prioridade máxima para planta de beneficiamento.', 'Eng. Helena Vasconcelos', now);
  insertOrder.run('PED-2026-0104', 4, '2026-10-08', '2026-10-28', 'NORMAL', 'ABERTO', 'Pedido aprovado comercialmente, aguardando geração de OPs.', 'Eng. Carlos Eduardo Mendes', now);

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
    VALUES (?, ?, ?, ?)
  `);
  // PED-2026-0101 (Concluído)
  insertOrderItem.run(1, 3, 12, 620.00);
  // PED-2026-0102 (Em Produção)
  insertOrderItem.run(2, 2, 4, 3890.00);
  insertOrderItem.run(2, 3, 6, 620.00);
  // PED-2026-0103 (Em Produção)
  insertOrderItem.run(3, 1, 5, 2450.00);
  insertOrderItem.run(3, 4, 8, 1780.00);
  // PED-2026-0104 (Aberto - sem OP gerada ainda para permitir geração imediata com 1 clique!)
  insertOrderItem.run(4, 1, 3, 2450.00);
  insertOrderItem.run(4, 2, 2, 3890.00);

  // Production Orders
  const insertOP = db.prepare(`
    INSERT INTO production_orders (
      op_number, order_id, product_id, capacity_period_id, quantity,
      unit_process_time_minutes, setup_time_minutes, planned_total_minutes, actual_total_minutes,
      status, current_stage, priority, start_date, due_date, started_at, completed_at,
      technical_responsible, technical_crea, completion_notes, batch_code, materials_deducted, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // OP-2026-001 (Concluída from PED-0101)
  insertOP.run(
    'OP-2026-001', 1, 3, 1, 12,
    45, 15, 12 * 45 + 15, 548,
    'CONCLUIDA', 'Inspeção Final Concluída e Liberada', 'ALTA',
    '2026-10-02', '2026-10-12', '2026-10-02T08:00:00.000Z', '2026-10-05T16:40:00.000Z',
    'Eng. Carlos Eduardo Mendes', 'CREA-SP 5069182340',
    'Lote aprovado dimensionalmente. Graxa aplicada conforme IT-09. Tempo real dentro da tolerância (+8 min).',
    'LT-2610-001', 1, now
  );

  // OP-2026-002 (Concluída from PED-0102 item Mancal)
  insertOP.run(
    'OP-2026-002', 2, 3, 1, 6,
    45, 15, 6 * 45 + 15, 280,
    'CONCLUIDA', 'Expedição Técnica', 'NORMAL',
    '2026-10-04', '2026-10-16', '2026-10-04T09:15:00.000Z', '2026-10-06T14:20:00.000Z',
    'Eng. Helena Vasconcelos', 'CREA-SP 5071928311',
    'Concluído com ganho de 5 minutos no setup de usinagem.',
    'LT-2610-002', 1, now
  );

  // OP-2026-003 (Em Processo from PED-0102 item Bomba BC-20)
  insertOP.run(
    'OP-2026-003', 2, 2, 1, 4,
    120, 25, 4 * 120 + 25, null,
    'EM_PROCESSO', 'Montagem Mecânica e Teste Hidrostático', 'NORMAL',
    '2026-10-06', '2026-10-18', '2026-10-06T10:00:00.000Z', null,
    'Eng. Carlos Eduardo Mendes', 'CREA-SP 5069182340',
    '', 'LT-2610-003', 0, now
  );

  // OP-2026-004 (Em Processo from PED-0103 item Redutor RP-400)
  insertOP.run(
    'OP-2026-004', 3, 1, 1, 5,
    95, 30, 5 * 95 + 30, null,
    'EM_PROCESSO', 'Usinagem CNC Engrenagens Planetárias', 'URGENTE',
    '2026-10-07', '2026-10-20', '2026-10-07T07:30:00.000Z', null,
    'Eng. Helena Vasconcelos', 'CREA-SP 5071928311',
    '', 'LT-2610-004', 0, now
  );

  // OP-2026-005 (Planejada from PED-0103 item Válvula VG-150)
  insertOP.run(
    'OP-2026-005', 3, 4, 1, 8,
    75, 20, 8 * 75 + 20, null,
    'PLANEJADA', 'Aguardando Corte de Chapa ASTM A36', 'URGENTE',
    '2026-10-09', '2026-10-22', null, null,
    'Eng. Carlos Eduardo Mendes', 'CREA-SP 5069182340',
    '', 'LT-2610-005', 0, now
  );
}

seedInitialData();

// Helper to get enriched state
function getFullErpState() {
  const users = db.prepare('SELECT id, name, email, role, crea_registro, created_at FROM users ORDER BY id ASC').all();
  const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY code ASC').all();
  const rawMaterials = db.prepare(`
    SELECT rm.*, s.name as supplier_name
    FROM raw_materials rm
    LEFT JOIN suppliers s ON rm.supplier_id = s.id
    ORDER BY rm.code ASC
  `).all();
  const stockMovements = db.prepare(`
    SELECT sm.*, rm.code as material_code, rm.name as material_name, rm.unit as material_unit
    FROM stock_movements sm
    JOIN raw_materials rm ON sm.raw_material_id = rm.id
    ORDER BY sm.id DESC
    LIMIT 60
  `).all();

  const productsRaw = db.prepare('SELECT * FROM products ORDER BY code ASC').all() as any[];
  const bomAll = db.prepare(`
    SELECT pb.*, rm.code as material_code, rm.name as material_name, rm.unit as material_unit, rm.unit_cost, rm.current_stock
    FROM product_bom pb
    JOIN raw_materials rm ON pb.raw_material_id = rm.id
  `).all() as any[];

  const products = productsRaw.map((p) => {
    const bom = bomAll.filter((b) => b.product_id === p.id);
    const materialCost = bom.reduce((sum, item) => sum + item.quantity_required * item.unit_cost, 0);
    return {
      ...p,
      bom,
      material_cost: Number(materialCost.toFixed(2)),
    };
  });

  const customers = db.prepare('SELECT * FROM customers ORDER BY code ASC').all();
  const capacitiesRaw = db.prepare('SELECT * FROM capacities ORDER BY period_code ASC').all() as any[];

  const productionOrdersRaw = db.prepare(`
    SELECT po.*,
      p.code as product_code, p.name as product_name, p.category as product_category, p.technical_notes as product_technical_notes,
      o.order_number, o.delivery_date as order_delivery_date,
      c.name as customer_name, c.code as customer_code, c.city_state as customer_city,
      cap.period_label as capacity_period_label, cap.period_code as capacity_period_code
    FROM production_orders po
    JOIN products p ON po.product_id = p.id
    LEFT JOIN orders o ON po.order_id = o.id
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN capacities cap ON po.capacity_period_id = cap.id
    ORDER BY po.id DESC
  `).all() as any[];

  const productionOrders = productionOrdersRaw.map((po) => {
    const bom = bomAll
      .filter((b) => b.product_id === po.product_id)
      .map((b) => ({
        ...b,
        total_required: Number((b.quantity_required * po.quantity).toFixed(3)),
      }));
    return {
      ...po,
      bom,
    };
  });

  const capacities = capacitiesRaw.map((cap) => {
    const opsInPeriod = productionOrders.filter(
      (po) => po.capacity_period_id === cap.id && po.status !== 'CANCELADA'
    );
    const allocatedMinutes = opsInPeriod.reduce((sum, po) => sum + po.planned_total_minutes, 0);
    const completedMinutes = opsInPeriod
      .filter((po) => po.status === 'CONCLUIDA')
      .reduce((sum, po) => sum + (po.actual_total_minutes ?? po.planned_total_minutes), 0);
    const utilizationPercent = cap.available_minutes > 0
      ? Number(((allocatedMinutes / cap.available_minutes) * 100).toFixed(1))
      : 0;
    return {
      ...cap,
      allocated_minutes: allocatedMinutes,
      completed_minutes: completedMinutes,
      utilization_percent: utilizationPercent,
      orders_count: opsInPeriod.length,
    };
  });

  const ordersRaw = db.prepare(`
    SELECT o.*, c.name as customer_name, c.code as customer_code, c.city_state as customer_city
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    ORDER BY o.id DESC
  `).all() as any[];

  const orderItemsAll = db.prepare(`
    SELECT oi.*, p.code as product_code, p.name as product_name, p.process_time_minutes, p.setup_time_minutes
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
  `).all() as any[];

  const orders = ordersRaw.map((o) => {
    const items = orderItemsAll.filter((i) => i.order_id === o.id);
    const totalValue = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
    const totalProcessMinutes = items.reduce(
      (sum, i) => sum + (i.quantity * i.process_time_minutes + i.setup_time_minutes),
      0
    );
    const linkedOps = productionOrders.filter((po) => po.order_id === o.id);
    return {
      ...o,
      items,
      total_value: Number(totalValue.toFixed(2)),
      total_process_minutes: totalProcessMinutes,
      ops_count: linkedOps.length,
      linked_ops: linkedOps.map((po) => ({ id: po.id, op_number: po.op_number, status: po.status })),
    };
  });

  return {
    users,
    suppliers,
    rawMaterials,
    stockMovements,
    products,
    customers,
    capacities,
    orders,
    productionOrders,
  };
}

// --- API ROUTES ---

// Get complete ERP snapshot
app.get('/api/state', (_req: Request, res: Response) => {
  try {
    res.json(getFullErpState());
  } catch (error: any) {
    console.error('Error fetching state:', error);
    res.status(500).json({ error: error.message || 'Erro ao carregar dados do banco relacional.' });
  }
});

// Next sequence codes for UI suggestions
app.get('/api/next-numbers', (_req: Request, res: Response) => {
  try {
    res.json({
      nextOpNumber: getNextOpNumber(),
      nextOrderNumber: getNextOrderNumber(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Authentication: Login or Register
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim()) as any;
    if (!user || user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
    }
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { name, email, password, role, crea_registro } = req.body;
    if (!name || !email || !password || !role || !crea_registro) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios do responsável técnico.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
    if (existing) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, crea_registro, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name.trim(), email.trim(), hashPassword(password), role.trim(), crea_registro.trim(), now);

    const user = db.prepare('SELECT id, name, email, role, crea_registro, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- SUPPLIERS CRUD ---
app.post('/api/suppliers', (req: Request, res: Response) => {
  try {
    const { code, name, cnpj, contact_person, phone, email, address, lead_time_days } = req.body;
    if (!code || !name || !cnpj || !contact_person) {
      return res.status(400).json({ error: 'Código, Razão Social, CNPJ e Contato são obrigatórios.' });
    }
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO suppliers (code, name, cnpj, contact_person, phone, email, address, lead_time_days, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code.trim().toUpperCase(),
      name.trim(),
      cnpj.trim(),
      contact_person.trim(),
      (phone || '').trim(),
      (email || '').trim(),
      (address || '').trim(),
      Number(lead_time_days) || 5,
      now
    );
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Código de fornecedor já existe.' : error.message });
  }
});

app.put('/api/suppliers/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { code, name, cnpj, contact_person, phone, email, address, lead_time_days } = req.body;
    db.prepare(`
      UPDATE suppliers
      SET code = ?, name = ?, cnpj = ?, contact_person = ?, phone = ?, email = ?, address = ?, lead_time_days = ?
      WHERE id = ?
    `).run(
      code.trim().toUpperCase(),
      name.trim(),
      cnpj.trim(),
      contact_person.trim(),
      (phone || '').trim(),
      (email || '').trim(),
      (address || '').trim(),
      Number(lead_time_days) || 5,
      id
    );
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/suppliers/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: 'Não é possível excluir fornecedor com vínculos ativos.' });
  }
});

// --- RAW MATERIALS CRUD & STOCK ---
app.post('/api/raw-materials', (req: Request, res: Response) => {
  try {
    const { code, name, unit, current_stock, min_stock, unit_cost, supplier_id, responsible_user } = req.body;
    if (!code || !name || !unit) {
      return res.status(400).json({ error: 'Código, Descrição e Unidade de Medida são obrigatórios.' });
    }
    const now = new Date().toISOString();
    const stockVal = Number(current_stock) || 0;
    const result = db.prepare(`
      INSERT INTO raw_materials (code, name, unit, current_stock, min_stock, unit_cost, supplier_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code.trim().toUpperCase(),
      name.trim(),
      unit.trim(),
      stockVal,
      Number(min_stock) || 0,
      Number(unit_cost) || 0,
      supplier_id ? Number(supplier_id) : null,
      now
    );

    if (stockVal > 0) {
      db.prepare(`
        INSERT INTO stock_movements (raw_material_id, movement_type, quantity, reference, responsible_user, created_at)
        VALUES (?, 'ENTRADA', ?, 'Saldo Inicial de Cadastro', ?, ?)
      `).run(result.lastInsertRowid, stockVal, responsible_user || 'Sistema', now);
    }

    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Código de matéria-prima já cadastrado.' : error.message });
  }
});

app.put('/api/raw-materials/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { code, name, unit, current_stock, min_stock, unit_cost, supplier_id } = req.body;
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE raw_materials
      SET code = ?, name = ?, unit = ?, current_stock = ?, min_stock = ?, unit_cost = ?, supplier_id = ?, updated_at = ?
      WHERE id = ?
    `).run(
      code.trim().toUpperCase(),
      name.trim(),
      unit.trim(),
      Number(current_stock) || 0,
      Number(min_stock) || 0,
      Number(unit_cost) || 0,
      supplier_id ? Number(supplier_id) : null,
      now,
      id
    );
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/raw-materials/:id/movement', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { movement_type, quantity, reference, responsible_user } = req.body;
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      return res.status(400).json({ error: 'Informe uma quantidade válida maior que zero.' });
    }
    const rm = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(id) as any;
    if (!rm) return res.status(404).json({ error: 'Matéria-prima não encontrada.' });

    const delta = movement_type === 'SAIDA_OP' || movement_type === 'SAIDA' ? -qty : qty;
    const newStock = Number((rm.current_stock + delta).toFixed(4));
    if (newStock < 0) {
      return res.status(400).json({ error: `Estoque insuficiente de ${rm.name}. Saldo atual: ${rm.current_stock} ${rm.unit}.` });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE raw_materials SET current_stock = ?, updated_at = ? WHERE id = ?').run(newStock, now, id);
    db.prepare(`
      INSERT INTO stock_movements (raw_material_id, movement_type, quantity, reference, responsible_user, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, movement_type, qty, reference || 'Ajuste Manual', responsible_user || 'Responsável Técnico', now);

    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/raw-materials/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM raw_materials WHERE id = ?').run(id);
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: 'Não é possível excluir matéria-prima vinculada a uma Ficha Técnica de Produto.' });
  }
});

// --- PRODUCTS & TECHNICAL SHEETS (FICHA TÉCNICA) CRUD ---
app.post('/api/products', (req: Request, res: Response) => {
  try {
    const { code, name, category, description, process_time_minutes, setup_time_minutes, unit_price, technical_notes, bom } = req.body;
    if (!code || !name || !process_time_minutes || Number(process_time_minutes) <= 0) {
      return res.status(400).json({ error: 'Código, Nome do Produto e Tempo de Processo (> 0 min) são obrigatórios.' });
    }
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      const result = db.prepare(`
        INSERT INTO products (code, name, category, description, process_time_minutes, setup_time_minutes, unit_price, technical_notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        code.trim().toUpperCase(),
        name.trim(),
        (category || 'Geral').trim(),
        (description || '').trim(),
        Number(process_time_minutes),
        Number(setup_time_minutes) || 0,
        Number(unit_price) || 0,
        (technical_notes || '').trim(),
        now
      );

      const productId = result.lastInsertRowid;
      if (Array.isArray(bom)) {
        const insertBom = db.prepare(`
          INSERT INTO product_bom (product_id, raw_material_id, quantity_required, stage_notes)
          VALUES (?, ?, ?, ?)
        `);
        for (const item of bom) {
          if (item.raw_material_id && Number(item.quantity_required) > 0) {
            insertBom.run(productId, Number(item.raw_material_id), Number(item.quantity_required), (item.stage_notes || '').trim());
          }
        }
      }
      db.exec('COMMIT');
    } catch (innerErr) {
      db.exec('ROLLBACK');
      throw innerErr;
    }

    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Código de produto já existe.' : error.message });
  }
});

app.put('/api/products/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { code, name, category, description, process_time_minutes, setup_time_minutes, unit_price, technical_notes, bom } = req.body;
    if (!code || !name || !process_time_minutes || Number(process_time_minutes) <= 0) {
      return res.status(400).json({ error: 'Código, Nome e Tempo de Processo são obrigatórios.' });
    }
    db.exec('BEGIN');
    try {
      db.prepare(`
        UPDATE products
        SET code = ?, name = ?, category = ?, description = ?, process_time_minutes = ?, setup_time_minutes = ?, unit_price = ?, technical_notes = ?
        WHERE id = ?
      `).run(
        code.trim().toUpperCase(),
        name.trim(),
        (category || 'Geral').trim(),
        (description || '').trim(),
        Number(process_time_minutes),
        Number(setup_time_minutes) || 0,
        Number(unit_price) || 0,
        (technical_notes || '').trim(),
        id
      );

      db.prepare('DELETE FROM product_bom WHERE product_id = ?').run(id);
      if (Array.isArray(bom)) {
        const insertBom = db.prepare(`
          INSERT INTO product_bom (product_id, raw_material_id, quantity_required, stage_notes)
          VALUES (?, ?, ?, ?)
        `);
        for (const item of bom) {
          if (item.raw_material_id && Number(item.quantity_required) > 0) {
            insertBom.run(id, Number(item.raw_material_id), Number(item.quantity_required), (item.stage_notes || '').trim());
          }
        }
      }
      db.exec('COMMIT');
    } catch (innerErr) {
      db.exec('ROLLBACK');
      throw innerErr;
    }

    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/products/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: 'Não é possível excluir produto vinculado a pedidos ou ordens de produção.' });
  }
});

// --- CUSTOMERS CRUD ---
app.post('/api/customers', (req: Request, res: Response) => {
  try {
    const { code, name, document, contact_person, phone, email, city_state, address } = req.body;
    if (!code || !name || !document || !contact_person) {
      return res.status(400).json({ error: 'Código, Nome/Razão Social, CNPJ/CPF e Contato são obrigatórios.' });
    }
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO customers (code, name, document, contact_person, phone, email, city_state, address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code.trim().toUpperCase(),
      name.trim(),
      document.trim(),
      contact_person.trim(),
      (phone || '').trim(),
      (email || '').trim(),
      (city_state || '').trim(),
      (address || '').trim(),
      now
    );
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Código de cliente já existe.' : error.message });
  }
});

app.put('/api/customers/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { code, name, document, contact_person, phone, email, city_state, address } = req.body;
    db.prepare(`
      UPDATE customers
      SET code = ?, name = ?, document = ?, contact_person = ?, phone = ?, email = ?, city_state = ?, address = ?
      WHERE id = ?
    `).run(
      code.trim().toUpperCase(),
      name.trim(),
      document.trim(),
      contact_person.trim(),
      (phone || '').trim(),
      (email || '').trim(),
      (city_state || '').trim(),
      (address || '').trim(),
      id
    );
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/customers/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: 'Não é possível excluir cliente que possui pedidos registrados.' });
  }
});

// --- CAPACITIES CRUD ---
app.post('/api/capacities', (req: Request, res: Response) => {
  try {
    const { period_code, period_label, work_center, shifts_per_day, hours_per_shift, working_days, operators_count, efficiency_factor, notes } = req.body;
    if (!period_code || !period_label || !work_center) {
      return res.status(400).json({ error: 'Código do Período, Descrição e Centro de Trabalho são obrigatórios.' });
    }
    const shifts = Number(shifts_per_day) || 1;
    const hours = Number(hours_per_shift) || 8;
    const days = Number(working_days) || 22;
    const ops = Number(operators_count) || 1;
    const eff = Number(efficiency_factor) || 0.85;
    const availableMinutes = Math.round(shifts * hours * days * ops * 60 * eff);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO capacities (period_code, period_label, work_center, shifts_per_day, hours_per_shift, working_days, operators_count, efficiency_factor, available_minutes, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      period_code.trim().toUpperCase(),
      period_label.trim(),
      work_center.trim(),
      shifts,
      hours,
      days,
      ops,
      eff,
      availableMinutes,
      (notes || '').trim(),
      now
    );
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Código de período já cadastrado.' : error.message });
  }
});

app.put('/api/capacities/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { period_code, period_label, work_center, shifts_per_day, hours_per_shift, working_days, operators_count, efficiency_factor, notes } = req.body;
    const shifts = Number(shifts_per_day) || 1;
    const hours = Number(hours_per_shift) || 8;
    const days = Number(working_days) || 22;
    const ops = Number(operators_count) || 1;
    const eff = Number(efficiency_factor) || 0.85;
    const availableMinutes = Math.round(shifts * hours * days * ops * 60 * eff);

    db.prepare(`
      UPDATE capacities
      SET period_code = ?, period_label = ?, work_center = ?, shifts_per_day = ?, hours_per_shift = ?, working_days = ?, operators_count = ?, efficiency_factor = ?, available_minutes = ?, notes = ?
      WHERE id = ?
    `).run(
      period_code.trim().toUpperCase(),
      period_label.trim(),
      work_center.trim(),
      shifts,
      hours,
      days,
      ops,
      eff,
      availableMinutes,
      (notes || '').trim(),
      id
    );
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/capacities/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM capacities WHERE id = ?').run(id);
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: 'Não foi possível excluir o período de capacidade.' });
  }
});

// --- ORDERS (PEDIDOS DE CLIENTES) ---
app.post('/api/orders', (req: Request, res: Response) => {
  try {
    const { order_number, customer_id, order_date, delivery_date, priority, notes, created_by, items, auto_generate_ops, capacity_period_id, technical_crea } = req.body;
    if (!order_number || !customer_id || !delivery_date || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Número do pedido, cliente, data de entrega e pelo menos 1 item são obrigatórios.' });
    }
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      const initialStatus = auto_generate_ops ? 'EM_PRODUCAO' : 'ABERTO';
      const result = db.prepare(`
        INSERT INTO orders (order_number, customer_id, order_date, delivery_date, priority, status, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order_number.trim().toUpperCase(),
        Number(customer_id),
        order_date || now.slice(0, 10),
        delivery_date,
        priority || 'NORMAL',
        initialStatus,
        (notes || '').trim(),
        created_by || 'Responsável Técnico',
        now
      );

      const orderId = Number(result.lastInsertRowid);
      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
        VALUES (?, ?, ?, ?)
      `);

      for (const item of items) {
        if (!item.product_id || Number(item.quantity) <= 0) continue;
        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(item.product_id)) as any;
        const price = item.unit_price !== undefined ? Number(item.unit_price) : (prod?.unit_price || 0);
        insertItem.run(orderId, Number(item.product_id), Number(item.quantity), price);

        if (auto_generate_ops && prod) {
          const opNumber = getNextOpNumber();
          const nextSeqCode = opNumber.replace('OP-2026-', '');
          const qty = Number(item.quantity);
          const plannedTotal = qty * prod.process_time_minutes + prod.setup_time_minutes;
          const batchCode = `LT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${nextSeqCode}`;

          db.prepare(`
            INSERT INTO production_orders (
              op_number, order_id, product_id, capacity_period_id, quantity,
              unit_process_time_minutes, setup_time_minutes, planned_total_minutes, actual_total_minutes,
              status, current_stage, priority, start_date, due_date, started_at, completed_at,
              technical_responsible, technical_crea, completion_notes, batch_code, materials_deducted, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'PLANEJADA', 'Aguardando Liberação na Fábrica', ?, ?, ?, NULL, NULL, ?, ?, '', ?, 0, ?)
          `).run(
            opNumber,
            orderId,
            prod.id,
            capacity_period_id ? Number(capacity_period_id) : 1,
            qty,
            prod.process_time_minutes,
            prod.setup_time_minutes,
            plannedTotal,
            priority || 'NORMAL',
            order_date || now.slice(0, 10),
            delivery_date,
            created_by || 'Responsável Técnico',
            technical_crea || 'CREA Ativo',
            batchCode,
            now
          );
        }
      }
      db.exec('COMMIT');
    } catch (innerErr) {
      db.exec('ROLLBACK');
      throw innerErr;
    }

    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message.includes('UNIQUE') ? 'Número de pedido já existe.' : error.message });
  }
});

// Generate Production Orders from an existing Order
app.post('/api/orders/:id/generate-ops', (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    const { capacity_period_id, technical_responsible, technical_crea } = req.body;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
    if (items.length === 0) return res.status(400).json({ error: 'O pedido não possui itens cadastrados.' });

    const existingOps = db.prepare('SELECT COUNT(*) as cnt FROM production_orders WHERE order_id = ? AND status != ?').get(orderId, 'CANCELADA') as { cnt: number };
    if (existingOps.cnt > 0) {
      return res.status(400).json({ error: 'As Ordens de Produção para este pedido já foram emitidas.' });
    }

    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      for (const item of items) {
        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id) as any;
        if (!prod) continue;

        const opNumber = getNextOpNumber();
        const nextSeqCode = opNumber.replace('OP-2026-', '');
        const qty = Number(item.quantity);
        const plannedTotal = qty * prod.process_time_minutes + prod.setup_time_minutes;
        const batchCode = `LT-${now.slice(2, 10).replace(/-/g, '')}-${nextSeqCode}`;

        db.prepare(`
          INSERT INTO production_orders (
            op_number, order_id, product_id, capacity_period_id, quantity,
            unit_process_time_minutes, setup_time_minutes, planned_total_minutes, actual_total_minutes,
            status, current_stage, priority, start_date, due_date, started_at, completed_at,
            technical_responsible, technical_crea, completion_notes, batch_code, materials_deducted, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'PLANEJADA', 'Aguardando Início de Processo', ?, ?, ?, NULL, NULL, ?, ?, '', ?, 0, ?)
        `).run(
          opNumber,
          orderId,
          prod.id,
          capacity_period_id ? Number(capacity_period_id) : 1,
          qty,
          prod.process_time_minutes,
          prod.setup_time_minutes,
          plannedTotal,
          order.priority,
          now.slice(0, 10),
          order.delivery_date,
          technical_responsible || order.created_by,
          technical_crea || 'CREA-SP 5069182340',
          batchCode,
          now
        );
      }

      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('EM_PRODUCAO', orderId);
      db.exec('COMMIT');
    } catch (innerErr) {
      db.exec('ROLLBACK');
      throw innerErr;
    }

    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/orders/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM production_orders WHERE order_id = ?').run(id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- PRODUCTION ORDERS (ORDENS DE PRODUÇÃO - EMISSÃO AVULSA, TRACKING E BAIXA) ---
app.post('/api/production-orders', (req: Request, res: Response) => {
  try {
    const { order_id, product_id, capacity_period_id, quantity, priority, start_date, due_date, technical_responsible, technical_crea, current_stage } = req.body;
    if (!product_id || !quantity || Number(quantity) <= 0 || !due_date) {
      return res.status(400).json({ error: 'Produto, Quantidade (> 0) e Prazo de Conclusão são obrigatórios.' });
    }

    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(product_id)) as any;
    if (!prod) return res.status(404).json({ error: 'Ficha técnica do produto não encontrada.' });

    const opNumber = getNextOpNumber();
    const nextSeqCode = opNumber.replace('OP-2026-', '');
    const qty = Number(quantity);
    // Automatic recording of process time based on Product Technical Sheet
    const plannedTotal = qty * prod.process_time_minutes + prod.setup_time_minutes;
    const now = new Date().toISOString();
    const batchCode = `LT-${now.slice(2, 10).replace(/-/g, '')}-${nextSeqCode}`;

    db.prepare(`
      INSERT INTO production_orders (
        op_number, order_id, product_id, capacity_period_id, quantity,
        unit_process_time_minutes, setup_time_minutes, planned_total_minutes, actual_total_minutes,
        status, current_stage, priority, start_date, due_date, started_at, completed_at,
        technical_responsible, technical_crea, completion_notes, batch_code, materials_deducted, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'PLANEJADA', ?, ?, ?, ?, NULL, NULL, ?, ?, '', ?, 0, ?)
    `).run(
      opNumber,
      order_id ? Number(order_id) : null,
      prod.id,
      capacity_period_id ? Number(capacity_period_id) : 1,
      qty,
      prod.process_time_minutes,
      prod.setup_time_minutes,
      plannedTotal,
      current_stage || 'Aguardando Liberação de Materiais',
      priority || 'NORMAL',
      start_date || now.slice(0, 10),
      due_date,
      technical_responsible || 'Eng. Carlos Eduardo Mendes',
      technical_crea || 'CREA-SP 5069182340',
      batchCode,
      now
    );

    if (order_id) {
      db.prepare('UPDATE orders SET status = ? WHERE id = ? AND status = ?').run('EM_PRODUCAO', Number(order_id), 'ABERTO');
    }

    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update Production Order Status / Real-Time Tracking / Baixa (Completion)
app.patch('/api/production-orders/:id/status', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status, current_stage, actual_total_minutes, completion_notes, deduct_materials, technical_responsible, technical_crea } = req.body;

    const po = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(id) as any;
    if (!po) return res.status(404).json({ error: 'Ordem de Produção não encontrada.' });

    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      let startedAt = po.started_at;
      let completedAt = po.completed_at;
      let actualMinutes = po.actual_total_minutes;
      let materialsDeducted = po.materials_deducted;

      if (status === 'EM_PROCESSO' && !startedAt) {
        startedAt = now;
      }

      if (status === 'CONCLUIDA') {
        if (!startedAt) startedAt = now;
        completedAt = now;
        actualMinutes = actual_total_minutes !== undefined && Number(actual_total_minutes) > 0
          ? Number(actual_total_minutes)
          : po.planned_total_minutes;

        // Deduct raw materials according to BOM if requested and not yet deducted
        if (deduct_materials !== false && materialsDeducted === 0) {
          const bomItems = db.prepare('SELECT * FROM product_bom WHERE product_id = ?').all(po.product_id) as any[];
          for (const item of bomItems) {
            const totalReq = Number((item.quantity_required * po.quantity).toFixed(4));
            const rm = db.prepare('SELECT * FROM raw_materials WHERE id = ?').get(item.raw_material_id) as any;
            if (rm) {
              const updatedStock = Math.max(0, Number((rm.current_stock - totalReq).toFixed(4)));
              db.prepare('UPDATE raw_materials SET current_stock = ?, updated_at = ? WHERE id = ?').run(updatedStock, now, rm.id);
              db.prepare(`
                INSERT INTO stock_movements (raw_material_id, movement_type, quantity, reference, responsible_user, created_at)
                VALUES (?, 'SAIDA_OP', ?, ?, ?, ?)
              `).run(
                rm.id,
                totalReq,
                `Baixa Automática ${po.op_number} (${po.quantity} un)`,
                technical_responsible || po.technical_responsible,
                now
              );
            }
          }
          materialsDeducted = 1;
        }
      }

      db.prepare(`
        UPDATE production_orders
        SET status = ?,
            current_stage = ?,
            started_at = ?,
            completed_at = ?,
            actual_total_minutes = ?,
            completion_notes = ?,
            materials_deducted = ?,
            technical_responsible = ?,
            technical_crea = ?
        WHERE id = ?
      `).run(
        status || po.status,
        current_stage !== undefined ? current_stage : po.current_stage,
        startedAt,
        completedAt,
        actualMinutes,
        completion_notes !== undefined ? completion_notes : po.completion_notes,
        materialsDeducted,
        technical_responsible || po.technical_responsible,
        technical_crea || po.technical_crea,
        id
      );

      // If linked to an order, check if all OPs for that order are CONCLUIDA
      if (po.order_id) {
        const orderOps = db.prepare('SELECT status FROM production_orders WHERE order_id = ? AND status != ?').all(po.order_id, 'CANCELADA') as { status: string }[];
        if (orderOps.length > 0 && orderOps.every((o) => o.status === 'CONCLUIDA')) {
          db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('CONCLUIDO', po.order_id);
        } else if (orderOps.some((o) => o.status === 'EM_PROCESSO' || o.status === 'CONCLUIDA')) {
          db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('EM_PRODUCAO', po.order_id);
        }
      }

      db.exec('COMMIT');
    } catch (innerErr) {
      db.exec('ROLLBACK');
      throw innerErr;
    }

    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/production-orders/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM production_orders WHERE id = ?').run(id);
    res.json(getFullErpState());
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Forja Industrial ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
