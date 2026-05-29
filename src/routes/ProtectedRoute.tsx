import { Navigate, Outlet } from "react-router-dom";
import { PageLoader } from "../components/ui/page-loader";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute() {
  const { firebaseUser, usuario, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!firebaseUser || !usuario || !usuario.ativo) return <Navigate to="/login" replace />;
  return <Outlet />;
}
