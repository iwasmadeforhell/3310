/** The poster's display name, styled like a forum rank: gradient text on a dark chip. */
export const DISPLAY_NAME = "Nokia";

export default function UserName() {
  return (
    <span className="old-user">
      <span>{DISPLAY_NAME}</span>
    </span>
  );
}
