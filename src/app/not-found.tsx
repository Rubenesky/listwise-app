import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center px-4">
      <div className="flex flex-col items-center gap-2">
        <span className="text-8xl font-bold text-muted-foreground/30">404</span>
        <h1 className="text-2xl font-semibold">Página no encontrada</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          La página que buscas no existe o fue movida.
        </p>
      </div>
      <Link
        href="/"
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-5 py-2 text-sm font-medium transition-colors"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
