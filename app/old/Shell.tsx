import { bumpHits, fmtDate, type Post } from "@/lib/posts";
import LogoutButton from "@/components/LogoutButton";

const root = () => process.env.ROOT_DOMAIN ?? "3310.nz";

function Counter({ n }: { n: number }) {
  return (
    <div className="old-counter" aria-label={`${n} visitors`}>
      {String(n).padStart(7, "0").split("").map((d, i) => (
        <span key={i}>{d}</span>
      ))}
    </div>
  );
}

export default async function Shell({
  children,
  isAdmin,
  latest,
  count = true,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  latest?: Post;
  count?: boolean;
}) {
  const hits = count ? await bumpHits().catch(() => 0) : 0;
  const r = root();
  return (
    <div className="old-wrap">
      <header className="old-banner">
        <a href="/" className="old-title">
          <span>~*</span> 3310.nz <span>*~</span>
        </a>
        <div className="old-sub">news ✿ updates ✿ random thoughts</div>
        <div className="old-marquee" aria-hidden>
          <span>
            ★ welcome 2 my lil corner of the web ★ sign in as admin to post ★{" "}
            {latest ? `latest: “${latest.title}” (${fmtDate(latest.createdAt)})` : "no news yet"} ★ thx for visiting ★
          </span>
        </div>
      </header>

      <div className="old-cols">
        <aside className="old-side">
          <div className="old-box">
            <div className="old-box-h">navigation</div>
            <ul className="old-nav">
              <li><a href="/">» home</a></li>
              <li><a href={`https://${r}`}>» main site</a></li>
              <li><a href={`https://portfolio.${r}`}>» portfolio</a></li>
              {isAdmin && <li><a href="/new">» new post</a></li>}
            </ul>
          </div>

          <div className="old-box">
            <div className="old-box-h">status</div>
            <p>
              <span className="old-blink">●</span> online
            </p>
            {latest?.mood && <p>mood: <i>{latest.mood}</i></p>}
          </div>

          <div className="old-box">
            <div className="old-box-h">u r visitor #</div>
            <Counter n={hits} />
          </div>

          <div className="old-box old-buttons">
            <div className="old-box-h">buttons</div>
            <span className="b88 b-a">3310.NZ</span>
            <span className="b88 b-b">WEB 1.0</span>
            <span className="b88 b-c">800×600</span>
            <span className="b88 b-d">♥ HTML</span>
            <span className="b88 b-e">NO COOKIES*</span>
            <span className="b88 b-f">GREEN LCD</span>
          </div>

          <div className="old-box">
            <div className="old-box-h">webring</div>
            <p className="old-ring">
              <a href={`https://${r}`}>« prev</a> | <a href="/">3310 ring</a> | <a href={`https://${r}`}>next »</a>
            </p>
          </div>
        </aside>

        <main className="old-main">{children}</main>
      </div>

      <div className="old-construction" aria-hidden>
        <span>⚠ always under construction ⚠</span>
      </div>
      <footer className="old-foot">
        <p>© {new Date().getFullYear()} 3310.nz · best viewed at 800×600 · made with ♥ and notepad</p>
        <p className="old-small">
          {isAdmin ? (
            <>
              logged in as admin · <a href="/new">new post</a> · <LogoutButton className="old-linkbtn" label="log out" next="/" />
            </>
          ) : (
            <a href="/login">admin login</a>
          )}
          {" · "}*except one, for the admin
        </p>
      </footer>
    </div>
  );
}
