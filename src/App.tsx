import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PageLoader } from "./components/ui/page-loader";
import { AppShell } from "./layouts/AppShell";
import { ProtectedRoute } from "./routes/ProtectedRoute";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const EventEditorPage = lazy(() => import("./pages/EventEditorPage"));
const FormBuilderPage = lazy(() => import("./pages/FormBuilderPage"));
const GuestsPage = lazy(() => import("./pages/GuestsPage"));
const CheckinPage = lazy(() => import("./pages/CheckinPage"));
const LogsPage = lazy(() => import("./pages/LogsPage"));
const PublicFormPage = lazy(() => import("./pages/PublicFormPage"));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/form/:eventoId" element={<PublicFormPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/eventos" element={<EventsPage />} />
              <Route path="/eventos/novo" element={<EventEditorPage />} />
              <Route path="/eventos/:eventoId" element={<EventEditorPage />} />
              <Route path="/eventos/:eventoId/formulario" element={<FormBuilderPage />} />
              <Route path="/eventos/:eventoId/inscritos" element={<GuestsPage />} />
              <Route path="/eventos/:eventoId/checkin" element={<CheckinPage />} />
              <Route path="/logs" element={<LogsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
