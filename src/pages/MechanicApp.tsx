import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import {
  Wrench,
  Car,
  KeyRound,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  User,
  Star,
  ChevronRight,
  ChevronLeft,
  Check,
  RefreshCw,
  Sparkles,
  Smartphone,
} from 'lucide-react'

// ─── Configuração de API ───────────────────────────────────────────────────────
const getApiBase = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3002'
  }
  return import.meta.env.VITE_API_URL || 'https://mecanicapro-backend.vercel.app'
}
const API_BASE = getApiBase()

// ─── Etapas disponíveis ────────────────────────────────────────────────────────
const STEPS = [
  { id: 'Recebendo Veículo', label: 'Recebimento', desc: 'Chegada na oficina e conferência', icon: Car, color: '#818cf8', status: 'IN_PROGRESS' },
  { id: 'Diagnóstico Inicial', label: 'Diagnóstico', desc: 'Inspeção técnica e rastreamento', icon: Search, color: '#a78bfa', status: 'IN_PROGRESS' },
  { id: 'Aguardando Aprovação', label: 'Aguardando', desc: 'Aguardando confirmação do cliente', icon: Clock, color: '#fbbf24', status: 'IN_PROGRESS' },
  { id: 'Em Manutenção', label: 'Manutenção', desc: 'Serviço em andamento na bancada', icon: Wrench, color: '#60a5fa', status: 'IN_PROGRESS' },
  { id: 'Teste e Inspeção Final', label: 'Testes', desc: 'Validação e teste de rodagem', icon: CheckCircle2, color: '#34d399', status: 'IN_PROGRESS' },
  { id: 'Pronto para Retirada', label: 'Pronto', desc: 'Veículo finalizado e liberado', icon: Star, color: '#4ade80', status: 'FINISHED' },
]

