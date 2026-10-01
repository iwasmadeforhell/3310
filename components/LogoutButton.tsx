"use client";
import { logout } from "./useLogin";

export default function LogoutButton({ className, label = "Log out", next = "/login" }: { className?: string; label?: string; next?: string }) {
  return (
    <button type="button" className={className} onClick={() => logout(next)}>
      {label}
    </button>
  );
}
