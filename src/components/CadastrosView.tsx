import React, { useState } from 'react';
import { Plus, Trash2, Edit2, ArrowUpCircle, ArrowDownCircle, Search } from 'lucide-react';
import { ErpState, User, Product, RawMaterial, Customer, Supplier, Capacity, ProductBomItem } from '../types';

interface CadastrosViewProps {
  state: ErpState;
  currentUser: User;
  activeSubTab: 'fichas' | 'materias' | 'clientes' | 'fornecedores' | 'capacidade';
  setActiveSubTab: (tab: 'fichas' | 'materias' | 'clientes' | 'fornecedores' | 'capacidade') => void;
  onRefreshState: (newState: ErpState) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

export const CadastrosView: React.FC<CadastrosViewProps> = ({
  state,
  currentUser,
  activeSubTab,
  setActiveSubTab,
  onRefreshState,
  notify,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // --- 1. Ficha Técnica (Products) State ---
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [prodForm, setProdForm] = useState({
    code: '',
    name: '',
    category: 'Transmissão Mecânica',
    description: '',
    process_time_minutes: 60,
    setup_time_minutes: 15,
    unit_price: 1200,
    technical_notes: '',
  });
  const [bomItems, setBomItems] = useState<ProductBomItem[]>([
    { raw_material_id: state.rawMaterials[0]?.id || 1, quantity_required: 1, stage_notes: 'Usinagem Principal' },
  ]);

  // --- 2. Matéria Prima State ---
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null);
  const [matForm, setMatForm] = useState({
    code: '',
    name: '',
    unit: 'kg',
    current_stock: 0,
    min_stock: 20,
    unit_cost: 0,
    supplier_id: state.suppliers[0]?.id || '',
  });
  const [stockModalMat, setStockModalMat] = useState<RawMaterial | null>(null);
  const [stockMoveForm, setStockMoveForm] = useState({
    movement_type: 'ENTRADA',
    quantity: 50,
    reference: 'NF-e Entrada de Fornecedor',
  });

  // --- 3. Clientes State ---
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [custForm, setCustForm] = useState({
    code: '',
    name: '',
    document: '',
    contact_person: '',
    phone: '',
    email: '',
    city_state: '',
    address: '',
  });

  // --- 4. Fornecedores State ---
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [supForm, setSupForm] = useState({
    code: '',
    name: '',
    cnpj: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    lead_time_days: 5,
  });

  // --- 5. Capacidade Produtiva State ---
  const [editingCapacityId, setEditingCapacityId] = useState<number | null>(null);
  const [capForm, setCapForm] = useState({
    period_code: '',
    period_label: '',
    work_center: 'Usinagem CNC & Montagem Pesada',
    shifts_per_day: 1,
    hours_per_shift: 8,
    working_days: 22,
    operators_count: 3,
    efficiency_factor: 0.85,
    notes: '',
  });

  // API Helper
  const apiCall = async (url: string, method: string, body?: any) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na operação');
    return data as ErpState;
  };

