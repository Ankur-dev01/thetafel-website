# Verwerkersovereenkomst — The Tafel

**Versie 1.0 — geldig vanaf 1 juni 2026**

> **CONCEPT — vereist juridische controle door een Nederlandse advocaat vóór publieke lancering.**

Deze verwerkersovereenkomst is van toepassing op elke verwerking van persoonsgegevens door **Ontwikkeling Tech Services**, ingeschreven bij de Kamer van Koophandel onder nummer `42027611`, handelend onder de naam **"The Tafel"** (hierna: "The Tafel" of "verwerker"), namens een Restaurant (hierna: "Restaurant" of "verwerkingsverantwoordelijke"). Deze overeenkomst voldoet aan artikel 28 lid 3 van Verordening (EU) 2016/679 (AVG / GDPR).

## 1. Rollen

Het Restaurant treedt op als **verwerkingsverantwoordelijke**. The Tafel treedt op als **verwerker** en handelt op grond van de gedocumenteerde instructies van het Restaurant zoals neergelegd in de Overeenkomst, deze verwerkersovereenkomst en de standaardconfiguratie van het platform.

## 2. Onderwerp, aard en duur

The Tafel verwerkt persoonsgegevens uitsluitend om de Diensten te leveren. Doeleinden zijn: het aannemen en beheren van reserveringen; het verwerken van afhaal- en QR-bestellingen; het versturen van reserveringsbevestigingen, herinneringen en no-show-meldingen; het ondersteunen van de dagelijkse bedrijfsvoering; het produceren van operationele analytics voor het dashboard van het Restaurant; en in geaggregeerde, geanonimiseerde vorm het verbeteren van de Diensten.

De verwerking duurt voort gedurende de looptijd van de Overeenkomst en eindigt overeenkomstig artikel 9.

## 3. Categorieën van persoonsgegevens

The Tafel verwerkt namens het Restaurant:

- **contactgegevens van gasten:** naam, e-mailadres, telefoonnummer;
- **reserveringsgegevens:** datum, tijd, groepsgrootte, tafelvoorkeur, bijzondere wensen, dieetwensen;
- **bestelgegevens:** bestelde items, opgegeven allergenen, bestelmomenten, tafelsessiegegevens;
- **communicatiemetadata:** bezorgstatus van bevestigingen, herinneringen en meldingen;
- **beperkte betaalgegevens** die door Mollie worden teruggegeven (zoals de laatste vier cijfers van een kaart, uitsluitend voor weergave). The Tafel slaat geen volledige kaartnummers, CVV-codes of IBAN's op.

Er worden geen bijzondere categorieën van persoonsgegevens in de zin van artikel 9 AVG opzettelijk verwerkt. Het Restaurant verbindt zich ertoe dergelijke gegevens niet via de vrije-tekstvelden van het platform in te voeren.

## 4. Categorieën van betrokkenen

De betrokkenen zijn de gasten van het Restaurant (waaronder, voor zover geregistreerd, walk-ins) en de medewerkers van het Restaurant die toegang krijgen tot het platform.

## 5. Verplichtingen van The Tafel (verwerker)

5.1 **Gedocumenteerde instructies.** The Tafel verwerkt persoonsgegevens uitsluitend op gedocumenteerde instructies van het Restaurant. Indien The Tafel op grond van Unie- of Nederlands recht tot afwijkende verwerking verplicht is, stelt zij het Restaurant daarvan vooraf op de hoogte, tenzij die wetgeving deze kennisgeving om gewichtige redenen van algemeen belang verbiedt.

5.2 **Vertrouwelijkheid.** Alle door The Tafel gemachtigde personen die persoonsgegevens verwerken zijn gebonden aan passende geheimhoudingsverplichtingen.

5.3 **Beveiligingsmaatregelen (artikel 32 AVG).** The Tafel treft passende technische en organisatorische maatregelen om een op het risico afgestemd beveiligingsniveau te waarborgen, waaronder:

- versleuteling van gegevens tijdens verzending met TLS 1.2 of hoger;
- versleuteling van gegevens in rust met AES-256 door de databaseprovider;
- rij-niveau-toegangscontroles in de database;
- secret-management via het environment-variable-systeem van het hostingplatform, nooit in broncode;
- regelmatige geautomatiseerde back-ups met een rotatie van maximaal 90 dagen;
- toegangslogging en audit trails;
- het principe van minimale rechten voor medewerkers en opdrachtnemers;
- jaarlijkse herziening van beveiligingsmaatregelen en tijdig patchen van bekende kwetsbaarheden.

5.4 **Sub-verwerkers.** The Tafel maakt gebruik van de sub-verwerkers genoemd in de bijlage. Door ondertekening van de Overeenkomst verleent het Restaurant aan The Tafel algemene schriftelijke toestemming als bedoeld in artikel 28 lid 2 AVG om deze sub-verwerkers in te schakelen. The Tafel kondigt iedere voorgenomen toevoeging of vervanging ten minste 30 dagen van tevoren schriftelijk aan. Het Restaurant kan binnen die termijn op redelijke gronden bezwaar maken. Indien Partijen geen overeenstemming bereiken, kan het Restaurant de Overeenkomst beëindigen met ingang van de datum waarop de wijziging zou ingaan. The Tafel legt aan elke sub-verwerker gegevensbeschermingsverplichtingen op die niet minder beschermend zijn dan die in deze verwerkersovereenkomst.

