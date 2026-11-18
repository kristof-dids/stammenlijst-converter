// Builds the password-protected web version of the Stammenlijst Converter.
//
//   STAMMENLIJST_PASSWORD='…' node build.mjs "/pad/naar/stammenlijst-converter.html"
//
// The readable app never enters this repository: it is wrapped into a full HTML document,
// encrypted (AES-256-GCM, key from the password via PBKDF2-SHA256) and embedded in the login page,
// which is written to index.html — the only file GitHub Pages serves to visitors.
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv, createHash } from "node:crypto";

const source = process.argv[2];
const password = process.env.STAMMENLIJST_PASSWORD;
if (!source || !password) {
  console.error('Gebruik: STAMMENLIJST_PASSWORD=\'…\' node build.mjs "<pad naar stammenlijst-converter.html>"');
  process.exit(1);
}

const ITERATIONS = 600000;
const app = readFileSync(source, "utf8");
if (app.includes("�")) { console.error("De bron bevat een vervangteken (U+FFFD) — eerst herstellen."); process.exit(1); }

// the source is a page body (as published in a Claude artifact); give it a proper standalone document
const html = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
</head>
<body>
${app}
<script>
// web demo only: a sign-out link in the top bar, which also forgets a "remember me" key
(() => {
  const host = document.querySelector(".topright");
  if (!host) return;
  const a = document.createElement("button");
  a.type = "button";
  a.style.cssText = "appearance:none;border:none;background:none;padding:0;font:inherit;font-size:.74rem;color:var(--ink-muted);text-decoration:underline;text-underline-offset:2px;cursor:pointer;";
  a.dataset.nl = "Afmelden"; a.dataset.en = "Sign out";
  a.setAttribute("data-en", "Sign out");
  a.textContent = (typeof LANG !== "undefined" && LANG === "en") ? "Sign out" : "Afmelden";
  a.addEventListener("click", () => {
    try { localStorage.removeItem("stammenlijst:unlock"); } catch(e){}
    try { sessionStorage.removeItem("stammenlijst:unlock"); } catch(e){}
    location.reload();
  });
  host.insertBefore(a, host.firstChild);
})();
</script>
</body>
</html>
`;

// keep the salt of the previous build when the password is unchanged, so a key a visitor chose to
// remember keeps working after an update; a new password gets a new salt (old keys then fail)
function previousSalt(){
  try {
    const prev = readFileSync(new URL("./index.html", import.meta.url), "utf8").match(/const PAYLOAD = (\{.*?\});/);
    if (!prev) return null;
    const p = JSON.parse(prev[1]);
    const k = pbkdf2Sync(password, Buffer.from(p.salt, "base64"), p.iter, 32, "sha256");
    const ct = Buffer.from(p.ct, "base64");
    const d = createDecipheriv("aes-256-gcm", k, Buffer.from(p.iv, "base64"));
    d.setAuthTag(ct.subarray(ct.length - 16));
    d.update(ct.subarray(0, ct.length - 16)); d.final(); // throws when the password differs
    return Buffer.from(p.salt, "base64");
  } catch(e){ return null; }
}
const reused = previousSalt();
const salt = reused || randomBytes(16);
const iv = randomBytes(12);
const key = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
const cipher = createCipheriv("aes-256-gcm", key, iv);
const ct = Buffer.concat([cipher.update(html, "utf8"), cipher.final(), cipher.getAuthTag()]); // WebCrypto wants the tag appended

const payload = {
  id: createHash("sha256").update(ct).digest("hex").slice(0, 12), // per build, so an old session key is not reused
  iter: ITERATIONS,
  salt: salt.toString("base64"),
  iv: iv.toString("base64"),
  ct: ct.toString("base64"),
};

const template = readFileSync(new URL("./login.template.html", import.meta.url), "utf8");
const marker = "/*__PAYLOAD__*/null";
if (!template.includes(marker)) { console.error("Marker ontbreekt in login.template.html"); process.exit(1); }
writeFileSync(new URL("./index.html", import.meta.url), template.replace(marker, JSON.stringify(payload)));
console.log(`index.html geschreven — ${(ct.length / 1024).toFixed(0)} KB versleuteld, build ${payload.id}, ${reused ? "zelfde salt (onthouden logins blijven geldig)" : "nieuwe salt"}`);
