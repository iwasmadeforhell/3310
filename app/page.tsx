import { VT323 } from "next/font/google";
import Phone from "@/components/nokia/Phone";
import Galaxy from "@/components/nokia/Galaxy";
import { site } from "@/site.config";
import { toEmbed } from "@/lib/embed";
import "./nokia.css";

const pixel = VT323({ weight: "400", subsets: ["latin"], variable: "--pixel" });

export default function Home() {
  const embed = toEmbed(site.music.embed);
  const root = process.env.ROOT_DOMAIN ?? "3310.nz";

  return (
    <main className={`nk-page ${pixel.variable}`}>
      <Galaxy />
      <div className="nk-stage">
        <Phone />
        <p className="nk-hint">
          <kbd>↑</kbd> <kbd>↓</kbd> scroll · <kbd>enter</kbd> select · <kbd>esc</kbd> back
        </p>
      </div>

      {embed && (
        <section className="nk-embed" aria-label="Music">
          <div className="nk-embed-head">
            <span>♪ now playing</span>
            <span className="nk-eq" aria-hidden><i /><i /><i /><i /></span>
          </div>
          <iframe
            src={embed.src}
            height={embed.height}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            title="Music player"
          />
        </section>
      )}

      <nav className="nk-links">
        <a href={`https://portfolio.${root}`}>portfolio</a>
        <span>·</span>
        <a href={`https://drop.${root}`}>drop</a>
        <span>·</span>
        <a href={`https://old.${root}`}>old</a>
      </nav>
    </main>
  );
}
