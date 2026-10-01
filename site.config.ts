// ─────────────────────────────────────────────────────────────
//  Edit this file to change the front page (3310.nz).
// ─────────────────────────────────────────────────────────────

export type Track =
  | { title: string; artist?: string; src: string } // audio file, e.g. "/music/song.mp3" (put it in public/music/)
  | { title: string; artist?: string; ringtone: string }; // RTTTL ringtone string, played as a square-wave beep

export const site = {
  name: "3310.nz",
  tagline: "connecting people since 2000",

  music: {
    // The phone's built-in player. Add your own MP3s to public/music/ and list them here.
    tracks: [
      {
        title: "Gran Vals",
        artist: "F. Tárrega",
        ringtone:
          "GranVals:d=4,o=5,b=180:8e6,8d6,f#,g#,8c#6,8b,d,e,8b,8a,c#,e,2a",
      },
      {
        title: "Boot Up",
        artist: "3310.nz",
        ringtone:
          "BootUp:d=8,o=5,b=150:c6,e6,g6,4c7,p,g6,4c7,p,16c6,16d6,16e6,16f6,4g6",
      },
      // { title: "My Song", artist: "Me", src: "/music/my-song.mp3" },
    ] as Track[],

    // Optional embed shown under the phone. Paste a normal link from
    // SoundCloud, Spotify, YouTube or Bandcamp's "embed" src. Leave "" to hide.
    embed: "",
  },
};
