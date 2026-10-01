import { cookies } from "next/headers";
import { unreadCount } from "@/lib/messages";
import { fmtDate, visitorCount, type Post } from "@/lib/posts";
import { THEME_COOKIE } from "@/lib/theme";
import { isAdmin, type PublicUser } from "@/lib/users";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "./ThemeToggle";
import UserName from "./UserName";

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
  me,
  latest,
  count = true,
}: {
  children: React.ReactNode;
  /** Whoever is logged in, or null for a visitor. */
  me: PublicUser | null;
  latest?: Post;
  count?: boolean;
}) {
  const [hits, unread] = await Promise.all([visitorCount(count).catch(() => 0), me ? unreadCount(me.id).catch(() => 0) : 0]);
  const dark = (await cookies()).get(THEME_COOKIE)?.value === "dark";
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
            ★ welcome 2 my lil corner of the web ★ register 2 post, like &amp; dislike ★{" "}
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
              <li><a href="/devlog">» devlog</a></li>
              <li><a href="/members">» member list</a></li>
              {me && <li><a href="/new">» new post</a></li>}
              {isAdmin(me) && <li><a href="/users">» manage members</a></li>}
            </ul>
          </div>

          <div className="old-box">
            <div className="old-box-h">{me ? "logged in" : "members"}</div>
            {me ? (
              <>
                <p>
                  hi <UserName user={me} />
                </p>
                <ul className="old-nav">
                  <li>
                    <a href="/messages" className={unread ? "old-hasmail" : ""}>
                      » messages{unread ? ` (${unread} new)` : ""}
                    </a>
                  </li>
                  <li><a href="/account">» my account</a></li>
                  <li><LogoutButton className="old-linkbtn" label="» log out" next="/" /></li>
                </ul>
              </>
            ) : (
              <ul className="old-nav">
                <li><a href="/register">» register</a></li>
                <li><a href="/login">» log in</a></li>
              </ul>
            )}
          </div>

          <div className="old-box">
            <div className="old-box-h">status</div>
            <p>
              <span className="old-blink">●</span> online
            </p>
            {latest?.mood && <p>mood: <i>{latest.mood}</i></p>}
            <ThemeToggle initialDark={dark} />
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
            <a className="b88-link" href="https://lucida.to" target="_blank" rel="noopener noreferrer" title="lucida.to">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/buttons/lucida.gif" width={88} height={31} alt="lucida" />
            </a>
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
          {me ? (
            <>
              logged in as <UserName user={me} /> · <a href="/new">new post</a> · <LogoutButton className="old-linkbtn" label="log out" next="/" />
            </>
          ) : (
            <>
              <a href="/register">register</a> · <a href="/login">log in</a>
            </>
          )}
          {" · "}*except one, to keep you logged in
        </p>
      </footer>
    </div>
  );
}
