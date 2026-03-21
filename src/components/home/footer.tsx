import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="py-12 border-border border-t bg-background">
      <div className="mx-auto px-4 container">
        <div className="flex md:flex-row flex-col justify-between items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Riaya"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="font-bold text-gradient text-xl">رعاية</span>
          </Link>

          <nav className="flex gap-8">
            {["Features", "How it Works", "Pricing", "FAQ"].map((item) => (
              <a
                key={item}
                href={`/#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-muted-foreground hover:text-primary text-sm transition-colors"
              >
                {item}
              </a>
            ))}
          </nav>

          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} Riaya. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