export default function MechanicApp() {
  // Slug da oficina extraído da URL (Ex: /fj-diesel)
  const [slug] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.replace(/^\/+|\/+$/g, '')
      return p.split('/')[0] || ''
    }
    return ''
  })
  const [slugLoading, setSlugLoading] = useState(false)
  const [slugError, setSlugError] = useState('')

  // Auth state
  const [login, setLogin] = useState('mecanico')
  const [pin, setPin] = useState(['', '', '', ''])
  const [rememberAuth, setRememberAuth] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]

  // Session state
  const [isLogged, setIsLogged] = useState(false)
  const [company, setCompany] = useState<{ name: string; logoUrl: string | null } | null>(null)
  const [currentMechanic, setCurrentMechanic] = useState<{ name: string; login: string } | null>(null)
  const [ordersList, setOrdersList] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')

  // Active Order Detail state
  const [activeOrder, setActiveOrder] = useState<any>(null)
  const [selectedStep, setSelectedStep] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Se a rota contiver o slug da oficina (ex: /fj-diesel), busca a identidade oficial da empresa
  useEffect(() => {
    if (slug) {
      setSlugLoading(true)
      axios
        .get(`${API_BASE}/mechanic/company/${slug}`)
        .then((res) => {
          setCompany({ name: res.data.name, logoUrl: res.data.logoUrl })
        })
        .catch((err) => {
          setSlugError(err.response?.data?.message || 'Oficina não encontrada para este link.')
        })
        .finally(() => {
          setSlugLoading(false)
        })
    }
  }, [slug])

  // Carrega credenciais salvas no dispositivo
  useEffect(() => {
    try {
      const savedPin = localStorage.getItem('mechanic_app_pin')
      const savedLogin = localStorage.getItem('mechanic_app_login')
      if (savedLogin) setLogin(savedLogin)
      if (savedPin && savedPin.length === 4) {
        setPin(savedPin.split(''))
      }
    } catch (e) {
      // silencia
    }
  }, [])

  // ── PIN Handlers ─────────────────────────────────────────────────────────────
  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const next = [...pin]
    next[index] = value.slice(-1)
    setPin(next)
    if (value && index < 3) pinRefs[index + 1].current?.focus()
  }

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      const next = [...pin]
      next[index - 1] = ''
      setPin(next)
      pinRefs[index - 1].current?.focus()
    }
  }

  const handlePinPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (text.length === 4) {
      setPin(text.split(''))
      pinRefs[3].current?.focus()
    }
    e.preventDefault()
  }

  // ── Login com Isolamento Multi-Tenant ─────────────────────────────────────────
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    const pinStr = pin.join('')
    if (!login.trim()) {
      setAuthError('Preencha o usuário do mecânico.')
      return
    }
    if (pinStr.length < 4) {
      setAuthError('Preencha os 4 dígitos da senha (PIN da oficina).')
      return
    }

    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await axios.post(`${API_BASE}/mechanic/auth`, {
        login: login.trim().toLowerCase(),
        pin: pinStr,
        companySlug: slug || undefined,
      })

      if (rememberAuth) {
        try {
          localStorage.setItem('mechanic_app_login', login.trim().toLowerCase())
          localStorage.setItem('mechanic_app_pin', pinStr)
        } catch (e) {}
      }

      setCompany(res.data.company)
      if (res.data.mechanic) {
        setCurrentMechanic(res.data.mechanic)
      }
      setOrdersList(res.data.orders || [])
      setIsLogged(true)
    } catch (err: any) {
      setAuthError(
        err.response?.data?.message ||
          'Login ou Senha (PIN) incorretos. Confirme com o responsável da oficina.',
      )
    } finally {
      setAuthLoading(false)
    }
  }

  // Recarregar lista de veículos da oficina
  const refreshOrders = async () => {
    setLoadingOrders(true)
    try {
      const pinStr = pin.join('')
      const res = await axios.post(`${API_BASE}/mechanic/orders-list`, {
        pin: pinStr,
        companySlug: slug || undefined,
      })
      setOrdersList(res.data.orders || [])
      if (res.data.company) setCompany(res.data.company)
    } catch (err) {
      console.error('Erro ao atualizar lista', err)
    } finally {
      setLoadingOrders(false)
    }
  }

  // Selecionar veículo para editar
  const selectOrder = (orderItem: any) => {
    setActiveOrder(orderItem)
    setSelectedStep(orderItem.mechanicStep || '')
    setNotes(orderItem.mechanicNotes || '')
    setSaveError('')
    setSaveSuccess(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const [finishedNotice, setFinishedNotice] = useState<string>('')

  // Atualizar etapa com reflexo instantâneo
  const handleUpdateStep = async () => {
    if (!selectedStep) {
      setSaveError('Selecione uma etapa antes de atualizar.')
      return
    }
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      const pinStr = pin.join('')
      const step = STEPS.find((s) => s.id === selectedStep)
      const isFinishing =
        selectedStep === 'Pronto para Retirada' ||
        step?.status === 'FINISHED' ||
        step?.status === 'WAITING_PAYMENT'

      await axios.patch(`${API_BASE}/mechanic/orders/${activeOrder.id}/step`, {
        pin: pinStr,
        mechanicStep: selectedStep,
        mechanicNotes: notes.trim() || undefined,
        status: isFinishing ? 'FINISHED' : step?.status,
      })

      setSaveSuccess(true)

      if (isFinishing) {
        // Veículo finalizado/entregue: remove da lista do mecânico imediatamente
        const plateInfo = activeOrder.vehicle?.plate ? `(${activeOrder.vehicle.plate})` : ''
        setFinishedNotice(
          `Veículo ${plateInfo} finalizado com sucesso! Liberado e retirado da bancada do mecânico.`,
        )
        setOrdersList((prev) => prev.filter((o) => o.id !== activeOrder.id))

        setTimeout(() => {
          setActiveOrder(null)
          setSaveSuccess(false)
        }, 1200)
      } else {
        // Atualiza estado local imediatamente para etapas em andamento
        setActiveOrder((prev: any) => ({
          ...prev,
          mechanicStep: selectedStep,
          mechanicNotes: notes.trim() || null,
          status: step?.status || prev.status,
        }))

        // Atualiza na lista de veículos
        setOrdersList((prev) =>
          prev.map((o) =>
            o.id === activeOrder.id
              ? {
                  ...o,
                  mechanicStep: selectedStep,
                  mechanicNotes: notes.trim() || null,
                  status: step?.status || o.status,
                }
              : o,
          ),
        )

        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (err: any) {
      setSaveError(err.response?.data?.message || 'Erro ao salvar etapa.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    setIsLogged(false)
    setActiveOrder(null)
    setOrdersList([])
    setCurrentMechanic(null)
  }

  // Filtro de veículos:
  // Regra inegociável: Veículos já terminados, entregues, pagos ou com pagamento pendente NÃO aparecem para os mecânicos.
  const filteredOrders = ordersList.filter((o) => {
    if (o.isPaid) return false
    if (['FINISHED', 'CANCELED', 'WAITING_PAYMENT'].includes(o.status)) return false
    if (o.mechanicStep === 'Pronto para Retirada') return false

    const q = searchFilter.trim().toLowerCase()
    if (!q) return true
    const plate = o.vehicle?.plate?.toLowerCase() || ''
    const model = o.vehicle?.model?.toLowerCase() || ''
    const customer = o.customer?.name?.toLowerCase() || ''
    const osNum = String(o.orderNumber || '')
    return plate.includes(q) || model.includes(q) || customer.includes(q) || osNum.includes(q)
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // TELA DE LOGIN (MOBILE-FIRST COM IDENTIDADE DA OFICINA)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isLogged) {
    if (slugLoading) {
      return (
        <div className="mobile-viewport">
          <div className="login-card" style={{ textAlign: 'center', minHeight: '60vh', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <Loader2 size={36} className="spin text-indigo-400" />
              <p style={{ fontSize: '14px', color: '#94a3b8' }}>Carregando dados da oficina...</p>
            </div>
          </div>
          <style>{styles}</style>
        </div>
      )
    }

    if (slugError) {
      return (
        <div className="mobile-viewport">
          <div className="login-card">
            <div className="brand-header">
              <div className="brand-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                <AlertCircle size={26} color="#f87171" />
              </div>
              <h1 className="brand-name">Link Não Encontrado</h1>
              <p className="brand-sub">{slugError}</p>
            </div>
            <div className="form-body text-center">
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                O link acessado <code>/{slug}</code> não corresponde a nenhuma oficina cadastrada no sistema.
              </p>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                Solicite o link correto ao gerente ou proprietário da sua oficina.
              </p>
            </div>
          </div>
          <style>{styles}</style>
        </div>
      )
    }

    return (
      <div className="mobile-viewport">
        <div className="login-card">
          {/* Header Marca */}
          <div className="brand-header">
            {company?.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={company.name}
                style={{
                  maxHeight: '56px',
                  maxWidth: '180px',
                  objectFit: 'contain',
                  marginBottom: '12px',
                  borderRadius: '10px',
                }}
              />
            ) : (
              <div className="brand-badge">
                <Wrench size={26} color="#818cf8" />
              </div>
            )}
            <h1 className="brand-name">
              {company?.name ? company.name : 'App do Mecânico'}
            </h1>
            <p className="brand-sub">
              {company?.name ? 'Acesso dos Mecânicos da Oficina' : 'Acesso exclusivo para funcionários'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="form-body">
            {/* Campo Login */}
            <div className="input-group">
              <label className="input-label">
                <User size={14} />
                Login do Mecânico
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Ex: seu usuário ou mecanico"
                className="input-text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <span className="input-hint">Digite seu login cadastrado na oficina (ex: joao, carlos ou mecanico)</span>
            </div>

            {/* Campo Senha (PIN de 4 dígitos) */}
            <div className="input-group">
              <label className="input-label">
                <KeyRound size={14} />
                Senha (PIN Fixo da Oficina)
              </label>
              <div className="pin-container">
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={pinRefs[i]}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(i, e)}
                    onPaste={handlePinPaste}
                    className="pin-box"
                  />
                ))}
              </div>
            </div>

            {/* Opção lembrar login */}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={rememberAuth}
                onChange={(e) => setRememberAuth(e.target.checked)}
                className="custom-checkbox"
              />
              <span>Lembrar meus dados neste celular</span>
            </label>

            {/* Mensagem de Erro */}
            {authError && (
              <div className="alert-box alert-error">
                <AlertCircle size={16} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Botão Entrar */}
            <button type="submit" disabled={authLoading} className="btn-submit">
              {authLoading ? <Loader2 size={18} className="spin" /> : <ChevronRight size={18} />}
              {authLoading ? 'Verificando...' : 'Entrar no Sistema'}
            </button>
          </form>

          {/* Rodapé informativo */}
          <div className="login-footer">
            <Smartphone size={14} />
            <span>App responsivo para uso direto na oficina</span>
          </div>
        </div>

        <style>{styles}</style>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TELA DE DETALHES DO VEÍCULO SELECIONADO
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeOrder) {
    return (
      <div className="mobile-viewport">
        <div className="screen-container">
          {/* Topbar compacta */}
          <header className="mobile-header">
            <button onClick={() => setActiveOrder(null)} className="btn-back">
              <ChevronLeft size={20} />
              <span>Veículos</span>
            </button>
            <div className="header-info">
              <span className="header-title">{company?.name || 'Oficina'}</span>
              <span className="header-sub">OS #{activeOrder.orderNumber || activeOrder.id?.slice(0, 5)}</span>
            </div>
            <button onClick={handleLogout} className="btn-logout-icon" title="Sair">
              <LogOut size={16} />
            </button>
          </header>

          {/* Card do Veículo */}
          <section className="vehicle-hero-card">
            <div className="plate-badge">
              <span className="plate-flag">BRASIL</span>
              <span className="plate-text">{activeOrder.vehicle?.plate || 'SEM PLACA'}</span>
            </div>
            <div className="vehicle-meta">
              <h2 className="vehicle-model">{activeOrder.vehicle?.brand} {activeOrder.vehicle?.model}</h2>
              <p className="vehicle-sub">
                {activeOrder.vehicle?.year ? `${activeOrder.vehicle.year} · ` : ''}
                {activeOrder.vehicle?.color ? `${activeOrder.vehicle.color} · ` : ''}
                Cliente: <strong>{activeOrder.customer?.name || 'Não informado'}</strong>
              </p>
              {activeOrder.description && (
                <div className="service-desc">
                  <span>Serviço:</span> {activeOrder.description}
                </div>
              )}
            </div>
          </section>

          {/* Seleção de Etapa */}
          <section className="section-block">
            <div className="section-title-row">
              <h3 className="section-title">Etapa do Serviço</h3>
              <span className="live-tag">
                <span className="live-dot" /> Instantâneo
              </span>
            </div>

            <div className="steps-vertical-list">
              {STEPS.map((step) => {
                const isSelected = selectedStep === step.id
                const StepIcon = step.icon
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setSelectedStep(step.id)}
                    className={`step-item ${isSelected ? 'step-selected' : ''}`}
                    style={{
                      borderColor: isSelected ? step.color : 'rgba(255,255,255,0.08)',
                      backgroundColor: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div
                      className="step-icon-box"
                      style={{
                        backgroundColor: isSelected ? step.color : 'rgba(255,255,255,0.08)',
                        color: isSelected ? '#0f0f1a' : step.color,
                      }}
                    >
                      <StepIcon size={18} />
                    </div>
                    <div className="step-content">
                      <span className="step-label">{step.id}</span>
                      <span className="step-desc">{step.desc}</span>
                    </div>
                    {isSelected && (
                      <div className="step-check-mark" style={{ backgroundColor: step.color }}>
                        <Check size={14} color="#0f0f1a" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Observações do Mecânico */}
          <section className="section-block">
            <h3 className="section-title">Observação Técnica (Opcional)</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Peça chegou e iniciamos a montagem do cabeçote..."
              rows={3}
              className="notes-textarea"
            />
          </section>

          {/* Feedback */}
          {saveSuccess && (
            <div className="alert-box alert-success">
              <CheckCircle2 size={16} />
              <span>Atualizado com sucesso em tempo real!</span>
            </div>
          )}
          {saveError && (
            <div className="alert-box alert-error">
              <AlertCircle size={16} />
              <span>{saveError}</span>
            </div>
          )}

          {/* Botão de Salvar Fixo / Destacado */}
          <div className="action-footer">
            <button
              type="button"
              onClick={handleUpdateStep}
              disabled={saving}
              className="btn-save-step"
            >
              {saving ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
              {saving ? 'Atualizando...' : 'Salvar e Notificar Cliente'}
            </button>
          </div>
        </div>

        <style>{styles}</style>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TELA PRINCIPAL: LISTA DE VEÍCULOS EM ATENDIMENTO NA OFICINA
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="mobile-viewport">
      <div className="screen-container">
        {/* Topbar */}
        <header className="mobile-header">
          <div className="header-left">
            <div className="brand-mini-icon">
              <Wrench size={16} color="#818cf8" />
            </div>
            <div>
              <h1 className="header-title">{company?.name || 'Oficina Mecânica'}</h1>
              <span className="header-sub">
                Mecânico: <strong>{currentMechanic?.name || login}</strong>
                {currentMechanic?.login && currentMechanic.login !== (currentMechanic.name || '').toLowerCase() && (
                  <span style={{ opacity: 0.7, marginLeft: '4px' }}>(@{currentMechanic.login})</span>
                )}
              </span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout" title="Sair do aplicativo">
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </header>

        {/* Banner comemorativo quando um veículo é finalizado */}
        {finishedNotice && (
          <div className="alert-box alert-success mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>{finishedNotice}</span>
            </div>
            <button
              onClick={() => setFinishedNotice('')}
              className="text-xs opacity-70 hover:opacity-100 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Barra de Busca de Veículos */}
        <div className="search-bar-row">
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar por placa, modelo ou OS..."
              className="search-input"
            />
            {searchFilter && (
              <button onClick={() => setSearchFilter('')} className="search-clear">
                ✕
              </button>
            )}
          </div>
          <button onClick={refreshOrders} disabled={loadingOrders} className="btn-refresh" title="Recarregar">
            <RefreshCw size={16} className={loadingOrders ? 'spin' : ''} />
          </button>
        </div>

        {/* Resumo / Contador */}
        <div className="orders-count-row">
          <span className="count-label">
            Veículos em atendimento: <strong>{filteredOrders.length}</strong>
          </span>
          <span className="count-status">Em tempo real</span>
        </div>

        {/* Lista de Veículos */}
        <div className="vehicles-list">
          {loadingOrders ? (
            <div className="empty-state">
              <Loader2 size={24} className="spin text-indigo-400" />
              <p>Atualizando veículos...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state">
              <Car size={32} color="#64748b" />
              <p>Nenhum veículo em andamento encontrado.</p>
              {searchFilter && <span className="empty-sub">Tente buscar por outro termo.</span>}
            </div>
          ) : (
            filteredOrders.map((orderItem) => {
              const currentStep = STEPS.find((s) => s.id === orderItem.mechanicStep)
              return (
                <div
                  key={orderItem.id}
                  onClick={() => selectOrder(orderItem)}
                  className="vehicle-card"
                >
                  <div className="card-top">
                    <div className="mini-plate">
                      {orderItem.vehicle?.plate || 'SEM PLACA'}
                    </div>
                    <span className="os-badge">OS #{orderItem.orderNumber || orderItem.id?.slice(0, 5)}</span>
                  </div>

                  <div className="card-body">
                    <h3 className="card-model">
                      {orderItem.vehicle?.brand} {orderItem.vehicle?.model}
                    </h3>
                    <p className="card-customer">
                      Cliente: {orderItem.customer?.name || 'Cliente'}
                    </p>
                    {orderItem.description && (
                      <p className="card-desc truncate">{orderItem.description}</p>
                    )}
                  </div>

                  <div className="card-footer">
                    <div
                      className="step-pill"
                      style={{
                        backgroundColor: currentStep ? `${currentStep.color}1a` : 'rgba(255,255,255,0.06)',
                        color: currentStep ? currentStep.color : '#94a3b8',
                      }}
                    >
                      <span className="step-pill-dot" style={{ backgroundColor: currentStep?.color || '#94a3b8' }} />
                      {orderItem.mechanicStep || 'Não iniciada'}
                    </div>

                    <span className="btn-tap">
                      Atualizar <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <style>{styles}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS MOBILE-FIRST RESPONSIVO
// ─────────────────────────────────────────────────────────────────────────────
const styles = `
  *, *::before, *::after {
    box-sizing: border-box;
  }

  /* Viewport Base */
  .mobile-viewport {
    min-height: 100dvh;
    width: 100%;
    background-color: #0b0c16;
    color: #f8fafc;
    display: flex;
    justify-content: center;
    padding: 0;
    box-sizing: border-box;
  }

  .screen-container {
    width: 100%;
    max-width: 480px;
    min-height: 100dvh;
    background: #0f1020;
    display: flex;
    flex-direction: column;
    padding-bottom: 24px;
    border-left: 1px solid rgba(255,255,255,0.04);
    border-right: 1px solid rgba(255,255,255,0.04);
    position: relative;
    box-sizing: border-box;
  }

  /* Tela de Login */
  .login-card {
    width: 100%;
    max-width: 420px;
    margin: auto;
    padding: 28px 20px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .brand-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 28px;
  }

  .brand-badge {
    width: 58px;
    height: 58px;
    border-radius: 16px;
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
    border: 1px solid rgba(129, 140, 248, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    box-shadow: 0 8px 24px -6px rgba(99, 102, 241, 0.4);
  }

  .brand-name {
    font-size: 22px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.02em;
  }

  .brand-sub {
    font-size: 13px;
    color: #94a3b8;
    margin-top: 4px;
  }

  .form-body {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 22px 18px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
    width: 100%;
    box-sizing: border-box;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    box-sizing: border-box;
  }

  .input-label {
    font-size: 12px;
    font-weight: 600;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .input-text {
    width: 100%;
    box-sizing: border-box;
    background: rgba(15, 16, 32, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 12px 14px;
    color: #ffffff;
    font-size: 15px;
    font-weight: 500;
    outline: none;
    transition: all 0.2s;
  }
  .input-text:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .input-hint {
    font-size: 11px;
    color: #64748b;
  }

  /* PIN input em Grid de 4 colunas perfeitas */
  .pin-container {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    width: 100%;
    margin-top: 4px;
    box-sizing: border-box;
  }

  .pin-box {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    height: 54px;
    box-sizing: border-box;
    background: rgba(15, 16, 32, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    text-align: center;
    font-size: 22px;
    font-weight: 800;
    color: #ffffff;
    outline: none;
    padding: 0;
    margin: 0;
    transition: all 0.2s;
  }
  .pin-box:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #94a3b8;
    cursor: pointer;
    user-select: none;
  }

  .custom-checkbox {
    accent-color: #6366f1;
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .btn-submit {
    width: 100%;
    background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
    border: none;
    border-radius: 14px;
    padding: 14px;
    color: #ffffff;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 8px 20px -4px rgba(99, 102, 241, 0.5);
    transition: transform 0.15s, opacity 0.15s;
  }
  .btn-submit:active {
    transform: scale(0.98);
  }

  .login-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 24px;
    font-size: 12px;
    color: #64748b;
  }

  /* Header Mobile */
  .mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(15, 16, 32, 0.85);
    backdrop-filter: blur(10px);
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brand-mini-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: rgba(99, 102, 241, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .header-title {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    display: block;
    line-height: 1.2;
  }

  .header-sub {
    font-size: 11px;
    color: #94a3b8;
  }

  .btn-logout {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 6px 10px;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-logout-icon {
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 8px;
    padding: 8px;
    color: #94a3b8;
    cursor: pointer;
  }

  .btn-back {
    display: flex;
    align-items: center;
    gap: 2px;
    background: transparent;
    border: none;
    color: #818cf8;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 0;
  }

  /* Barra de Pesquisa */
  .search-bar-row {
    display: flex;
    gap: 8px;
    padding: 12px 16px 6px;
  }

  .search-input-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    color: #64748b;
  }

  .search-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 10px 32px 10px 36px;
    font-size: 13px;
    color: #ffffff;
    outline: none;
  }
  .search-input:focus {
    border-color: #6366f1;
  }

  .search-clear {
    position: absolute;
    right: 10px;
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 12px;
  }

  .btn-refresh {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    cursor: pointer;
  }

  .orders-count-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 18px 10px;
    font-size: 11px;
    color: #64748b;
  }
  .count-status {
    color: #34d399;
    font-weight: 600;
  }

  /* Lista de Veículos */
  .vehicles-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 16px;
  }

  .vehicle-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;
    transition: transform 0.15s, border-color 0.15s, background-color 0.15s;
    user-select: none;
  }
  .vehicle-card:active {
    transform: scale(0.98);
    background: rgba(255, 255, 255, 0.05);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .mini-plate {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 3px 8px;
    font-family: monospace;
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 0.08em;
    color: #ffffff;
  }

  .os-badge {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 600;
    font-family: monospace;
  }

  .card-model {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
  }

  .card-customer {
    font-size: 12px;
    color: #94a3b8;
  }

  .card-desc {
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .step-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
  }

  .step-pill-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .btn-tap {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    font-weight: 600;
    color: #818cf8;
  }

  /* Tela de Detalhe / Hero */
  .vehicle-hero-card {
    margin: 16px 16px 8px;
    padding: 18px;
    border-radius: 18px;
    background: linear-gradient(135deg, rgba(30, 27, 75, 0.6) 0%, rgba(15, 23, 42, 0.6) 100%);
    border: 1px solid rgba(129, 140, 248, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .plate-badge {
    background: #0f172a;
    border: 2px solid #334155;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .plate-flag {
    display: block;
    background: #0284c7;
    color: #ffffff;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.1em;
    padding: 2px 14px;
  }

  .plate-text {
    display: block;
    font-family: monospace;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.15em;
    padding: 4px 16px;
    color: #f8fafc;
  }

  .vehicle-model {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
  }

  .vehicle-sub {
    font-size: 12px;
    color: #94a3b8;
    margin-top: 4px;
  }

  .service-desc {
    margin-top: 10px;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    font-size: 11px;
    color: #cbd5e1;
  }
  .service-desc span {
    font-weight: 600;
    color: #a5b4fc;
  }

  /* Seções */
  .section-block {
    padding: 12px 16px;
  }

  .section-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .live-tag {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 700;
    color: #34d399;
    background: rgba(52, 211, 153, 0.1);
    padding: 2px 8px;
    border-radius: 12px;
  }

  .live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 6px #34d399;
  }

  /* Etapas verticais estilo lista mobile */
  .steps-vertical-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .step-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 14px;
    border: 1px solid;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
  }
  .step-item:active {
    transform: scale(0.99);
  }

  .step-icon-box {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .step-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .step-label {
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
  }

  .step-desc {
    font-size: 11px;
    color: #94a3b8;
  }

  .step-check-mark {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .notes-textarea {
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 12px;
    color: #ffffff;
    font-size: 13px;
    outline: none;
    resize: none;
    font-family: inherit;
  }
  .notes-textarea:focus {
    border-color: #6366f1;
  }

  /* Rodapé de Ação Fixo */
  .action-footer {
    padding: 16px;
    margin-top: auto;
  }

  .btn-save-step {
    width: 100%;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border: none;
    border-radius: 14px;
    padding: 15px;
    color: #ffffff;
    font-size: 15px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    box-shadow: 0 8px 24px -4px rgba(16, 185, 129, 0.4);
    transition: transform 0.15s;
  }
  .btn-save-step:active {
    transform: scale(0.98);
  }

  /* Alertas */
  .alert-box {
    margin: 8px 16px;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .alert-success {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #6ee7b7;
  }

  .empty-state {
    padding: 40px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #64748b;
  }
  .empty-sub {
    font-size: 11px;
    color: #475569;
  }

  .spin {
    animation: spin 1s linear infinite;
  }
`
