import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { BolaoProvider } from './contexts/BolaoContext'
import { BolaoLayout } from './components/BolaoLayout'
import { Layout } from './components/Layout'
import { AdminBolaoPage } from './pages/AdminBolaoPage'
import { ContaPage } from './pages/ContaPage'
import { ConvitePage } from './pages/ConvitePage'
import { CriarBolaoPage } from './pages/CriarBolaoPage'
import { LobbyPage } from './pages/LobbyPage'
import { PalpitesPage } from './pages/PalpitesPage'
import { ParticipantePalpitesPage } from './pages/ParticipantePalpitesPage'
import { PartidasPage } from './pages/PartidasPage'
import { RankingPage } from './pages/RankingPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--surface)',
              color: 'var(--t-hi)',
              border: '1px solid var(--gold-line)',
            },
          }}
        />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<LobbyPage />} />
            <Route path="criar" element={<CriarBolaoPage />} />
            <Route path="convite/:code" element={<ConvitePage />} />
            <Route path="conta" element={<ContaPage />} />
            <Route path="login" element={<Navigate to="/conta" replace />} />
          </Route>

          <Route path="b/:bolaoId" element={<BolaoProvider><BolaoLayout /></BolaoProvider>}>
            <Route index element={<RankingPage />} />
            <Route path="partidas" element={<PartidasPage />} />
            <Route path="palpites" element={<PalpitesPage />} />
            <Route path="palpites/:participanteId" element={<ParticipantePalpitesPage />} />
            <Route path="admin" element={<AdminBolaoPage />} />
          </Route>

          <Route path="partidas" element={<Navigate to="/" replace />} />
          <Route path="palpites" element={<Navigate to="/" replace />} />
          <Route path="palpites/:participanteId" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
