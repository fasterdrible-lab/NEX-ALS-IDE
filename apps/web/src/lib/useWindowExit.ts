import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ipc } from './ipc'

/**
 * Saída das telas de tela cheia (IDE, Terminal, Explorer, Incident, Deploy…).
 * Com tela anterior nesta janela: volta para ela.
 * Sem tela anterior ('default' = primeira entrada do histórico): numa janela independente
 * (⎋ / Incident / Deploy) fecha a janela; na principal (ex.: recarregou nesta tela) vai para o início.
 * `closes` diz se o clique vai fechar a janela — para o rótulo do botão.
 */
export function useWindowExit(): { leave: () => void; standalone: boolean; closes: boolean } {
  const navigate = useNavigate()
  const location = useLocation()
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    let alive = true
    ipc.window.info().then(r => { if (alive) setStandalone(!r.isMain) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const first = location.key === 'default'
  const leave = () => {
    if (!first) navigate(-1)
    else if (standalone) void ipc.window.closeSelf()
    else navigate('/')
  }
  return { leave, standalone, closes: first && standalone }
}
