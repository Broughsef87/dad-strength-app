/* dad strength — sign in. "pilot authentication". */
function SignInScreen({ onSignIn, theme }) {
  const { SignInCard, Eyebrow } = window.__DS;
  const mark = theme === "graphite" ? "../../assets/ds-mark-volt-graphite.svg" : "../../assets/ds-mark-volt.svg";
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src={mark} width="34" height="34" alt="" />
        <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.03em" }}>dad strength</span>
      </div>
      <SignInCard onAction={onSignIn} />
      <Eyebrow size="sm" style={{ textAlign: "center" }}>no gym. no time. one path.</Eyebrow>
    </div>
  );
}
window.SignInScreen = SignInScreen;
