import React from 'react';
import { Printer, ArrowRight, Play, CheckCircle2, FilePlus2 } from 'lucide-react';
import { ErpState, User, ProductionOrder, Order } from '../types';
import { formatDate } from '../utils/formatters';

interface PainelViewProps {
  state: ErpState;
  currentUser: User;
  onNavigate: (
    section: 'painel' | 'producao' | 'cadastros' | 'relatorios',
    subTab?: string
  ) => void;
  onPrintOP: (op: ProductionOrder) => void;
  onRefreshState: (newState: ErpState) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

export const PainelView: React.FC<PainelViewProps> = ({
  state,
  currentUser,
  onNavigate,
  onPrintOP,
  onRefreshState,
  notify,
}) => {
  const activeOps = state.productionOrders.filter(
    (op) => op.status === 'EM_PROCESSO' || op.status === 'PLANEJADA' || op.status === 'PAUSADA'
  );
  const completedOps = state.productionOrders.filter((op) => op.status === 'CONCLUIDA');
  const openOrdersWithoutOps = state.orders.filter((o) => o.ops_count === 0);
  const lowStockMaterials = state.rawMaterials.filter((m) => m.current_stock <= m.min_stock);

  const primaryCapacity = state.capacities[0];

  const handleQuickGenerateOps = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/${order.id}/generate-ops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capacity_period_id: primaryCapacity?.id || 1,
          technical_responsible: currentUser.name,
          technical_crea: currentUser.crea_registro,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar OPs');
      onRefreshState(data);
      notify(`Ordens de Produção geradas automaticamente para ${order.order_number}!`);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleQuickStartOp = async (op: ProductionOrder) => {
    try {
      const res = await fetch(`/api/production-orders/${op.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'EM_PROCESSO',
          current_stage: 'Usinagem e Processamento no Chão de Fábrica',
          technical_responsible: currentUser.name,
          technical_crea: currentUser.crea_registro,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onRefreshState(data);
      notify(`Ordem ${op.op_number} iniciada no chão de fábrica.`);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Executive Industrial Context Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="text-xs text-slate-500">
              <span>Unidade Industrial Piracicaba / SP</span>
              <span className="mx-2">·</span>
              <span>Responsável Técnico em Turno: <strong className="text-slate-900">{currentUser.name}</strong></span>
              <span className="mx-2">·</span>
              <span className="font-mono">{currentUser.crea_registro}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Central de Planejamento e Controle da Produção (PCP)
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('producao', 'pedidos')}
              className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              + Novo Pedido de Cliente
            </button>
            <button
              onClick={() => onNavigate('producao', 'ordens')}
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              Gerenciar Ordens de Produção
            </button>
          </div>
        </div>

        {/* 4 Key Industrial Metrics (Single-Elevation Divider Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-5 font-mono tabular-nums">
          <div className="sm:border-r border-slate-200 sm:pr-4">
            <div className="font-sans text-xs text-slate-500">Ordens Ativas na Fábrica</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {activeOps.length} OPs
            </div>
            <div className="font-sans text-xs text-slate-600 mt-1">
              <span>{state.productionOrders.filter((o) => o.status === 'EM_PROCESSO').length} em execução</span>
              <span className="mx-1.5">·</span>
              <span>{state.productionOrders.filter((o) => o.status === 'PLANEJADA').length} planejadas</span>
            </div>
          </div>

          <div className="lg:border-r border-slate-200 lg:pr-4">
            <div className="font-sans text-xs text-slate-500">Produção Concluída (Baixada)</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              {completedOps.length} OPs ({completedOps.reduce((s, o) => s + o.quantity, 0)} un)
            </div>
            <div className="font-sans text-xs text-slate-600 mt-1">
              Tempo executado: {completedOps.reduce((s, o) => s + (o.actual_total_minutes || o.planned_total_minutes), 0)} min
            </div>
          </div>

          <div className="sm:border-r border-slate-200 sm:pr-4">
            <div className="font-sans text-xs text-slate-500">
              Capacidade ({primaryCapacity?.period_code || 'Atual'})
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {primaryCapacity?.utilization_percent || 0}% ocupada
            </div>
            <div className="font-sans text-xs text-slate-600 mt-1">
              {primaryCapacity?.allocated_minutes.toLocaleString('pt-BR')} / {primaryCapacity?.available_minutes.toLocaleString('pt-BR')} min disponíveis
            </div>
          </div>

          <div>
            <div className="font-sans text-xs text-slate-500">Cadastros Base & Estoque</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {state.products.length} Fichas · {state.rawMaterials.length} MPs
            </div>
            <div className="font-sans text-xs mt-1">
              {lowStockMaterials.length > 0 ? (
                <span className="text-red-600 font-semibold">
                  {lowStockMaterials.length} insumo(s) abaixo do mínimo
                </span>
              ) : (
                <span className="text-emerald-700 font-medium">
                  Todos os insumos acima do estoque mínimo
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Operational Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 8 Cols: Active Floor Production Queue */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                01. Acompanhamento da Produção em Tempo Real
              </h2>
              <p className="text-xs text-slate-500">
                Status de cada Ordem de Produção, tempos de processo automáticos e emissão para impressão
              </p>
            </div>
            <button
              onClick={() => onNavigate('producao', 'ordens')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
            >
              Ver todas e dar baixa <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-semibold">Ordem</th>
                  <th className="py-2.5 px-4 font-semibold">Produto & Cliente</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Qtd</th>
                  <th className="py-2.5 px-4 text-right font-semibold">T. Processo</th>
                  <th className="py-2.5 px-4 font-semibold">Status & Etapa Atual</th>
                  <th className="py-2.5 px-4 text-right font-semibold">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                {state.productionOrders.slice(0, 6).map((op) => {
                  const isDone = op.status === 'CONCLUIDA';
                  const isRunning = op.status === 'EM_PROCESSO';
                  return (
                    <tr key={op.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{op.op_number}</div>
                        <div className="text-slate-500">Meta: {formatDate(op.due_date)}</div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="font-semibold text-slate-900">
                          {op.product_code} — {op.product_name}
                        </div>
                        <div className="text-slate-500">
                          {op.order_number ? `${op.order_number} · ${op.customer_name}` : 'Estoque Interno'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {op.quantity} un
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-semibold text-slate-900">{op.planned_total_minutes} min</div>
                        <div className="text-slate-500">{op.unit_process_time_minutes}m/un</div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div
                          className={`font-semibold ${
                            isDone
                              ? 'text-emerald-700'
                              : isRunning
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {op.status.replace('_', ' ')}
                        </div>
                        <div className="text-slate-500 truncate max-w-44" title={op.current_stage}>
                          {op.current_stage}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          {op.status === 'PLANEJADA' && (
                            <button
                              onClick={() => handleQuickStartOp(op)}
                              className="px-2 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer inline-flex items-center gap-1"
                              title="Iniciar Produção"
                            >
                              <Play className="w-3 h-3" /> Iniciar
                            </button>
                          )}
                          {!isDone && (
                            <button
                              onClick={() => onNavigate('producao', 'ordens')}
                              className="px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-300 rounded cursor-pointer inline-flex items-center gap-1"
                              title="Ir para Baixa de OP"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Baixar
                            </button>
                          )}
                          <button
                            onClick={() => onPrintOP(op)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-300 rounded cursor-pointer"
                            title="Imprimir Ordem de Produção"
                          >
                            <Printer className="w-3.5 h-3.5" />
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

        {/* Right 4 Cols: Open Orders Ready for OP Generation & Quick Module Access */}
        <div className="lg:col-span-4 space-y-6">
          {/* Pending Orders to Generate OPs */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="border-b border-slate-100 pb-2.5">
              <h2 className="text-sm font-semibold text-slate-900">
                02. Pedidos Aguardando Emissão de OP
              </h2>
              <p className="text-xs text-slate-500">
                Gere Ordens de Produção automaticamente a partir das Fichas Técnicas
              </p>
            </div>

            {openOrdersWithoutOps.length > 0 ? (
              <div className="space-y-3">
                {openOrdersWithoutOps.map((ord) => (
                  <div key={ord.id} className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-900">{ord.order_number}</span>
                      <span className="font-mono text-slate-600">Entrega: {formatDate(ord.delivery_date)}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800">{ord.customer_name}</div>
                    <div className="text-xs text-slate-600 font-mono">
                      {ord.items.length} produto(s) · Carga estimada: {ord.total_process_minutes} min
                    </div>
                    <button
                      onClick={() => handleQuickGenerateOps(ord)}
                      className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <FilePlus2 className="w-3.5 h-3.5" /> Emitir Ordens de Produção Agora
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-xs text-slate-600">
                Todos os pedidos em carteira já possuem Ordens de Produção emitidas.{' '}
                <button
                  onClick={() => onNavigate('producao', 'pedidos')}
                  className="text-amber-700 font-semibold underline cursor-pointer"
                >
                  Cadastrar novo pedido
                </button>
              </div>
            )}
          </div>

          {/* Direct Links to All 5 Registration Modules */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="border-b border-slate-100 pb-2.5">
              <h2 className="text-sm font-semibold text-slate-900">
                03. Acesso Rápido aos Módulos de Cadastro
              </h2>
              <p className="text-xs text-slate-500">
                Banco de dados relacional com suporte a múltiplas entradas
              </p>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {[
                {
                  tab: 'fichas',
                  title: 'Ficha Técnica do Produto',
                  desc: `${state.products.length} produtos com tempo de processo e BOM`,
                },
                {
                  tab: 'materias',
                  title: 'Matéria-Prima & Rastreio de Estoque',
                  desc: `${state.rawMaterials.length} insumos e movimentações Kardex`,
                },
                {
                  tab: 'clientes',
                  title: 'Cadastro de Clientes',
                  desc: `${state.customers.length} empresas compradoras ativas`,
                },
                {
                  tab: 'fornecedores',
                  title: 'Cadastro de Fornecedores',
                  desc: `${state.suppliers.length} parceiros homologados`,
                },
                {
                  tab: 'capacidade',
                  title: 'Capacidade Produtiva por Período',
                  desc: `${state.capacities.length} períodos configurados`,
                },
              ].map((m) => (
                <button
                  key={m.tab}
                  onClick={() => onNavigate('cadastros', m.tab)}
                  className="w-full py-2.5 flex items-center justify-between text-left hover:bg-slate-50 px-2 rounded transition-colors cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{m.title}</div>
                    <div className="text-slate-500">{m.desc}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
