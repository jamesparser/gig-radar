import Link from "next/link";
import { Logo } from "./ui";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="flex w-full flex-col items-center">
        <Link href="/" aria-label="GigRadar home" className="mb-8"><Logo /></Link>
        {children}
      </div>
    </main>
  );
}