  // Helper to generate next unique code with prefix
  const getNextAvailableCode = (prefix: string, existingCodes: string[], startPad = 3, startNum = 1) => {
    let maxNum = 0;
    const regex = new RegExp(`^${prefix}-(\\d+)$`);
    for (const c of existingCodes) {
      const m = c.match(regex);
      if (m && m[1]) {
        const val = parseInt(m[1], 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    }
    const nextVal = Math.max(maxNum + 1, startNum);
    return `${prefix}-${String(nextVal).padStart(startPad, '0')}`;
  };

  // --- Handlers: Ficha Técnica ---
  const resetProdForm = () => {
    setEditingProductId(null);
    const nextCode = getNextAvailableCode('PRD', state.products.map((p) => p.code), 3, state.products.length + 1);
    setProdForm({
      code: nextCode,
      name: '',
      category: 'Transmissão Mecânica',
      description: '',
      process_time_minutes: 60,
      setup_time_minutes: 15,
      unit_price: 950,
      technical_notes: '',
    });
    setBomItems([
      { raw_material_id: state.rawMaterials[0]?.id || 1, quantity_required: 1, stage_notes: '' },
    ]);
  };

  const handleEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setProdForm({
      code: p.code,
      name: p.name,
      category: p.category,
      description: p.description,
      process_time_minutes: p.process_time_minutes,
      setup_time_minutes: p.setup_time_minutes,
      unit_price: p.unit_price,
      technical_notes: p.technical_notes,
    });
    setBomItems(
      p.bom.length > 0
        ? p.bom.map((b) => ({
            raw_material_id: b.raw_material_id,
            quantity_required: b.quantity_required,
            stage_notes: b.stage_notes,
          }))
        : [{ raw_material_id: state.rawMaterials[0]?.id || 1, quantity_required: 1, stage_notes: '' }]
    );
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...prodForm, bom: bomItems };
      const newState = editingProductId
        ? await apiCall(`/api/products/${editingProductId}`, 'PUT', payload)
        : await apiCall('/api/products', 'POST', payload);
      onRefreshState(newState);
      notify(editingProductId ? 'Ficha Técnica atualizada com sucesso.' : 'Nova Ficha Técnica cadastrada.');
      resetProdForm();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    try {
      const newState = await apiCall(`/api/products/${id}`, 'DELETE');
      onRefreshState(newState);
      notify('Ficha Técnica removida.');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // --- Handlers: Matéria Prima ---
  const resetMatForm = () => {
    setEditingMaterialId(null);
    setMatForm({
      code: getNextAvailableCode('MP', state.rawMaterials.map((m) => m.code), 3, 101),
      name: '',
      unit: 'kg',
      current_stock: 0,
      min_stock: 20,
      unit_cost: 0,
      supplier_id: state.suppliers[0]?.id || '',
    });
  };

  const handleEditMaterial = (m: RawMaterial) => {
    setEditingMaterialId(m.id);
    setMatForm({
      code: m.code,
      name: m.name,
      unit: m.unit,
      current_stock: m.current_stock,
      min_stock: m.min_stock,
      unit_cost: m.unit_cost,
      supplier_id: m.supplier_id || '',
    });
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...matForm, responsible_user: currentUser.name };
      const newState = editingMaterialId
        ? await apiCall(`/api/raw-materials/${editingMaterialId}`, 'PUT', payload)
        : await apiCall('/api/raw-materials', 'POST', payload);
      onRefreshState(newState);
      notify(editingMaterialId ? 'Matéria-prima atualizada.' : 'Matéria-prima cadastrada com sucesso.');
      resetMatForm();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalMat) return;
    try {
      const newState = await apiCall(`/api/raw-materials/${stockModalMat.id}/movement`, 'POST', {
        ...stockMoveForm,
        responsible_user: currentUser.name,
      });
      onRefreshState(newState);
      notify(`Movimentação de estoque registrada para ${stockModalMat.code}.`);
      setStockModalMat(null);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteMaterial = async (id: number) => {
    try {
      const newState = await apiCall(`/api/raw-materials/${id}`, 'DELETE');
      onRefreshState(newState);
      notify('Matéria-prima excluída.');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // --- Handlers: Clientes ---
  const resetCustForm = () => {
    setEditingCustomerId(null);
    setCustForm({
      code: getNextAvailableCode('CLI', state.customers.map((c) => c.code), 3, state.customers.length + 1),
      name: '',
      document: '',
      contact_person: '',
      phone: '',
      email: '',
      city_state: '',
      address: '',
    });
  };

  const handleEditCustomer = (c: Customer) => {
    setEditingCustomerId(c.id);
    setCustForm({
      code: c.code,
      name: c.name,
      document: c.document,
      contact_person: c.contact_person,
      phone: c.phone,
      email: c.email,
      city_state: c.city_state,
      address: c.address,
    });
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newState = editingCustomerId
        ? await apiCall(`/api/customers/${editingCustomerId}`, 'PUT', custForm)
        : await apiCall('/api/customers', 'POST', custForm);
      onRefreshState(newState);
      notify(editingCustomerId ? 'Dados do cliente atualizados.' : 'Cliente cadastrado com sucesso.');
      resetCustForm();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    try {
      const newState = await apiCall(`/api/customers/${id}`, 'DELETE');
      onRefreshState(newState);
      notify('Cliente removido.');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // --- Handlers: Fornecedores ---
  const resetSupForm = () => {
    setEditingSupplierId(null);
    setSupForm({
      code: getNextAvailableCode('FOR', state.suppliers.map((s) => s.code), 3, state.suppliers.length + 1),
      name: '',
      cnpj: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      lead_time_days: 5,
    });
  };

  const handleEditSupplier = (s: Supplier) => {
    setEditingSupplierId(s.id);
    setSupForm({
      code: s.code,
      name: s.name,
      cnpj: s.cnpj,
      contact_person: s.contact_person,
      phone: s.phone,
      email: s.email,
      address: s.address,
      lead_time_days: s.lead_time_days,
    });
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newState = editingSupplierId
        ? await apiCall(`/api/suppliers/${editingSupplierId}`, 'PUT', supForm)
        : await apiCall('/api/suppliers', 'POST', supForm);
      onRefreshState(newState);
      notify(editingSupplierId ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado com sucesso.');
      resetSupForm();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    try {
      const newState = await apiCall(`/api/suppliers/${id}`, 'DELETE');
      onRefreshState(newState);
      notify('Fornecedor excluído.');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // --- Handlers: Capacidade Produtiva ---
  const resetCapForm = () => {
    setEditingCapacityId(null);
    let nextMonth = 10 + state.capacities.length;
    let codeCandidate = `CAP-2026-${nextMonth}`;
    const existing = new Set(state.capacities.map((c) => c.period_code));
    while (existing.has(codeCandidate)) {
      nextMonth++;
      codeCandidate = `CAP-2026-${nextMonth}`;
    }
    setCapForm({
      period_code: codeCandidate,
      period_label: '',
      work_center: 'Usinagem CNC & Montagem Pesada',
      shifts_per_day: 1,
      hours_per_shift: 8,
      working_days: 22,
      operators_count: 3,
      efficiency_factor: 0.85,
      notes: '',
    });
  };

  const handleEditCapacity = (c: Capacity) => {
    setEditingCapacityId(c.id);
    setCapForm({
      period_code: c.period_code,
      period_label: c.period_label,
      work_center: c.work_center,
      shifts_per_day: c.shifts_per_day,
      hours_per_shift: c.hours_per_shift,
      working_days: c.working_days,
      operators_count: c.operators_count,
      efficiency_factor: c.efficiency_factor,
      notes: c.notes,
    });
  };

  const handleSaveCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newState = editingCapacityId
        ? await apiCall(`/api/capacities/${editingCapacityId}`, 'PUT', capForm)
        : await apiCall('/api/capacities', 'POST', capForm);
      onRefreshState(newState);
      notify(editingCapacityId ? 'Capacidade produtiva atualizada.' : 'Novo período de capacidade registrado.');
      resetCapForm();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteCapacity = async (id: number) => {
    try {
      const newState = await apiCall(`/api/capacities/${id}`, 'DELETE');
      onRefreshState(newState);
      notify('Período de capacidade removido.');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const previewAvailableMinutes = Math.round(
    (Number(capForm.shifts_per_day) || 1) *
      (Number(capForm.hours_per_shift) || 8) *
      (Number(capForm.working_days) || 22) *
      (Number(capForm.operators_count) || 1) *
      60 *
      (Number(capForm.efficiency_factor) || 0.85)
  );

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar & search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            onClick={() => setActiveSubTab('fichas')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'fichas' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            01. Fichas Técnicas ({state.products.length})
          </button>
          <button
            onClick={() => setActiveSubTab('materias')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'materias' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            02. Matéria-Prima & Estoque ({state.rawMaterials.length})
          </button>
          <button
            onClick={() => setActiveSubTab('clientes')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'clientes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            03. Clientes ({state.customers.length})
          </button>
          <button
            onClick={() => setActiveSubTab('fornecedores')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'fornecedores' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            04. Fornecedores ({state.suppliers.length})
          </button>
          <button
            onClick={() => setActiveSubTab('capacidade')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'capacidade' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            05. Capacidade Produtiva ({state.capacities.length})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar registros na tabela..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
          />
        </div>
      </div>

      {/* 1. FICHA TÉCNICA DO PRODUTO */}
      {activeSubTab === 'fichas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Column */}
          <form onSubmit={handleSaveProduct} className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingProductId ? 'Editar Ficha Técnica do Produto' : 'Nova Ficha Técnica de Produto'}
                </h2>
                <p className="text-xs text-slate-500">Defina tempos de processo, setup e composição (BOM)</p>
              </div>
              {editingProductId && (
                <button
                  type="button"
                  onClick={resetProdForm}
                  className="text-xs text-slate-500 hover:text-slate-900 underline cursor-pointer"
                >
                  Cancelar Edição
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Código *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: PRD-005"
                  value={prodForm.code}
                  onChange={(e) => setProdForm({ ...prodForm, code: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Linha / Categoria *</label>
                <input
                  type="text"
                  required
                  value={prodForm.category}
                  onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Técnico do Produto *</label>
              <input
                type="text"
                required
                placeholder="Ex: Polia Sincronizadora Usinada PS-90"
                value={prodForm.name}
                onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Tempo Processo (min/un) *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={prodForm.process_time_minutes}
                  onChange={(e) => setProdForm({ ...prodForm, process_time_minutes: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">Setup Máquina (min)</label>
                <input
                  type="number"
                  min={0}
                  value={prodForm.setup_time_minutes}
                  onChange={(e) => setProdForm({ ...prodForm, setup_time_minutes: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">Preço Venda (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={prodForm.unit_price}
                  onChange={(e) => setProdForm({ ...prodForm, unit_price: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Especificação & Roteiro de Inspeção</label>
              <textarea
                rows={2}
                placeholder="Tolerâncias de usinagem, acabamento superficial e testes obrigatórios..."
                value={prodForm.technical_notes}
                onChange={(e) => setProdForm({ ...prodForm, technical_notes: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
              />
            </div>

            {/* Multi-entry BOM */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-900">
                  Composição de Matérias-Primas (Múltiplas Entradas)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setBomItems([
                      ...bomItems,
                      { raw_material_id: state.rawMaterials[0]?.id || 1, quantity_required: 1, stage_notes: '' },
                    ])
                  }
                  className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Insumo
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {bomItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded border border-slate-200">
                    <div className="col-span-6">
                      <select
                        value={item.raw_material_id}
                        onChange={(e) => {
                          const updated = [...bomItems];
                          updated[idx].raw_material_id = Number(e.target.value);
                          setBomItems(updated);
                        }}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded"
                      >
                        {state.rawMaterials.map((rm) => (
                          <option key={rm.id} value={rm.id}>
                            {rm.code} - {rm.name} ({rm.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Qtd"
                        value={item.quantity_required}
                        onChange={(e) => {
                          const updated = [...bomItems];
                          updated[idx].quantity_required = Number(e.target.value);
                          setBomItems(updated);
                        }}
                        className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Etapa/Uso"
                        value={item.stage_notes}
                        onChange={(e) => {
                          const updated = [...bomItems];
                          updated[idx].stage_notes = e.target.value;
                          setBomItems(updated);
                        }}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setBomItems(bomItems.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Remover insumo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
            >
              {editingProductId ? 'Salvar Alterações na Ficha Técnica' : 'Cadastrar Ficha Técnica Completa'}
            </button>
          </form>

          {/* List Column */}
          <div className="lg:col-span-7 space-y-4">
            {state.products
              .filter(
                (p) =>
                  p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  p.code.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((product) => (
                <div key={product.id} className="bg-white border border-slate-200 rounded-lg p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="text-xs text-slate-500">
                        <span className="font-mono font-semibold text-slate-900">{product.code}</span>
                        <span className="mx-2">·</span>
                        <span>{product.category}</span>
                        <span className="mx-2">·</span>
                        <span className="font-mono text-slate-800 font-semibold">
                          Tempo Processo: {product.process_time_minutes} min/un
                        </span>
                        <span className="mx-2">·</span>
                        <span className="font-mono">Setup: {product.setup_time_minutes} min</span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 mt-1">{product.name}</h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Editar
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 border border-transparent hover:border-red-200 rounded cursor-pointer"
                        title="Excluir Ficha Técnica"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {product.technical_notes && (
                    <p className="text-xs text-slate-600 mt-2.5 bg-slate-50 px-3 py-2 rounded border-l-2 border-slate-400">
                      <strong className="text-slate-800">Norma / Inspeção:</strong> {product.technical_notes}
                    </p>
                  )}

                  {/* BOM Table */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                      <span>Estrutura de Matérias-Primas ({product.bom.length} itens)</span>
                      <span className="font-mono tabular-nums">
                        Custo MP: <strong className="text-slate-800">R$ {product.material_cost.toFixed(2)}</strong> · Preço Venda: <strong className="text-slate-900">R$ {product.unit_price.toFixed(2)}</strong>
                      </span>
                    </div>
                    <div className="overflow-x-auto border border-slate-200 rounded">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <th className="py-1.5 px-3 font-semibold">Código</th>
                            <th className="py-1.5 px-3 font-semibold">Matéria-Prima</th>
                            <th className="py-1.5 px-3 font-semibold">Aplicação</th>
                            <th className="py-1.5 px-3 text-right font-semibold">Qtd / Un</th>
                            <th className="py-1.5 px-3 text-right font-semibold">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                          {product.bom.map((b, i) => (
                            <tr key={i}>
                              <td className="py-1.5 px-3 text-slate-800">{b.material_code}</td>
                              <td className="py-1.5 px-3 font-sans text-slate-800">{b.material_name}</td>
                              <td className="py-1.5 px-3 font-sans text-slate-500">{b.stage_notes || '—'}</td>
                              <td className="py-1.5 px-3 text-right text-slate-900 font-semibold">
                                {b.quantity_required} {b.material_unit}
                              </td>
                              <td className="py-1.5 px-3 text-right text-slate-600">
                                R$ {((b.quantity_required || 0) * (b.unit_cost || 0)).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 2. MATÉRIA-PRIMA & ESTOQUE */}
      {activeSubTab === 'materias' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form onSubmit={handleSaveMaterial} className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingMaterialId ? 'Editar Matéria-Prima' : 'Cadastrar Matéria-Prima'}
                </h2>
                <p className="text-xs text-slate-500">Controle de saldo físico, estoque mínimo e custo</p>
              </div>
              {editingMaterialId && (
                <button type="button" onClick={resetMatForm} className="text-xs text-slate-500 underline cursor-pointer">
                  Cancelar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Código *</label>
                <input
                  type="text"
                  required
                  placeholder="MP-109"
                  value={matForm.code}
                  onChange={(e) => setMatForm({ ...matForm, code: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unidade *</label>
                <select
                  value={matForm.unit}
                  onChange={(e) => setMatForm({ ...matForm, unit: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="kg">Quilograma (kg)</option>
                  <option value="un">Unidade (un)</option>
                  <option value="m²">Metro Quadrado (m²)</option>
                  <option value="m">Metro Linear (m)</option>
                  <option value="cj">Conjunto (cj)</option>
                  <option value="L">Litro (L)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição Técnica do Insumo *</label>
              <input
                type="text"
                required
                placeholder="Ex: Barra Sextavada Latão ASTM B16"
                value={matForm.name}
                onChange={(e) => setMatForm({ ...matForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Saldo Atual</label>
                <input
                  type="number"
                  step="0.01"
                  value={matForm.current_stock}
                  onChange={(e) => setMatForm({ ...matForm, current_stock: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Estoque Mín.</label>
                <input
                  type="number"
                  step="0.01"
                  value={matForm.min_stock}
                  onChange={(e) => setMatForm({ ...matForm, min_stock: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Custo Unit. (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={matForm.unit_cost}
                  onChange={(e) => setMatForm({ ...matForm, unit_cost: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fornecedor Homologado</label>
              <select
                value={matForm.supplier_id}
                onChange={(e) => setMatForm({ ...matForm, supplier_id: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="">Selecione um fornecedor...</option>
                {state.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
            >
              {editingMaterialId ? 'Atualizar Matéria-Prima' : 'Registrar Matéria-Prima'}
            </button>
          </form>

          <div className="lg:col-span-8 space-y-6">
            {/* Stock Table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Posição de Estoque de Matérias-Primas</h3>
                <span className="text-xs text-slate-500">
                  Clique em <strong>Movimentar</strong> para registrar entradas de NF ou ajustes
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2.5 px-4 font-semibold">Código</th>
                      <th className="py-2.5 px-4 font-semibold">Insumo / Matéria-Prima</th>
                      <th className="py-2.5 px-4 font-semibold">Fornecedor</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Saldo Atual</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Mínimo</th>
                      <th className="py-2.5 px-4 font-semibold">Situação</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                    {state.rawMaterials
                      .filter(
                        (m) =>
                          m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.code.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((mat) => {
                        const isLow = mat.current_stock <= mat.min_stock;
                        return (
                          <tr key={mat.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-semibold text-slate-900">{mat.code}</td>
                            <td className="py-2.5 px-4 font-sans text-slate-900 font-medium">{mat.name}</td>
                            <td className="py-2.5 px-4 font-sans text-slate-600">{mat.supplier_name || '—'}</td>
                            <td className={`py-2.5 px-4 text-right font-bold ${isLow ? 'text-red-600' : 'text-slate-900'}`}>
                              {mat.current_stock} {mat.unit}
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-500">
                              {mat.min_stock} {mat.unit}
                            </td>
                            <td className="py-2.5 px-4 font-sans">
                              {isLow ? (
                                <span className="text-red-600 font-semibold">Abaixo do Mínimo (Repor)</span>
                              ) : (
                                <span className="text-emerald-700 font-medium">Estoque Normal</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right font-sans">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setStockModalMat(mat);
                                    setStockMoveForm({ movement_type: 'ENTRADA', quantity: 20, reference: 'NF-e Compra' });
                                  }}
                                  className="px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 border border-amber-300 rounded cursor-pointer"
                                >
                                  Movimentar
                                </button>
                                <button
                                  onClick={() => handleEditMaterial(mat)}
                                  className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMaterial(mat.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Kardex / Recent Stock Movements */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200">
                <h3 className="text-xs font-semibold text-slate-900">
                  Histórico Recente de Rastreamento de Estoque (Entradas e Baixas Automáticas de OP)
                </h3>
              </div>
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-4">Insumo</th>
                      <th className="py-2 px-4">Tipo</th>
                      <th className="py-2 px-4 text-right">Qtd</th>
                      <th className="py-2 px-4">Referência / Origem</th>
                      <th className="py-2 px-4">Responsável Técnico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {state.stockMovements.slice(0, 10).map((mov) => (
                      <tr key={mov.id}>
                        <td className="py-2 px-4 font-sans text-slate-800">
                          <span className="font-mono font-semibold">{mov.material_code}</span> · {mov.material_name}
                        </td>
                        <td className="py-2 px-4 font-sans">
                          {mov.movement_type === 'ENTRADA' ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <ArrowUpCircle className="w-3.5 h-3.5" /> Entrada
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold flex items-center gap-1">
                              <ArrowDownCircle className="w-3.5 h-3.5" /> Baixa OP
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right font-semibold text-slate-900">
                          {mov.quantity} {mov.material_unit}
                        </td>
                        <td className="py-2 px-4 font-sans text-slate-600">{mov.reference}</td>
                        <td className="py-2 px-4 font-sans text-slate-600">{mov.responsible_user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Movement Modal */}
      {stockModalMat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form onSubmit={handleStockMovement} className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Movimentar Estoque — {stockModalMat.code} ({stockModalMat.name})
            </h3>
            <p className="text-xs text-slate-600">
              Saldo atual: <strong className="font-mono">{stockModalMat.current_stock} {stockModalMat.unit}</strong> · Responsável: <strong>{currentUser.name}</strong>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Operação</label>
                <select
                  value={stockMoveForm.movement_type}
                  onChange={(e) => setStockMoveForm({ ...stockMoveForm, movement_type: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="ENTRADA">Entrada de Estoque (+)</option>
                  <option value="SAIDA_OP">Saída / Requisição (-)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quantidade ({stockModalMat.unit})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={stockMoveForm.quantity}
                  onChange={(e) => setStockMoveForm({ ...stockMoveForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Documento / Justificativa</label>
              <input
                type="text"
                required
                value={stockMoveForm.reference}
                onChange={(e) => setStockMoveForm({ ...stockMoveForm, reference: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStockModalMat(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer"
              >
                Confirmar Lançamento
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. CLIENTES */}
      {activeSubTab === 'clientes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form onSubmit={handleSaveCustomer} className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingCustomerId ? 'Editar Cliente' : 'Novo Cadastro de Cliente'}
                </h2>
                <p className="text-xs text-slate-500">Empresas contratantes e dados de contato comercial</p>
              </div>
              {editingCustomerId && (
                <button type="button" onClick={resetCustForm} className="text-xs text-slate-500 underline cursor-pointer">
                  Cancelar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Código *</label>
                <input
                  type="text"
                  required
                  placeholder="CLI-005"
                  value={custForm.code}
                  onChange={(e) => setCustForm({ ...custForm, code: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ / CPF *</label>
                <input
                  type="text"
                  required
                  placeholder="00.000.000/0001-00"
                  value={custForm.document}
                  onChange={(e) => setCustForm({ ...custForm, document: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Razão Social / Nome *</label>
              <input
                type="text"
                required
                placeholder="Ex: Metalúrgica Vale do Aço S.A."
                value={custForm.name}
                onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pessoa de Contato *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do comprador"
                  value={custForm.contact_person}
                  onChange={(e) => setCustForm({ ...custForm, contact_person: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="(11) 99999-0000"
                  value={custForm.phone}
                  onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Comercial</label>
                <input
                  type="email"
                  placeholder="compras@empresa.com.br"
                  value={custForm.email}
                  onChange={(e) => setCustForm({ ...custForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cidade / UF</label>
                <input
                  type="text"
                  placeholder="Campinas/SP"
                  value={custForm.city_state}
                  onChange={(e) => setCustForm({ ...custForm, city_state: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço de Entrega</label>
              <input
                type="text"
                placeholder="Rodovia / Rua, número e distrito industrial"
                value={custForm.address}
                onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
            >
              {editingCustomerId ? 'Salvar Alterações do Cliente' : 'Cadastrar Cliente'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Carteira de Clientes Cadastrados</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-4 font-semibold">Código</th>
                    <th className="py-2.5 px-4 font-semibold">Cliente / CNPJ</th>
                    <th className="py-2.5 px-4 font-semibold">Contato & Telefone</th>
                    <th className="py-2.5 px-4 font-semibold">E-mail / Localidade</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.customers
                    .filter(
                      (c) =>
                        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.code.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">{c.code}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{c.name}</div>
                          <div className="font-mono text-slate-500 mt-0.5">{c.document}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium">{c.contact_person}</div>
                          <div className="font-mono text-slate-500 mt-0.5">{c.phone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-700">{c.email}</div>
                          <div className="text-slate-500 mt-0.5">{c.city_state} — {c.address}</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditCustomer(c)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                              title="Editar Cliente"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(c.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                              title="Excluir Cliente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. FORNECEDORES */}
      {activeSubTab === 'fornecedores' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form onSubmit={handleSaveSupplier} className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingSupplierId ? 'Editar Fornecedor' : 'Novo Fornecedor de Insumos'}
                </h2>
                <p className="text-xs text-slate-500">Parceiros de suprimentos e lead time de entrega</p>
              </div>
              {editingSupplierId && (
                <button type="button" onClick={resetSupForm} className="text-xs text-slate-500 underline cursor-pointer">
                  Cancelar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Código *</label>
                <input
                  type="text"
                  required
                  placeholder="FOR-005"
                  value={supForm.code}
                  onChange={(e) => setSupForm({ ...supForm, code: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ *</label>
                <input
                  type="text"
                  required
                  placeholder="00.000.000/0001-00"
                  value={supForm.cnpj}
                  onChange={(e) => setSupForm({ ...supForm, cnpj: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Razão Social *</label>
              <input
                type="text"
                required
                value={supForm.name}
                onChange={(e) => setSupForm({ ...supForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contato Comercial *</label>
                <input
                  type="text"
                  required
                  value={supForm.contact_person}
                  onChange={(e) => setSupForm({ ...supForm, contact_person: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Time (Dias)</label>
                <input
                  type="number"
                  min={1}
                  value={supForm.lead_time_days}
                  onChange={(e) => setSupForm({ ...supForm, lead_time_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone</label>
                <input
                  type="text"
                  value={supForm.phone}
                  onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail de Pedidos</label>
                <input
                  type="email"
                  value={supForm.email}
                  onChange={(e) => setSupForm({ ...supForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço Completo</label>
              <input
                type="text"
                value={supForm.address}
                onChange={(e) => setSupForm({ ...supForm, address: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
            >
              {editingSupplierId ? 'Atualizar Fornecedor' : 'Cadastrar Fornecedor'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Fornecedores Homologados</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-4 font-semibold">Código</th>
                    <th className="py-2.5 px-4 font-semibold">Fornecedor / CNPJ</th>
                    <th className="py-2.5 px-4 font-semibold">Representante</th>
                    <th className="py-2.5 px-4 font-semibold">E-mail / Endereço</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Prazo Médio</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.suppliers
                    .filter(
                      (s) =>
                        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        s.code.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">{s.code}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{s.name}</div>
                          <div className="font-mono text-slate-500 mt-0.5">{s.cnpj}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium">{s.contact_person}</div>
                          <div className="font-mono text-slate-500 mt-0.5">{s.phone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-700">{s.email}</div>
                          <div className="text-slate-500 mt-0.5">{s.address}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                          {s.lead_time_days} dias
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditSupplier(s)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSupplier(s.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. CAPACIDADE PRODUTIVA */}
      {activeSubTab === 'capacidade' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form onSubmit={handleSaveCapacity} className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingCapacityId ? 'Editar Capacidade do Período' : 'Definir Capacidade por Período'}
                </h2>
                <p className="text-xs text-slate-500">Cálculo de minutos produtivos disponíveis no período</p>
              </div>
              {editingCapacityId && (
                <button type="button" onClick={resetCapForm} className="text-xs text-slate-500 underline cursor-pointer">
                  Cancelar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Código Período *</label>
                <input
                  type="text"
                  required
                  placeholder="CAP-2026-12"
                  value={capForm.period_code}
                  onChange={(e) => setCapForm({ ...capForm, period_code: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Centro de Trabalho *</label>
                <input
                  type="text"
                  required
                  value={capForm.work_center}
                  onChange={(e) => setCapForm({ ...capForm, work_center: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição do Período *</label>
              <input
                type="text"
                required
                placeholder="Ex: Dezembro / 2026 — Operação Fim de Ano"
                value={capForm.period_label}
                onChange={(e) => setCapForm({ ...capForm, period_label: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Turnos / Dia</label>
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={capForm.shifts_per_day}
                  onChange={(e) => setCapForm({ ...capForm, shifts_per_day: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Horas / Turno</label>
                <input
                  type="number"
                  step="0.5"
                  min={1}
                  value={capForm.hours_per_shift}
                  onChange={(e) => setCapForm({ ...capForm, hours_per_shift: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dias Úteis</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={capForm.working_days}
                  onChange={(e) => setCapForm({ ...capForm, working_days: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Operadores</label>
                <input
                  type="number"
                  min={1}
                  value={capForm.operators_count}
                  onChange={(e) => setCapForm({ ...capForm, operators_count: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Eficiência (OEE)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1.0"
                  value={capForm.efficiency_factor}
                  onChange={(e) => setCapForm({ ...capForm, efficiency_factor: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md font-mono text-xs flex items-center justify-between">
              <span className="font-sans text-slate-600">Capacidade Líquida Calculada:</span>
              <strong className="text-slate-900 tabular-nums">
                {previewAvailableMinutes.toLocaleString('pt-BR')} min ({(previewAvailableMinutes / 60).toFixed(0)} h)
              </strong>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Observações de Escala / Manutenção</label>
              <textarea
                rows={2}
                value={capForm.notes}
                onChange={(e) => setCapForm({ ...capForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
            >
              {editingCapacityId ? 'Atualizar Capacidade do Período' : 'Salvar Período de Capacidade'}
            </button>
          </form>

          <div className="lg:col-span-8 space-y-4">
            {state.capacities.map((cap) => {
              const isOverloaded = cap.utilization_percent > 95;
              return (
                <div key={cap.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="text-xs text-slate-500">
                        <span className="font-mono font-semibold text-slate-900">{cap.period_code}</span>
                        <span className="mx-2">·</span>
                        <span>{cap.work_center}</span>
                        <span className="mx-2">·</span>
                        <span>{cap.orders_count} OPs vinculadas</span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 mt-0.5">{cap.period_label}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditCapacity(cap)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Editar
                      </button>
                      <button
                        onClick={() => handleDeleteCapacity(cap.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs font-mono tabular-nums">
                    <div>
                      <div className="text-slate-500 font-sans">Escala Operacional</div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {cap.shifts_per_day}t × {cap.hours_per_shift}h × {cap.working_days}d
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-sans">Equipe & Eficiência</div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {cap.operators_count} oper. ({Math.round(cap.efficiency_factor * 100)}%)
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-sans">Capacidade Disponível</div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {cap.available_minutes.toLocaleString('pt-BR')} min
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-sans">Carga Alocada (OPs)</div>
                      <div className="font-semibold text-amber-700 mt-0.5">
                        {cap.allocated_minutes.toLocaleString('pt-BR')} min
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-sans">Taxa de Ocupação</div>
                      <div className={`font-bold mt-0.5 ${isOverloaded ? 'text-red-600' : 'text-emerald-700'}`}>
                        {cap.utilization_percent}% ({isOverloaded ? 'Sobrecarga' : 'Nominal'})
                      </div>
                    </div>
                  </div>

                  {/* Utilization bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isOverloaded ? 'bg-red-600' : cap.utilization_percent > 75 ? 'bg-amber-500' : 'bg-slate-900'
                      }`}
                      style={{ width: `${Math.min(100, cap.utilization_percent)}%` }}
                    />
                  </div>

                  {cap.notes && <p className="text-xs text-slate-600">{cap.notes}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
