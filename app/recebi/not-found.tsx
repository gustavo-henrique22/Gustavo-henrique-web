import { LinkIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/recebi/logo";
import { BASE_PATH } from "@/lib/recebi/config";

export default function RecebiNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-16 text-center">
      <div className="grid max-w-md justify-items-center gap-4">
        <Link href={BASE_PATH}>
          <Logo />
        </Link>
        <span className="grid size-14 place-items-center rounded-2xl bg-muted">
          <LinkIcon className="size-6 text-muted-foreground" />
        </span>
        <h1 className="text-2xl font-extrabold">Este link não está disponível</h1>
        <p className="text-sm text-muted-foreground">
          O endereço pode estar incompleto, ou o documento foi excluído por quem enviou. Se você recebeu este link de alguém, peça um novo.
        </p>
        <Button asChild>
          <Link href={BASE_PATH}>Conhecer o Recebi</Link>
        </Button>
      </div>
    </main>
  );
}
