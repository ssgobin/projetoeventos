/* eslint-disable react-refresh/only-export-components */
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "../services/firebase";
import type { Usuario } from "../types";

type RegisterInput = {
  nomeEmpresa: string;
  nomeUsuario: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  firebaseUser: User | null;
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerEmpresa: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function makeFallbackCompanyName(email: string) {
  return email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = useCallback(async (user: User) => {
      const snap = await getDoc(doc(db, "usuarios", user.uid));
    if (snap.exists()) {
      const profile = { id: snap.id, ...snap.data() } as Usuario;
      setUsuario(profile);
      return profile;
    }

    const email = user.email || "";
    const nome = makeFallbackCompanyName(email);
    const profile: Omit<Usuario, "id" | "criadoEm"> = {
      empresaId: user.uid,
      nome,
      email,
      role: "empresaAdmin",
      ativo: true,
    };
    await setDoc(doc(db, "usuarios", user.uid), { ...profile, criadoEm: serverTimestamp() });
    await setDoc(
      doc(db, "empresas", user.uid),
      {
        nome,
        email,
        status: "ativa",
        plano: "starter",
        criadoEm: serverTimestamp(),
      },
      { merge: true }
    );
    const fullProfile = { id: user.uid, ...profile, criadoEm: serverTimestamp() } as Usuario;
    setUsuario(fullProfile);
    return fullProfile;
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUsuario(null);
        setLoading(false);
        return;
      }
      await loadUserProfile(user);
      setLoading(false);
    });
    return () => unsub();
  }, [loadUserProfile]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      setFirebaseUser(credential.user);
      await loadUserProfile(credential.user);
    } finally {
      setLoading(false);
    }
  }, [loadUserProfile]);

  const registerEmpresa = useCallback(async (input: RegisterInput) => {
    const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
    const empresaRef = doc(db, "empresas", credential.user.uid);
    await setDoc(empresaRef, {
      nome: input.nomeEmpresa,
      email: input.email,
      status: "ativa",
      plano: "starter",
      criadoEm: serverTimestamp(),
    });
    await setDoc(doc(db, "usuarios", credential.user.uid), {
      empresaId: empresaRef.id,
      nome: input.nomeUsuario,
      email: input.email,
      role: "empresaAdmin",
      ativo: true,
      criadoEm: serverTimestamp(),
    });
    setFirebaseUser(credential.user);
    setUsuario({
      id: credential.user.uid,
      empresaId: empresaRef.id,
      nome: input.nomeUsuario,
      email: input.email,
      role: "empresaAdmin",
      ativo: true,
      criadoEm: serverTimestamp(),
    } as Usuario);
  }, []);

  const value = useMemo(
    () => ({ firebaseUser, usuario, loading, login, registerEmpresa, logout: () => signOut(auth) }),
    [firebaseUser, usuario, loading, login, registerEmpresa]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider.");
  return context;
}
