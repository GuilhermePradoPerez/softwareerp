import React from 'react';
import { Printer, X, CheckSquare } from 'lucide-react';
import { ProductionOrder, User } from '../types';
import { formatDate } from '../utils/formatters';

interface PrintableOPModalProps {
  op: ProductionOrder | null;
  currentUser: User;
  onClose: () => void;
}

export const PrintableOPModal: React.FC<PrintableOPModalProps> = ({ op, currentUser, onClose }) => {
  if (!op) return null;

  const handlePrint = () => {
    window.print();
  };

  const statusLabel: Record<string, string> = {
    PLANEJADA: 'Planejada — Aguardando Início',
    EM_PROCESSO: 'Em Processo no Chão de Fábrica',
    PAUSADA: 'Pausada Temporariamente',
    CONCLUIDA: 'Concluída e Baixada',
    CANCELADA: 'Cancelada',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-lg max-w-4xl w-full my-8 overflow-hidden shadow-xl print-sheet">
        {/* Action bar (hidden on print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white no-print">
          <div>
            <h3 className="text-base font-semibold">Documento Oficial — Ordem de Produção {op.op_number}</h3>
            <p className="text-xs text-slate-300">
              Visualização pronta para impressão em folha A4 com assinatura do Responsável Técnico
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Imprimir Ordem (A4)
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white rounded-md transition-colors cursor-pointer"
              title="Fechar visualização"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 text-slate-900 space-y-6">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-5 border-b-2 border-slate-900 gap-4">
            <div>
              <div className="text-xs font-mono text-slate-600">FORJA INDUSTRIAL METALMECÂNICA LTDA · PCP</div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                ORDEM DE PRODUÇÃO INDUSTRIAL
              </h1>
              <div className="text-xs text-slate-600 mt-1">
                <span>Responsável Técnico Emissor: <strong className="text-slate-900">{op.technical_responsible}</strong></span>
                <span className="mx-2">·</span>
                <span className="font-mono">{op.technical_crea}</span>
              </div>
            </div>

            <div className="sm:text-right font-mono border border-slate-900 px-4 py-2.5 bg-slate-50">
              <div className="text-xs text-slate-600">Nº DA ORDEM</div>
              <div className="text-xl font-bold text-slate-900 tabular-nums">{op.op_number}</div>
              <div className="text-xs text-slate-600 mt-0.5">Lote: {op.batch_code || 'PADRÃO'}</div>
            </div>
          </div>

          {/* Primary Technical Data Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 px-4 border border-slate-300 bg-slate-50/60 text-xs">
            <div>
              <div className="text-slate-500">Produto / Ficha Técnica</div>
              <div className="font-semibold text-slate-900 mt-0.5 font-mono">{op.product_code}</div>
              <div className="font-medium text-slate-800">{op.product_name}</div>
            </div>
            <div>
              <div className="text-slate-500">Quantidade do Lote</div>
              <div className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                {op.quantity} un
              </div>
              <div className="text-slate-600">Prioridade: {op.priority}</div>
            </div>
            <div>
              <div className="text-slate-500">Pedido & Cliente Vinculado</div>
              <div className="font-semibold text-slate-900 font-mono mt-0.5">
                {op.order_number || 'Ordem para Estoque Interno'}
              </div>
              <div className="text-slate-700">{op.customer_name || 'Almoxarifado Central'}</div>
            </div>
            <div>
              <div className="text-slate-500">Prazos e Status</div>
              <div className="font-mono text-slate-900 mt-0.5">
                Início: {formatDate(op.start_date)} | Meta: <strong>{formatDate(op.due_date)}</strong>
              </div>
              <div className="font-semibold text-slate-800 mt-0.5">{statusLabel[op.status] || op.status}</div>
            </div>
          </div>

          {/* Standard Process Time Calculation Box */}
          <div className="border border-slate-300 p-4">
            <h2 className="text-xs font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-3">
              01. Parâmetros de Tempo de Processo (Extraídos Automaticamente da Ficha Técnica)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs font-mono tabular-nums">
              <div>
                <div className="text-slate-500 font-sans">Tempo Unitário Padrão</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">{op.unit_process_time_minutes} min / un</div>
              </div>
              <div>
                <div className="text-slate-500 font-sans">Tempo de Setup</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">{op.setup_time_minutes} min</div>
              </div>
              <div>
                <div className="text-slate-500 font-sans">Carga Total Planejada</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {op.planned_total_minutes} min ({(op.planned_total_minutes / 60).toFixed(1)} h)
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-sans">Tempo Real Apurado</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {op.actual_total_minutes ? `${op.actual_total_minutes} min (${(op.actual_total_minutes / 60).toFixed(1)} h)` : 'Em apuração'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-sans">Período de Capacidade</div>
                <div className="text-xs font-semibold text-slate-900 mt-0.5">
                  {op.capacity_period_code || 'CAP-2026-10'}
                </div>
              </div>
            </div>
          </div>

          {/* Bill of Materials (Matérias-Primas Necessárias) */}
          <div className="border border-slate-300 p-4">
            <h2 className="text-xs font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-3">
              02. Relação de Matérias-Primas e Insumos Requisitados (Ficha Técnica)
            </h2>
            {op.bom && op.bom.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600">
                    <th className="py-2 pr-3 font-semibold">Cód. MP</th>
                    <th className="py-2 px-3 font-semibold">Descrição da Matéria-Prima</th>
                    <th className="py-2 px-3 font-semibold">Aplicação / Etapa</th>
                    <th className="py-2 px-3 text-right font-semibold">Consumo Unit.</th>
                    <th className="py-2 pl-3 text-right font-semibold">Total p/ Lote ({op.quantity} un)</th>
                    <th className="py-2 pl-3 text-center font-semibold">Conferência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                  {op.bom.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-3 font-semibold text-slate-900">{item.material_code}</td>
                      <td className="py-2 px-3 font-sans text-slate-800">{item.material_name}</td>
                      <td className="py-2 px-3 font-sans text-slate-600">{item.stage_notes || 'Processo Geral'}</td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {item.quantity_required} {item.material_unit}
                      </td>
                      <td className="py-2 pl-3 text-right font-bold text-slate-900">
                        {item.total_required} {item.material_unit}
                      </td>
                      <td className="py-2 pl-3 text-center font-sans">
                        {op.materials_deducted ? 'Baixado' : '[   ] OK'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-slate-500">Nenhuma matéria-prima especificada na ficha técnica deste produto.</p>
            )}
          </div>

          {/* Technical Instructions & Inspection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-slate-300 p-4">
              <h2 className="text-xs font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-2">
                03. Instruções Técnicas e Controle de Qualidade
              </h2>
              <p className="text-xs text-slate-700 leading-relaxed">
                {op.product_technical_notes || 'Executar usinagem e montagem conforme desenho técnico revisado. Conferir tolerâncias dimensionais antes da liberação.'}
              </p>
              <div className="mt-3 pt-2 border-t border-slate-200 text-xs text-slate-600">
                <div>Etapa Atual: <strong className="text-slate-900">{op.current_stage}</strong></div>
                {op.completion_notes && (
                  <div className="mt-1">Registro de Baixa: <strong className="text-slate-900">{op.completion_notes}</strong></div>
                )}
              </div>
            </div>

            <div className="border border-slate-300 p-4">
              <h2 className="text-xs font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-2">
                04. Roteiro de Apontamento no Chão de Fábrica
              </h2>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-1">
                  <span className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5 text-slate-400" /> Separação de Matéria-Prima</span>
                  <span className="font-mono text-slate-500">Data/Hora: ___/___ ___:___</span>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-1">
                  <span className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5 text-slate-400" /> Preparação / Setup ({op.setup_time_minutes} min)</span>
                  <span className="font-mono text-slate-500">Data/Hora: ___/___ ___:___</span>
                </div>
                <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-1">
                  <span className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5 text-slate-400" /> Processamento / Usinagem / Montagem</span>
                  <span className="font-mono text-slate-500">Data/Hora: ___/___ ___:___</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5 text-slate-400" /> Inspeção Dimensional e Baixa Final</span>
                  <span className="font-mono text-slate-500">
                    {op.completed_at ? formatDate(op.completed_at) : 'Data/Hora: ___/___ ___:___'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Signatures Footer */}
          <div className="pt-8 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
            <div className="border-t border-slate-900 pt-2">
              <div className="font-semibold text-slate-900">{op.technical_responsible}</div>
              <div className="text-slate-600 font-mono">{op.technical_crea} — Responsável Técnico pela Ordem</div>
              <div className="text-slate-500 mt-0.5">
                Documento impresso por: {currentUser.name} ({currentUser.crea_registro})
              </div>
            </div>
            <div className="border-t border-slate-900 pt-2">
              <div className="font-semibold text-slate-900">Operador / Inspetor de Qualidade Responsável</div>
              <div className="text-slate-600">Assinatura de Conformidade na Baixa da Produção</div>
              <div className="text-slate-500 font-mono mt-0.5">
                Emissão em: {new Date().toLocaleString('pt-BR')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
