/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ErpState, User, ProductionOrder } from './types';
import { PainelView } from './components/PainelView';
import { ProducaoView } from './components/ProducaoView';
import { CadastrosView } from './components/CadastrosView';
import { RelatoriosView } from './components/RelatoriosView';
import { PrintableOPModal } from './components/PrintableOPModal';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [state, setState] = useState<ErpState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation State
  const [activeSection, setActiveSection] = useState<'painel' | 'producao' | 'cadastros' | 'relatorios'>('painel');
  const [producaoSubTab, setProducaoSubTab] = useState<'pedidos' | 'ordens'>('ordens');
  const [cadastrosSubTab, setCadastrosSubTab] = useState<'fichas' | 'materias' | 'clientes' | 'fornecedores' | 'capacidade'>('fichas');

  // Authenticated Technical Responsible User State
  const [currentUser, setCurrentUser] = useState<User>({
    id: 1,
    name: 'Eng. Carlos Eduardo Mendes',
    email: 'carlos.mendes@forjaindustrial.com.br',
    role: 'Engenheiro Chefe de Produção',
    crea_registro: 'CREA-SP 5069182340',
    created_at: new Date().toISOString(),
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Printable OP Modal State
  const [printableOp, setPrintableOp] = useState<ProductionOrder | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((prev) => (prev?.msg === msg ? null : prev));
    }, 4500);
  };

  const fetchState = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Falha ao conectar com o banco de dados relacional.');
      const data: ErpState = await res.json();
      setState(data);
      if (data.users && data.users.length > 0) {
        const matched = data.users.find((u) => u.id === currentUser.id) || data.users[0];
        setCurrentUser(matched);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro de comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const handleNavigate = (
    section: 'painel' | 'producao' | 'cadastros' | 'relatorios',
    subTab?: string
  ) => {
    setActiveSection(section);
    if (section === 'producao' && (subTab === 'pedidos' || subTab === 'ordens')) {
      setProducaoSubTab(subTab);
    }
    if (
      section === 'cadastros' &&
      (subTab === 'fichas' ||
        subTab === 'materias' ||
        subTab === 'clientes' ||
        subTab === 'fornecedores' ||
        subTab === 'capacidade')
    ) {
      setCadastrosSubTab(subTab);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#painel"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('painel');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap"
        >
          Forja Industrial
        </a>

        {/* Zone 2: 4-5 clean text navigation links */}
        <nav className="flex items-center gap-6 text-xs sm:text-sm font-medium text-slate-600 overflow-x-auto">
          <button
            onClick={() => setActiveSection('painel')}
            className={`py-1 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'painel'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-amber-600'
                : 'hover:text-slate-900'
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => {
              setActiveSection('producao');
              setProducaoSubTab('ordens');
            }}
            className={`py-1 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'producao' && producaoSubTab === 'ordens'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-amber-600'
                : 'hover:text-slate-900'
            }`}
          >
            Ordens de Produção
          </button>
          <button
            onClick={() => {
              setActiveSection('producao');
              setProducaoSubTab('pedidos');
            }}
            className={`py-1 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'producao' && producaoSubTab === 'pedidos'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-amber-600'
                : 'hover:text-slate-900'
            }`}
          >
            Pedidos
          </button>
          <button
            onClick={() => setActiveSection('cadastros')}
            className={`py-1 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'cadastros'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-amber-600'
                : 'hover:text-slate-900'
            }`}
          >
            Cadastros Base
          </button>
          <button
            onClick={() => setActiveSection('relatorios')}
            className={`py-1 transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'relatorios'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-amber-600'
                : 'hover:text-slate-900'
            }`}
          >
            Relatórios & Saídas
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions (Authenticated Technical Responsible selector) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer whitespace-nowrap truncate max-w-64"
            title="Clique para trocar ou autenticar Responsável Técnico"
          >
            Resp. Técnico: {currentUser.name}
          </button>
        </div>
      </header>

      {/* Feedback Toast Banner */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md no-print">
          <div
            className={`px-4 py-3 rounded-md shadow-lg border text-xs font-semibold flex items-center justify-between gap-4 ${
              toast.type === 'error'
                ? 'bg-red-900 text-white border-red-700'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            <span>{toast.msg}</span>
            <button
              onClick={() => setToast(null)}
              className="text-slate-300 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6">
        {loading && !state ? (
          <div className="space-y-4">
            <div className="h-28 bg-slate-200/70 animate-pulse rounded-lg" />
            <div className="h-96 bg-slate-200/70 animate-pulse rounded-lg" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-xs text-red-800 space-y-3">
            <div className="font-semibold text-sm">Erro ao carregar banco de dados do ERP</div>
            <p>{error}</p>
            <button
              onClick={fetchState}
              className="px-4 py-2 bg-red-700 text-white font-semibold rounded cursor-pointer"
            >
              Tentar Novamente
            </button>
          </div>
        ) : state ? (
          <>
            {activeSection === 'painel' && (
              <PainelView
                state={state}
                currentUser={currentUser}
                onNavigate={handleNavigate}
                onPrintOP={(op) => setPrintableOp(op)}
                onRefreshState={setState}
                notify={notify}
              />
            )}

            {activeSection === 'producao' && (
              <ProducaoView
                state={state}
                currentUser={currentUser}
                activeSubTab={producaoSubTab}
                setActiveSubTab={setProducaoSubTab}
                onRefreshState={setState}
                onPrintOP={(op) => setPrintableOp(op)}
                notify={notify}
              />
            )}

            {activeSection === 'cadastros' && (
              <CadastrosView
                state={state}
                currentUser={currentUser}
                activeSubTab={cadastrosSubTab}
                setActiveSubTab={setCadastrosSubTab}
                onRefreshState={setState}
                notify={notify}
              />
            )}

            {activeSection === 'relatorios' && (
              <RelatoriosView
                state={state}
                currentUser={currentUser}
                onPrintOP={(op) => setPrintableOp(op)}
              />
            )}
          </>
        ) : null}
      </main>

      {/* Quiet Footer with Authenticated Technical Responsible Attribution */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2 no-print">
        <div>
          <span>Forja Industrial — Sistema Integrado de Planejamento e Controle da Produção (ERP)</span>
        </div>
        <div>
          <span>Responsável Técnico Autenticado: <strong className="text-slate-800">{currentUser.name}</strong></span>
          <span className="mx-2">·</span>
          <span className="font-mono">{currentUser.crea_registro}</span>
          <span className="mx-2">·</span>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="text-amber-700 hover:underline font-medium cursor-pointer"
          >
            Alterar credencial
          </button>
        </div>
      </footer>

      {/* Printable Production Order Modal */}
      <PrintableOPModal
        op={printableOp}
        currentUser={currentUser}
        onClose={() => setPrintableOp(null)}
      />

      {/* Technical Responsible Authentication Modal */}
      {state && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          currentUser={currentUser}
          usersList={state.users}
          onSelectUser={(u) => setCurrentUser(u)}
          onUserRegistered={(newUser) => {
            setCurrentUser(newUser);
            fetchState();
          }}
          notify={notify}
        />
      )}
    </div>
  );
}
