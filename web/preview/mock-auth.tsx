import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import { AuthContext } from "../src/context/auth-context";

// ?logado=0 mostra a tela de login; ?admin=1 entra como admin.
export function AuthProvider({ children }: { children: ReactNode }) {
  const q = new URLSearchParams(window.location.search);
  const logged = q.get("logado") !== "0";
  const isAdmin = q.get("admin") === "1";
  const user = logged ? ({ uid: "demo", email: "contato@brilholimpeza.com.br" } as unknown as User) : null;
  return (
    <AuthContext.Provider
      value={{ user, loading: false, isAdmin, login: async () => {}, logout: async () => { window.location.search = "?logado=0"; } }}
    >
      {children}
    </AuthContext.Provider>
  );
}
