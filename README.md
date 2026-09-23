# Stammenlijst Converter — webdemo

Afgeschermde webversie van de Stammenlijst Converter: stammenlijsten (CSV, XLS, XLSX, PDF) van
verschillende leveranciers omzetten naar één uniform bestand voor het ERP.

**Adres:** https://kristof-dids.github.io/stammenlijst-converter/

## Hoe de afscherming werkt

GitHub Pages is statische hosting zonder server, dus een login kan niet op de server gebeuren.
Daarom is de app zelf **versleuteld** (AES-256-GCM, sleutel afgeleid van het wachtwoord met
PBKDF2-SHA256, 600.000 iteraties). `index.html` bevat alleen de inlogpagina en de versleutelde app;
zonder wachtwoord is er niets leesbaars. Na het juiste wachtwoord ontsleutelt de browser de app.
De sleutel blijft enkel bewaard zolang het tabblad open is.

De leesbare broncode staat **niet** in deze repository.

## Privacy

Opgeladen bestanden worden volledig in de browser van de gebruiker verwerkt en nooit verstuurd.
Aangeleerde antwoorden (houtsoort, kwaliteit, leverancier…) worden per browser bewaard (localStorage).

## Bijwerken of het wachtwoord wijzigen

```bash
STAMMENLIJST_PASSWORD='nieuw-of-hetzelfde-wachtwoord' node build.mjs "<pad naar de leesbare stammenlijst-converter.html>"
git add index.html && git commit -m "Update webdemo" && git push
```

Elke build gebruikt een nieuwe salt en IV; wie nog ingelogd was, moet opnieuw inloggen.

## Bestanden

- `index.html` — gebouwd resultaat (inlogpagina + versleutelde app); dit serveert GitHub Pages.
- `login.template.html` — de inlogpagina, met een marker waar de versleutelde app in komt.
- `build.mjs` — bouwscript (Node, geen afhankelijkheden).
