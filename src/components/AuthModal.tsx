import React, { useState } from 'react';
import { X, LogIn, UserPlus, Check } from 'lucide-react';
import { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  usersList: User[];
  onSelectUser: (user: User) => void;
  onUserRegistered: (user: User) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  usersList,
  onSelectUser,
  onUserRegistered,
  notify,
}) => {
  const [mode, setMode] = useState<'select' | 'login' | 'register'>('select');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Engenheiro de Produção',
    crea_registro: 'CREA-SP ',
  });

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na autenticação');
      onSelectUser(data.user);
      notify(`Responsável Técnico autenticado: ${data.user.name}`);
      onClose();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha no cadastro de usuário');
      onUserRegistered(data.user);
      notify(`Novo Responsável Técnico registrado e ativo: ${data.user.name}`);
      onClose();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Autenticação de Responsável Técnico
            </h3>
            <p className="text-xs text-slate-500">
              O profissional autenticado assina todas as Ordens de Produção e Relatórios
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
          <button
            type="button"
            onClick={() => setMode('select')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer ${
              mode === 'select' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Troca Rápida
          </button>
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Login com Senha
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded cursor-pointer ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Novo Credenciamento
          </button>
        </div>

        {mode === 'select' && (
          <div className="space-y-2.5">
            <p className="text-xs text-slate-600">
              Selecione um Responsável Técnico credenciado na planta:
            </p>
            {usersList.map((u) => {
              const isCurrent = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    onSelectUser(u);
                    notify(`Sessão alterada para ${u.name} (${u.crea_registro})`);
                    onClose();
                  }}
                  className={`w-full text-left p-3 rounded-md border transition-colors flex items-center justify-between cursor-pointer ${
                    isCurrent
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-900">{u.name}</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {u.role} · <span className="font-mono">{u.crea_registro}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                  </div>
                  {isCurrent && (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Ativo
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Corporativo *</label>
              <input
                type="email"
                required
                placeholder="carlos.mendes@forjaindustrial.com.br"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Senha de Acesso * (Padrão demo: 123456)</label>
              <input
                type="password"
                required
                placeholder="••••••"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" /> Autenticar Responsável Técnico
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo e Título *</label>
              <input
                type="text"
                required
                placeholder="Ex: Eng. Marcos Vinícius Rocha"
                value={regForm.name}
                onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cargo Técnico *</label>
                <input
                  type="text"
                  required
                  value={regForm.role}
                  onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registro CREA / CFT *</label>
                <input
                  type="text"
                  required
                  placeholder="CREA-SP 508112233"
                  value={regForm.crea_registro}
                  onChange={(e) => setRegForm({ ...regForm, crea_registro: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail *</label>
              <input
                type="email"
                required
                placeholder="marcos@forjaindustrial.com.br"
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Definir Senha *</label>
              <input
                type="password"
                required
                placeholder="Mínimo 6 caracteres"
                value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Cadastrar e Assumir Responsabilidade
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