5.5 **Bijstand bij rechten van betrokkenen.** Rekening houdend met de aard van de verwerking verleent The Tafel het Restaurant door middel van passende maatregelen voor zover mogelijk bijstand bij het beantwoorden van verzoeken van betrokkenen onder de artikelen 12 tot en met 23 AVG.

5.6 **Bijstand bij beveiliging en datalekken.** The Tafel verleent het Restaurant bijstand bij het nakomen van zijn verplichtingen onder de artikelen 32 tot en met 36 AVG, rekening houdend met de aard van de verwerking en de aan The Tafel beschikbare informatie.

5.7 **Datalekken.** The Tafel stelt het Restaurant zonder onredelijke vertraging en in elk geval binnen **48 uur** na kennisname in kennis van een inbreuk in verband met persoonsgegevens die de namens het Restaurant verwerkte gegevens treft. De kennisgeving bevat, voor zover dan bekend: de aard van de inbreuk; de categorieën en het bij benadering aantal betrokken personen en gegevensrecords; de waarschijnlijke gevolgen; en de genomen of voorgestelde maatregelen.

5.8 **Nalevingsdocumentatie.** Eénmaal per periode van 12 maanden zal The Tafel op schriftelijk verzoek van het Restaurant haar dan geldende beveiligings- en nalevingsdocumentatie verstrekken, waaronder een samenvatting van de in artikel 5.3 genoemde technische en organisatorische maatregelen, de lijst van sub-verwerkers, en op dat moment geldende beveiligingscertificeringen van derden. Deze documentatie geldt in plaats van een on-site audit. Indien het Restaurant een gedocumenteerde wettelijke of toezichtsrechtelijke verplichting heeft die uitdrukkelijk een on-site audit vereist en aantoont dat de verstrekte documentatie onvoldoende is, zullen Partijen in goed overleg reikwijdte, tijdstip en redelijke kosten overeenkomen.

5.9 **Informatieplicht.** The Tafel stelt het Restaurant alle informatie ter beschikking die nodig is om de naleving van deze verwerkersovereenkomst aan te tonen.

## 6. Internationale doorgiften

Bepaalde in de bijlage genoemde sub-verwerkers kunnen persoonsgegevens verwerken buiten de Europese Economische Ruimte. Voor elke dergelijke doorgifte beroept The Tafel zich op een passend doorgiftemechanisme op grond van hoofdstuk V AVG, te weten: een adequaatheidsbesluit (waaronder het EU-VS Data Privacy Framework waar van toepassing) of de standaardcontractbepalingen vastgesteld bij Uitvoeringsbesluit (EU) 2021/914.

## 7. Wissing of teruggave bij beëindiging

Binnen 30 dagen na beëindiging van de Overeenkomst zal The Tafel, naar schriftelijke keuze van het Restaurant uitgebracht voor de beëindigingsdatum, alle namens het Restaurant verwerkte persoonsgegevens wissen of teruggeven. Back-ups met persoonsgegevens worden verwijderd overeenkomstig de standaard back-uprotatiecyclus en in elk geval binnen 90 dagen. The Tafel mag persoonsgegevens bewaren voor zover Nederlands belastingrecht of ander dwingend recht dat vereist (zoals de bewaartermijn van 7 jaar voor commerciële administratie); de bewaarde gegevens blijven onderworpen aan deze verwerkersovereenkomst.

## 8. Tegenstrijdigheid

In geval van tegenstrijdigheid tussen deze verwerkersovereenkomst en enige andere bepaling van de Overeenkomst prevaleert deze verwerkersovereenkomst op het gebied van de verwerking van persoonsgegevens.

## 9. Looptijd

Deze verwerkersovereenkomst treedt in werking op de Ingangsdatum van de Overeenkomst en blijft van kracht zolang The Tafel persoonsgegevens verwerkt namens het Restaurant. De artikelen 5.7, 5.9, 6 en 7 blijven na beëindiging van kracht voor zover dat nodig is om aan hun bepalingen te voldoen.

---

## Bijlage — Sub-verwerkers

The Tafel maakt gebruik van de volgende sub-verwerkers om de Diensten te leveren. The Tafel kondigt iedere toevoeging of vervanging ten minste 30 dagen van tevoren schriftelijk aan.

| # | Sub-verwerker | Rol | Verwerkingslocatie | Doorgiftemechanisme |
|---|---|---|---|---|
| 1 | Supabase Inc. | Database, authenticatie, bestandsopslag | EU (regio Frankfurt) | N.v.t. — binnen de EER |
| 2 | Mollie B.V. | Betaalverwerking, mandaatbeheer | Nederland | N.v.t. — binnen de EER |
| 3 | Vercel Inc. | Applicatiehosting, edge delivery | EU primair; wereldwijde edge | EU-standaardcontractbepalingen (2021/914) + EU-VS Data Privacy Framework |
| 4 | Resend, Inc. | Verzending van transactionele e-mails | Verenigde Staten | EU-standaardcontractbepalingen (2021/914) + EU-VS Data Privacy Framework |
| 5 | Upstash, Inc. | Caching en rate-limiting | EU (regio Frankfurt) | EU-standaardcontractbepalingen (2021/914) voor de Amerikaanse moederentiteit |
| 6 | Meta Platforms Ireland Limited | WhatsApp Business Cloud API voor reserveringsbevestigingen en herinneringen | Ierland (EU) met Amerikaanse entiteit | EU-standaardcontractbepalingen (2021/914) + EU-VS Data Privacy Framework |
