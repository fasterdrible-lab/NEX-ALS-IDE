import { useState } from 'react'
import { BotMessageSquare, Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function SetupPage() {
  const { setup } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    try {
      await setup(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600/20 rounded-2xl mb-4">
            <BotMessageSquare size={28} className="text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Configuração inicial</h1>
          <p className="text-slate-400 mt-2">Crie a conta de administrador para começar.</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          {error && (
            <div className="bg-red-900/30 border border-red-800/50 text-red-300 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="label">Nome de usuário</label>
            <input
              className="input"
              placeholder="admin"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label">Senha</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPw ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Confirmar senha</label>
            <input
              className="input"
              type={showPw ? 'text' : 'password'}
              placeholder="Repita a senha"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password || !confirm}
            className="btn-primary w-full justify-center"
          >
            {loading ? <><Loader2 size={15} className="animate-spin" /> Criando...</> : 'Criar conta e entrar'}
          </button>

          <p className="text-xs text-slate-600 text-center">
            Esta conta terá permissão total (admin). Você poderá criar outros usuários depois em Configurações.
          </p>
        </form>
      </div>
    </div>
  )
}
