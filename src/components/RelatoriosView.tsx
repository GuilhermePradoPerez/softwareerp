import React, { useState } from 'react';
import { Printer } from 'lucide-react';
import { ErpState, User, ProductionOrder } from '../types';

interface RelatoriosViewProps {
  state: ErpState;
  currentUser: User;
  onPrintOP: (op: ProductionOrder) => void;
}

export const RelatoriosView: React.FC<RelatoriosViewProps> = ({
  state,
  currentUser,
  onPrintOP,
}) => {
  const [reportFilter, setReportFilter] = useState<'TODAS' | 'CONCLUIDAS' | 'PENDENTES'>('TODAS');

  const totalOps = state.productionOrders.length;
  const completedOps = state.productionOrders.filter((op) => op.status === 'CONCLUIDA');
  const pendingOps = state.productionOrders.filter(
    (op) => op.status === 'PLANEJADA' || op.status === 'EM_PROCESSO' || op.status === 'PAUSADA'
  );

  const totalPlannedMinutes = state.productionOrders.reduce(
    (sum, op) => sum + op.planned_total_minutes,
    0
  );
  const completedPlannedMinutes = completedOps.reduce(
    (sum, op) => sum + op.planned_total_minutes,
    0
  );
  const completedActualMinutes = completedOps.reduce(
    (sum, op) => sum + (op.actual_total_minutes ?? op.planned_total_minutes),
    0
  );
  const pendingMinutes = pendingOps.reduce((sum, op) => sum + op.planned_total_minutes, 0);

  const totalUnitsProduced = completedOps.reduce((sum, op) => sum + op.quantity, 0);
  const totalUnitsPending = pendingOps.reduce((sum, op) => sum + op.quantity, 0);

  const displayedOps = state.productionOrders.filter((op) => {
    if (reportFilter === 'CONCLUIDAS') return op.status === 'CONCLUIDA';
    if (reportFilter === 'PENDENTES')
      return op.status === 'PLANEJADA' || op.status === 'EM_PROCESSO' || op.status === 'PAUSADA';
    return true;
  });

  const formatDate = (dStr?: string | null) => {
    if (!dStr) return '—';
    if (dStr.includes('T')) {
      return new Date(dStr).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    const [y, m, d] = dStr.split('-');
    return d && m && y ? `${d}/${m}/${y}` : dStr;
  };

  return (
    <div className="space-y-6">
      {/* Header & Print Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-lg no-print">
        <div>
          <div className="text-xs text-slate-500">
            <span>Relatório Gerencial de PCP</span>
            <span className="mx-2">·</span>
            <span>Responsável Técnico Autenticado: <strong className="text-slate-900">{currentUser.name}</strong></span>
            <span className="mx-2">·</span>
            <span className="font-mono">{currentUser.crea_registro}</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
            Relatório Consolidado de Acompanhamento da Produção
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              onClick={() => setReportFilter('TODAS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer ${
                reportFilter === 'TODAS' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              Todas ({totalOps})
            </button>
            <button
              onClick={() => setReportFilter('CONCLUIDAS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer ${
                reportFilter === 'CONCLUIDAS' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              Concluídas ({completedOps.length})
            </button>
            <button
              onClick={() => setReportFilter('PENDENTES')}
              className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer ${
                reportFilter === 'PENDENTES' ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              Pendentes ({pendingOps.length})
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" /> Imprimir Relatório Geral
          </button>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 print-sheet">
        {/* Official Report Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b-2 border-slate-900 gap-4">
          <div>
            <div className="text-xs font-mono text-slate-500">
              FORJA INDUSTRIAL METALMECÂNICA LTDA · RELATÓRIO DE ENGENHARIA E PCP
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              BALANÇO DE PRODUÇÃO: CONCLUÍDA VS. PENDENTE E CUMPRIMENTO DE PRAZOS
            </h1>
            <div className="text-xs text-slate-600 mt-1">
              <span>Responsável Técnico: <strong className="text-slate-900">{currentUser.name}</strong></span>
              <span className="mx-2">·</span>
              <span>Cargo: {currentUser.role}</span>
              <span className="mx-2">·</span>
              <span className="font-mono">{currentUser.crea_registro}</span>
            </div>
          </div>
          <div className="sm:text-right font-mono text-xs text-slate-600">
            <div>Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</div>
            <div>Hora: {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        {/* Summary Quantitative Comparison Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 px-4 bg-slate-50 border border-slate-200 rounded font-mono tabular-nums text-xs">
          <div>
            <div className="font-sans text-slate-500">Ordens Concluídas vs. Pendentes</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {completedOps.length} concluídas / {pendingOps.length} pendentes
            </div>
            <div className="font-sans text-slate-600 mt-0.5">
              Taxa de Conclusão: {totalOps > 0 ? Math.round((completedOps.length / totalOps) * 100) : 0}% das OPs
            </div>
          </div>
          <div>
            <div className="font-sans text-slate-500">Volume Físico Produzido vs. Carteira</div>
            <div className="text-base font-bold text-emerald-700 mt-0.5">
              {totalUnitsProduced} un entregues
            </div>
            <div className="font-sans text-slate-600 mt-0.5">
              {totalUnitsPending} un em aberto na fábrica
            </div>
          </div>
          <div>
            <div className="font-sans text-slate-500">Horas de Processo (Concluídas)</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {completedActualMinutes} min ({(completedActualMinutes / 60).toFixed(1)} h)
            </div>
            <div className="font-sans text-slate-600 mt-0.5">
              Planejado p/ lote: {completedPlannedMinutes} min
            </div>
          </div>
          <div>
            <div className="font-sans text-slate-500">Carga Pendente em Aberto</div>
            <div className="text-base font-bold text-amber-700 mt-0.5">
              {pendingMinutes} min ({(pendingMinutes / 60).toFixed(1)} h)
            </div>
            <div className="font-sans text-slate-600 mt-0.5">
              Total Geral Planejado: {totalPlannedMinutes} min
            </div>
          </div>
        </div>

        {/* Section 1: Detailed Production Orders Status, Deadlines & Process Time */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">
            01. Relação Analítica de Ordens de Produção (Status, Prazos e Tempos de Processo)
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Nº OP</th>
                  <th className="py-2.5 px-3 font-semibold">Pedido / Cliente</th>
                  <th className="py-2.5 px-3 font-semibold">Produto (Ficha Técnica)</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Lote</th>
                  <th className="py-2.5 px-3 text-right font-semibold">T. Planejado</th>
                  <th className="py-2.5 px-3 text-right font-semibold">T. Real</th>
                  <th className="py-2.5 px-3 font-semibold">Prazo Meta</th>
                  <th className="py-2.5 px-3 font-semibold">Status & Etapa</th>
                  <th className="py-2.5 px-3 font-semibold">Resp. Técnico</th>
                  <th className="py-2.5 px-3 text-right font-semibold no-print">Documento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                {displayedOps.map((op) => {
                  const isDone = op.status === 'CONCLUIDA';
                  return (
                    <tr key={op.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{op.op_number}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-mono font-semibold text-slate-800">
                          {op.order_number || 'Estoque Interno'}
                        </div>
                        <div className="text-slate-500">{op.customer_name || 'Almoxarifado'}</div>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-semibold text-slate-900">{op.product_name}</div>
                        <div className="font-mono text-slate-500">
                          {op.product_code} · {op.unit_process_time_minutes}m/un + {op.setup_time_minutes}m setup
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{op.quantity} un</td>
                      <td className="py-2.5 px-3 text-right text-slate-800">{op.planned_total_minutes} min</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        {op.actual_total_minutes ? `${op.actual_total_minutes} min` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">
                        <div>{formatDate(op.due_date)}</div>
                        {op.completed_at && (
                          <div className="text-emerald-700 font-semibold">
                            Baixa: {formatDate(op.completed_at)}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <div
                          className={`font-semibold ${
                            isDone
                              ? 'text-emerald-700'
                              : op.status === 'EM_PROCESSO'
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {op.status.replace('_', ' ')}
                        </div>
                        <div className="text-slate-500">{op.current_stage}</div>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="text-slate-900 font-medium">{op.technical_responsible}</div>
                        <div className="font-mono text-slate-500">{op.technical_crea}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans no-print">
                        <button
                          onClick={() => onPrintOP(op)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 border border-slate-300 rounded cursor-pointer inline-flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" /> Imprimir OP
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Productive Capacity vs Allocated Load */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">
              02. Ocupação da Capacidade Produtiva por Período
            </h3>
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2 px-3 font-semibold">Período</th>
                    <th className="py-2 px-3 text-right font-semibold">Disponível</th>
                    <th className="py-2 px-3 text-right font-semibold">Alocado</th>
                    <th className="py-2 px-3 text-right font-semibold">Concluído</th>
                    <th className="py-2 px-3 text-right font-semibold">Ocupação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                  {state.capacities.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 px-3 font-sans">
                        <div className="font-mono font-semibold text-slate-900">{c.period_code}</div>
                        <div className="text-slate-500">{c.period_label}</div>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-800">
                        {c.available_minutes.toLocaleString('pt-BR')} m
                      </td>
                      <td className="py-2 px-3 text-right text-amber-700 font-semibold">
                        {c.allocated_minutes.toLocaleString('pt-BR')} m
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-semibold">
                        {c.completed_minutes.toLocaleString('pt-BR')} m
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {c.utilization_percent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">
              03. Balanço Crítico de Matérias-Primas e Insumos
            </h3>
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2 px-3 font-semibold">Insumo</th>
                    <th className="py-2 px-3 text-right font-semibold">Saldo Atual</th>
                    <th className="py-2 px-3 text-right font-semibold">Estoque Mín.</th>
                    <th className="py-2 px-3 font-semibold">Status Suprimentos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                  {state.rawMaterials.map((rm) => {
                    const low = rm.current_stock <= rm.min_stock;
                    return (
                      <tr key={rm.id}>
                        <td className="py-2 px-3 font-sans">
                          <span className="font-mono font-semibold text-slate-900">{rm.code}</span> · {rm.name}
                        </td>
                        <td className={`py-2 px-3 text-right font-bold ${low ? 'text-red-600' : 'text-slate-900'}`}>
                          {rm.current_stock} {rm.unit}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-500">
                          {rm.min_stock} {rm.unit}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          {low ? (
                            <span className="text-red-600 font-semibold">Solicitar Compra</span>
                          ) : (
                            <span className="text-emerald-700">Regular</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Official Technical Signature Block */}
        <div className="pt-8 border-t border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-600">
          <div>
            Documento validado tecnicamente por: <strong className="text-slate-900">{currentUser.name}</strong> ({currentUser.role} — <span className="font-mono">{currentUser.crea_registro}</span>)
          </div>
          <div className="font-mono">
            Assinatura Técnica: __________________________________________
          </div>
        </div>
      </div>
    </div>
  );
};
