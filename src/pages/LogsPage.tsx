import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Card } from "../components/ui/card";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTime } from "../lib/utils";
import { db } from "../services/firebase";
import type { LogAuditoria } from "../types";

export default function LogsPage() {
  const { usuario } = useAuth();
  const [logs, setLogs] = useState<LogAuditoria[]>([]);

  useEffect(() => {
    if (!usuario) return;
    const filters = usuario.role === "adminGeral" ? [] : [where("empresaId", "==", usuario.empresaId)];
    getDocs(query(collection(db, "logs"), ...filters, orderBy("dataHora", "desc"), limit(50))).then((snap) => setLogs(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as LogAuditoria)));
  }, [usuario]);

  return (
    <div className="app-page">
      <div>
        <p className="page-kicker">Auditoria</p>
        <h1 className="page-title">Logs administrativos</h1>
        <p className="page-description">Auditoria básica de ações importantes.</p>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-violet-50 text-xs uppercase text-violet-950/60"><tr><th className="p-4">Data</th><th>Ação</th><th>Usuário</th><th>Detalhes</th></tr></thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-violet-100">
                  <td className="p-4">{formatDateTime(log.dataHora)}</td>
                  <td>{log.acao}</td>
                  <td>{log.usuarioId}</td>
                  <td><code className="text-xs">{JSON.stringify(log.detalhes || {})}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
