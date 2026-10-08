import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Printer,
  Play,
  CheckCircle2,
  PauseCircle,
  FilePlus2,
  Search,
} from 'lucide-react';
import { ErpState, User, OrderItem, ProductionOrder, Order } from '../types';

interface ProducaoViewProps {
  state: ErpState;
  currentUser: User;
  activeSubTab: 'pedidos' | 'ordens';
  setActiveSubTab: (tab: 'pedidos' | 'ordens') => void;
  onRefreshState: (newState: ErpState) => void;
  onPrintOP: (op: ProductionOrder) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

export const ProducaoView: React.FC<ProducaoViewProps> = ({
  state,
  currentUser,
  activeSubTab,
  setActiveSubTab,
  onRefreshState,
  onPrintOP,
  notify,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState('');

  // --- Order Creation State ---
  const [orderForm, setOrderForm] = useState({
    order_number: `PED-2026-010${state.orders.length + 1}`,
    customer_id: state.customers[0]?.id || 1,
    order_date: new Date().toISOString().slice(0, 10),
    delivery_date: '2026-10-30',
    priority: 'NORMAL' as 'BAIXA' | 'NORMAL' | 'ALTA' | 'URGENTE',
    notes: '',
    auto_generate_ops: true,
    capacity_period_id: state.capacities[0]?.id || 1,
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    {
      product_id: state.products[0]?.id || 1,
      quantity: 2,
      unit_price: state.products[0]?.unit_price || 2450,
    },
  ]);

  // --- Direct OP Creation Modal State ---
  const [showNewOpModal, setShowNewOpModal] = useState(false);
  const [newOpForm, setNewOpForm] = useState({
    order_id: '',
    product_id: state.products[0]?.id || 1,
    capacity_period_id: state.capacities[0]?.id || 1,
    quantity: 5,
    priority: 'NORMAL',
    start_date: new Date().toISOString().slice(0, 10),
    due_date: '2026-10-25',
    current_stage: 'Aguardando Liberação de Materiais',
  });

  // --- Baixa de Ordem de Produção (Completion Modal) State ---
  const [baixaOp, setBaixaOp] = useState<ProductionOrder | null>(null);
  const [baixaForm, setBaixaForm] = useState({
    actual_total_minutes: 0,
    completion_notes: '',
    deduct_materials: true,
    current_stage: 'Inspeção Final Concluída e Liberada',
  });

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

  // --- Order Handlers ---
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...orderForm,
        created_by: currentUser.name,
        technical_crea: currentUser.crea_registro,
        items: orderItems,
      };
      const newState = await apiCall('/api/orders', 'POST', payload);
      onRefreshState(newState);
      notify(
        orderForm.auto_generate_ops
          ? 'Pedido registrado e Ordens de Produção emitidas automaticamente!'
          : 'Pedido de cliente cadastrado com sucesso.'
      );
      setOrderForm({
        ...orderForm,
        order_number: `PED-2026-010${newState.orders.length + 1}`,
        notes: '',
      });
      setOrderItems([
        {
          product_id: newState.products[0]?.id || 1,
          quantity: 1,
          unit_price: newState.products[0]?.unit_price || 1000,
        },
      ]);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleGenerateOpsFromOrder = async (order: Order) => {
    try {
      const newState = await apiCall(`/api/orders/${order.id}/generate-ops`, 'POST', {
        capacity_period_id: state.capacities[0]?.id || 1,
        technical_responsible: currentUser.name,
        technical_crea: currentUser.crea_registro,
      });
      onRefreshState(newState);
      notify(`Ordens de Produção emitidas para o pedido ${order.order_number}!`);
      setActiveSubTab('ordens');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteOrder = async (id: number) => {
    try {
      const newState = await apiCall(`/api/orders/${id}`, 'DELETE');
      onRefreshState(newState);
      notify('Pedido removido.');
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  // --- Production Order Handlers ---
  const handleCreateDirectOp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newState = await apiCall('/api/production-orders', 'POST', {
        ...newOpForm,
        technical_responsible: currentUser.name,
        technical_crea: currentUser.crea_registro,
      });
      onRefreshState(newState);
      notify('Ordem de Produção emitida com tempo de processo calculado automaticamente.');
      setShowNewOpModal(false);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleUpdateOpStageOrStatus = async (
    op: ProductionOrder,
    newStatus: string,
    newStage: string
  ) => {
    try {
      const newState = await apiCall(`/api/production-orders/${op.id}/status`, 'PATCH', {
        status: newStatus,
        current_stage: newStage,
        technical_responsible: currentUser.name,
        technical_crea: currentUser.crea_registro,
      });
      onRefreshState(newState);
      notify(`Ordem ${op.op_number} atualizada para: ${newStage}`);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const openBaixaModal = (op: ProductionOrder) => {
    setBaixaOp(op);
    setBaixaForm({
      actual_total_minutes: op.planned_total_minutes,
      completion_notes: `Lote aprovado pelo CQ sob supervisão de ${currentUser.name}.`,
      deduct_materials: op.materials_deducted === 0,
      current_stage: 'Inspeção Final Concluída e Liberada',
    });
  };

  const handleConfirmBaixa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baixaOp) return;
    try {
      const newState = await apiCall(`/api/production-orders/${baixaOp.id}/status`, 'PATCH', {
        status: 'CONCLUIDA',
        current_stage: baixaForm.current_stage,
        actual_total_minutes: Number(baixaForm.actual_total_minutes),
        completion_notes: baixaForm.completion_notes,
        deduct_materials: baixaForm.deduct_materials,
        technical_responsible: currentUser.name,
        technical_crea: currentUser.crea_registro,
      });
      onRefreshState(newState);
      notify(`Baixa da Ordem ${baixaOp.op_number} concluída com sucesso!`);
      setBaixaOp(null);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const selectedProductForDirectOp = state.products.find((p) => p.id === Number(newOpForm.product_id));
  const previewPlannedMinutes = selectedProductForDirectOp
    ? Number(newOpForm.quantity) * selectedProductForDirectOp.process_time_minutes +
      selectedProductForDirectOp.setup_time_minutes
    : 0;

  // Calculate preview totals for Order Form
  const previewOrderTotals = orderItems.reduce(
    (acc, item) => {
      const prod = state.products.find((p) => p.id === Number(item.product_id));
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      const procMin = prod ? qty * prod.process_time_minutes + prod.setup_time_minutes : 0;
      return {
        value: acc.value + qty * price,
        minutes: acc.minutes + procMin,
      };
    },
    { value: 0, minutes: 0 }
  );

  const filteredOps = state.productionOrders.filter((op) => {
    const matchesStatus = statusFilter === 'TODAS' || op.status === statusFilter;
    const matchesSearch =
      op.op_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (op.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (op.order_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const formatDate = (dStr?: string | null) => {
    if (!dStr) return '—';
    if (dStr.includes('T')) {
      return new Date(dStr).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    const [y, m, d] = dStr.split('-');
    return d && m && y ? `${d}/${m}/${y}` : dStr;
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            onClick={() => setActiveSubTab('ordens')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'ordens' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            01. Ordens de Produção & Chão de Fábrica ({state.productionOrders.length})
          </button>
          <button
            onClick={() => setActiveSubTab('pedidos')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'pedidos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            02. Cadastro de Pedidos de Clientes ({state.orders.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeSubTab === 'ordens' && (
            <button
              onClick={() => setShowNewOpModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <FilePlus2 className="w-4 h-4" /> Emitir Nova Ordem de Produção
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: ORDENS DE PRODUÇÃO (EMISSÃO, ACOMPANHAMENTO EM TEMPO REAL E BAIXA) */}
      {activeSubTab === 'ordens' && (
        <div className="space-y-5">
          {/* Filter Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-lg">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md">
              {[
                { id: 'TODAS', label: `Todas (${state.productionOrders.length})` },
                {
                  id: 'PLANEJADA',
                  label: `Planejadas (${state.productionOrders.filter((o) => o.status === 'PLANEJADA').length})`,
                },
                {
                  id: 'EM_PROCESSO',
                  label: `Em Processo (${state.productionOrders.filter((o) => o.status === 'EM_PROCESSO').length})`,
                },
                {
                  id: 'PAUSADA',
                  label: `Pausadas (${state.productionOrders.filter((o) => o.status === 'PAUSADA').length})`,
                },
                {
                  id: 'CONCLUIDA',
                  label: `Concluídas / Baixadas (${state.productionOrders.filter((o) => o.status === 'CONCLUIDA').length})`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar OP, produto, pedido ou cliente..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          {/* Production Orders List */}
          <div className="space-y-4">
            {filteredOps.map((op) => {
              const isCompleted = op.status === 'CONCLUIDA';
              const isRunning = op.status === 'EM_PROCESSO';
              const isPaused = op.status === 'PAUSADA';

              return (
                <div
                  key={op.id}
                  className={`bg-white border rounded-lg p-5 transition-colors ${
                    isRunning
                      ? 'border-amber-500'
                      : isCompleted
                      ? 'border-emerald-600/40 bg-slate-50/40'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top Row: Metadata & Actions */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="font-mono font-bold text-sm text-slate-900">{op.op_number}</span>
                        <span>·</span>
                        <span
                          className={`font-semibold ${
                            isCompleted
                              ? 'text-emerald-700'
                              : isRunning
                              ? 'text-amber-700'
                              : isPaused
                              ? 'text-red-600'
                              : 'text-slate-700'
                          }`}
                        >
                          Status: {op.status.replace('_', ' ')}
                        </span>
                        <span>·</span>
                        <span>Prioridade: <strong className="text-slate-900">{op.priority}</strong></span>
                        <span>·</span>
                        <span className="font-mono">Lote: {op.batch_code}</span>
                        {op.order_number && (
                          <>
                            <span>·</span>
                            <span>
                              Pedido: <strong className="font-mono text-slate-900">{op.order_number}</strong> ({op.customer_name})
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="text-base font-semibold text-slate-900 mt-1">
                        {op.product_code} — {op.product_name}{' '}
                        <span className="font-mono text-amber-700 font-bold">({op.quantity} un)</span>
                      </h3>
                    </div>

                    {/* Real-Time Control Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {op.status === 'PLANEJADA' && (
                        <button
                          onClick={() =>
                            handleUpdateOpStageOrStatus(
                              op,
                              'EM_PROCESSO',
                              'Em Usinagem / Processamento Inicial'
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" /> Iniciar Produção
                        </button>
                      )}

                      {op.status === 'EM_PROCESSO' && (
                        <>
                          <select
                            value={op.current_stage}
                            onChange={(e) =>
                              handleUpdateOpStageOrStatus(op, 'EM_PROCESSO', e.target.value)
                            }
                            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-800 font-medium"
                            title="Atualizar etapa em tempo real"
                          >
                            <option value="Em Usinagem / Processamento Inicial">Etapa: Usinagem / Corte</option>
                            <option value="Usinagem CNC Engrenagens Planetárias">Etapa: Usinagem CNC</option>
                            <option value="Montagem Mecânica e Teste Hidrostático">Etapa: Montagem & Bancada</option>
                            <option value="Pintura Epóxi e Acabamento">Etapa: Pintura & Acabamento</option>
                            <option value="Inspeção Dimensional de Qualidade">Etapa: Inspeção de Qualidade</option>
                          </select>

                          <button
                            onClick={() =>
                              handleUpdateOpStageOrStatus(
                                op,
                                'PAUSADA',
                                'Parada Técnica / Setup de Ferramental'
                              )
                            }
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-md cursor-pointer"
                          >
                            <PauseCircle className="w-3.5 h-3.5" /> Pausar
                          </button>
                        </>
                      )}

                      {op.status === 'PAUSADA' && (
                        <button
                          onClick={() =>
                            handleUpdateOpStageOrStatus(
                              op,
                              'EM_PROCESSO',
                              'Retomada de Processamento no Chão de Fábrica'
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-md cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" /> Retomar Ordem
                        </button>
                      )}

                      {!isCompleted && op.status !== 'CANCELADA' && (
                        <button
                          onClick={() => openBaixaModal(op)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-md transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Dar Baixa (Concluir OP)
                        </button>
                      )}

                      <button
                        onClick={() => onPrintOP(op)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> Imprimir OP
                      </button>
                    </div>
                  </div>

                  {/* Process Time & Execution Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 pt-3 text-xs font-mono tabular-nums">
                    <div>
                      <div className="text-slate-500 font-sans">Tempo Unit. (Ficha)</div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {op.unit_process_time_minutes} min/un (+{op.setup_time_minutes}m setup)
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-sans">Tempo Total Planejado</div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {op.planned_total_minutes} min ({(op.planned_total_minutes / 60).toFixed(1)} h)
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-sans">Tempo Real Registrado</div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {op.actual_total_minutes
                          ? `${op.actual_total_minutes} min (${(op.actual_total_minutes / 60).toFixed(1)} h)`
                          : 'Em andamento'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-sans">Etapa no Chão de Fábrica</div>
                      <div className="font-sans font-semibold text-slate-800 mt-0.5 truncate" title={op.current_stage}>
                        {op.current_stage}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-sans">Prazo Meta / Conclusão</div>
                      <div className="text-slate-900 mt-0.5">
                        Meta: <strong>{formatDate(op.due_date)}</strong>
                        {op.completed_at && (
                          <span className="block text-emerald-700 font-semibold">
                            Baixa: {formatDate(op.completed_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 font-sans">Responsável Técnico</div>
                      <div className="font-sans font-semibold text-slate-900 mt-0.5 truncate">
                        {op.technical_responsible}
                      </div>
                      <div className="text-slate-500">{op.technical_crea}</div>
                    </div>
                  </div>

                  {op.completion_notes && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong className="text-emerald-800">Laudo de Baixa da Produção:</strong> {op.completion_notes}
                      </div>
                      <span className="font-mono text-slate-500">
                        {op.materials_deducted ? 'Insumos baixados do estoque' : 'Sem baixa de estoque'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CADASTRO DE PEDIDOS (VINCULADOS A CLIENTES) */}
      {activeSubTab === 'pedidos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form to create Order */}
          <form onSubmit={handleCreateOrder} className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900">Novo Pedido de Produção (Cliente)</h2>
              <p className="text-xs text-slate-500">
                Vincule o cliente, adicione múltiplos produtos e gere as Ordens de Produção
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nº do Pedido *</label>
                <input
                  type="text"
                  required
                  value={orderForm.order_number}
                  onChange={(e) => setOrderForm({ ...orderForm, order_number: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prioridade *</label>
                <select
                  value={orderForm.priority}
                  onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="BAIXA">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cliente Contratante *</label>
              <select
                required
                value={orderForm.customer_id}
                onChange={(e) => setOrderForm({ ...orderForm, customer_id: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name} ({c.city_state})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Data do Pedido</label>
                <input
                  type="date"
                  required
                  value={orderForm.order_date}
                  onChange={(e) => setOrderForm({ ...orderForm, order_date: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prazo de Entrega *</label>
                <input
                  type="date"
                  required
                  value={orderForm.delivery_date}
                  onChange={(e) => setOrderForm({ ...orderForm, delivery_date: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
            </div>

            {/* Multi-item Order Products */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-900">
                  Itens do Pedido (Múltiplos Produtos)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const defaultProd = state.products[0];
                    setOrderItems([
                      ...orderItems,
                      {
                        product_id: defaultProd?.id || 1,
                        quantity: 1,
                        unit_price: defaultProd?.unit_price || 1000,
                      },
                    ]);
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Produto
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded border border-slate-200">
                    <div className="col-span-6">
                      <select
                        value={item.product_id}
                        onChange={(e) => {
                          const pid = Number(e.target.value);
                          const prod = state.products.find((p) => p.id === pid);
                          const updated = [...orderItems];
                          updated[idx].product_id = pid;
                          if (prod) updated[idx].unit_price = prod.unit_price;
                          setOrderItems(updated);
                        }}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded"
                      >
                        {state.products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name} ({p.process_time_minutes}m/un)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min={1}
                        required
                        placeholder="Qtd"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...orderItems];
                          updated[idx].quantity = Number(e.target.value);
                          setOrderItems(updated);
                        }}
                        className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="R$ Unit"
                        value={item.unit_price}
                        onChange={(e) => {
                          const updated = [...orderItems];
                          updated[idx].unit_price = Number(e.target.value);
                          setOrderItems(updated);
                        }}
                        className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {orderItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Automatic OP calculation summary */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-xs">
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="font-sans text-slate-600">Carga de Processo Calculada:</span>
                <strong className="text-slate-900">
                  {previewOrderTotals.minutes} min ({(previewOrderTotals.minutes / 60).toFixed(1)} h)
                </strong>
              </div>
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="font-sans text-slate-600">Valor Total do Pedido:</span>
                <strong className="text-slate-900">
                  R$ {previewOrderTotals.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoOps"
                  checked={orderForm.auto_generate_ops}
                  onChange={(e) => setOrderForm({ ...orderForm, auto_generate_ops: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="autoOps" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Emitir Ordens de Produção automaticamente ao salvar pedido
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Observações do Pedido</label>
              <input
                type="text"
                placeholder="Requisitos de entrega, lote ou embalagem..."
                value={orderForm.notes}
                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
            >
              Registrar Pedido Comercial
            </button>
          </form>

          {/* Orders List */}
          <div className="lg:col-span-7 space-y-4">
            {state.orders.map((order) => (
              <div key={order.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <div className="text-xs text-slate-500">
                      <span className="font-mono font-bold text-slate-900">{order.order_number}</span>
                      <span className="mx-2">·</span>
                      <span>Status: <strong className="text-slate-900">{order.status.replace('_', ' ')}</strong></span>
                      <span className="mx-2">·</span>
                      <span>Prioridade: {order.priority}</span>
                      <span className="mx-2">·</span>
                      <span className="font-mono">Entrega: {formatDate(order.delivery_date)}</span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 mt-1">
                      {order.customer_code} — {order.customer_name} ({order.customer_city})
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {order.ops_count === 0 && (
                      <button
                        onClick={() => handleGenerateOpsFromOrder(order)}
                        className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <FilePlus2 className="w-3.5 h-3.5" /> Gerar Ordens de Produção
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteOrder(order.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                      title="Excluir Pedido"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Items table */}
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-1.5 px-3 font-semibold">Produto</th>
                        <th className="py-1.5 px-3 text-right font-semibold">Qtd</th>
                        <th className="py-1.5 px-3 text-right font-semibold">Tempo Processo</th>
                        <th className="py-1.5 px-3 text-right font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                      {order.items.map((item, i) => (
                        <tr key={i}>
                          <td className="py-1.5 px-3 font-sans text-slate-900">
                            <span className="font-mono font-semibold">{item.product_code}</span> · {item.product_name}
                          </td>
                          <td className="py-1.5 px-3 text-right font-semibold text-slate-900">{item.quantity} un</td>
                          <td className="py-1.5 px-3 text-right text-slate-600">
                            {item.quantity * (item.process_time_minutes || 0) + (item.setup_time_minutes || 0)} min
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-800">
                            R$ {(item.quantity * item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                  <div>
                    Ordens Vinculadas:{' '}
                    {order.linked_ops.length > 0 ? (
                      order.linked_ops.map((lo, idx) => (
                        <span key={lo.id} className="font-mono font-semibold text-slate-900">
                          {idx > 0 ? ', ' : ''}
                          {lo.op_number} ({lo.status})
                        </span>
                      ))
                    ) : (
                      <span className="text-amber-700 font-medium">Aguardando emissão de OP</span>
                    )}
                  </div>
                  <div className="font-mono tabular-nums">
                    Carga Total: <strong>{order.total_process_minutes} min</strong> · Total:{' '}
                    <strong className="text-slate-900">
                      R$ {order.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Emissão Direta de Ordem de Produção */}
      {showNewOpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleCreateDirectOp}
            className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-slate-900">
              Emitir Nova Ordem de Produção (Com Cálculo Automático de Processo)
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ficha Técnica do Produto *
              </label>
              <select
                value={newOpForm.product_id}
                onChange={(e) => setNewOpForm({ ...newOpForm, product_id: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                {state.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name} (Processo: {p.process_time_minutes} min/un | Setup: {p.setup_time_minutes} min)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quantidade do Lote *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newOpForm.quantity}
                  onChange={(e) => setNewOpForm({ ...newOpForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prioridade</label>
                <select
                  value={newOpForm.priority}
                  onChange={(e) => setNewOpForm({ ...newOpForm, priority: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="BAIXA">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vincular a Pedido (Opcional)</label>
                <select
                  value={newOpForm.order_id}
                  onChange={(e) => setNewOpForm({ ...newOpForm, order_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="">Reposição de Estoque Interno</option>
                  {state.orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {o.customer_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Período de Capacidade *</label>
                <select
                  value={newOpForm.capacity_period_id}
                  onChange={(e) => setNewOpForm({ ...newOpForm, capacity_period_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  {state.capacities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.period_code} ({c.utilization_percent}% ocupado)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Data de Início</label>
                <input
                  type="date"
                  required
                  value={newOpForm.start_date}
                  onChange={(e) => setNewOpForm({ ...newOpForm, start_date: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prazo Limite *</label>
                <input
                  type="date"
                  required
                  value={newOpForm.due_date}
                  onChange={(e) => setNewOpForm({ ...newOpForm, due_date: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1 font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="font-sans text-slate-600">Tempo de Processo Automaticamente Registrado:</span>
                <strong className="text-slate-900">
                  {previewPlannedMinutes} min ({(previewPlannedMinutes / 60).toFixed(1)} h)
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-slate-600">Responsável Técnico Emissor:</span>
                <span className="font-sans font-semibold text-slate-900">
                  {currentUser.name} ({currentUser.crea_registro})
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewOpModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer"
              >
                Emitir Ordem de Produção
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Baixa de Ordem de Produção (Completion & Stock Deduction) */}
      {baixaOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleConfirmBaixa}
            className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 space-y-4"
          >
            <div className="border-b border-slate-200 pb-3">
              <div className="text-xs font-mono text-emerald-700 font-semibold">
                FECHAMENTO E BAIXA TÉCNICA DE ORDEM DE PRODUÇÃO
              </div>
              <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                {baixaOp.op_number} — {baixaOp.product_name} ({baixaOp.quantity} un)
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200 text-xs font-mono">
              <div>
                <div className="font-sans text-slate-500">Tempo Planejado (Ficha)</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {baixaOp.planned_total_minutes} min ({(baixaOp.planned_total_minutes / 60).toFixed(1)} h)
                </div>
              </div>
              <div>
                <label className="block font-sans font-semibold text-slate-800 mb-1">
                  Tempo Real Executado (min) *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={baixaForm.actual_total_minutes}
                  onChange={(e) =>
                    setBaixaForm({ ...baixaForm, actual_total_minutes: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Observações de Conclusão / Controle de Qualidade *
              </label>
              <textarea
                rows={3}
                required
                value={baixaForm.completion_notes}
                onChange={(e) => setBaixaForm({ ...baixaForm, completion_notes: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            {baixaOp.materials_deducted === 0 && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-md flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="deductMat"
                  checked={baixaForm.deduct_materials}
                  onChange={(e) => setBaixaForm({ ...baixaForm, deduct_materials: e.target.checked })}
                  className="mt-0.5"
                />
                <label htmlFor="deductMat" className="text-xs text-slate-800 cursor-pointer">
                  <strong className="block text-slate-900">
                    Baixar automaticamente matérias-primas do estoque conforme Ficha Técnica
                  </strong>
                  Deduzirá os insumos proporcionais às {baixaOp.quantity} unidades produzidas e registrará no Kardex.
                </label>
              </div>
            )}

            <div className="text-xs text-slate-500 border-t border-slate-100 pt-2">
              Responsável Técnico pela Baixa: <strong className="text-slate-900">{currentUser.name}</strong> ({currentUser.crea_registro})
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBaixaOp(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-md cursor-pointer"
              >
                Confirmar Baixa Definitiva
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
