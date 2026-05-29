import admin from "firebase-admin";

export function getAdmin() {
  if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount)),
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
