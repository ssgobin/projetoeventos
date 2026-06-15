import admin from "firebase-admin";

function getServiceAccount() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) return undefined;

  try {
    const serviceAccount = JSON.parse(rawServiceAccount) as Record<string, string | undefined>;
    const projectId = serviceAccount.project_id || serviceAccount.projectId;
    const clientEmail = serviceAccount.client_email || serviceAccount.clientEmail;
    const privateKey = serviceAccount.private_key || serviceAccount.privateKey;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON precisa conter "project_id", "client_email" e "private_key".');
    }

    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON não é um JSON válido. Cole o JSON completo da conta de serviço em uma única linha.", { cause: error });
    }
    throw error;
  }
}

export function getAdmin() {
  if (!admin.apps.length) {
    const serviceAccount = getServiceAccount();
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "projetoeventos-c6466",
      });
    } else {
      admin.initializeApp({ projectId: "projetoeventos-c6466" });
    }
  }
  return admin;
}

export async function getAuthedUser(authHeader?: string) {
  const token = authHeader?.replace("Bearer ", "");
  if (!token) throw new Error("AUTH_REQUIRED");
  const app = getAdmin();
  const decoded = await app.auth().verifyIdToken(token);
  const userSnap = await app.firestore().collection("usuarios").doc(decoded.uid).get();
  if (!userSnap.exists || userSnap.data()?.ativo === false) throw new Error("FORBIDDEN");
  return { uid: decoded.uid, usuario: userSnap.data()! };
}

export function getAuthHeader(headers: Record<string, string | undefined>) {
  return headers.authorization || headers.Authorization;
}

export function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTH_REQUIRED") return 401;
  if (message === "FORBIDDEN") return 403;
  if (message.includes("FIREBASE_SERVICE_ACCOUNT_JSON") || message.includes("SMTP_")) return 500;
  return 500;
}

export function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
    body: JSON.stringify(body),
  };
}

export function assertSameCompany(usuario: FirebaseFirestore.DocumentData, empresaId: string) {
  if (usuario.role !== "adminGeral" && usuario.empresaId !== empresaId) throw new Error("FORBIDDEN");
}
