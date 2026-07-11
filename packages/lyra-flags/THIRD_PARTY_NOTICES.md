# Third-party notices

`flags/*.svg` are vendored from Google's **Noto Emoji** project, unmodified:

- Source: <https://github.com/googlefonts/noto-emoji>
- Path: `third_party/region-flags/waved-svg/`
- Commit: `8998f5dd683424a73e2314a8c1f1e359c19e8742` (2025-09-12)
- Upstream license file: `third_party/region-flags/LICENSE`

Each SVG was renamed from its Unicode regional-indicator codepoint pair (e.g.
`emoji_u1f1eb_1f1f7.svg`) to its lowercase ISO 3166-1 alpha-2 code (`fr.svg`) — a 1:1,
byte-identical copy otherwise.

## Upstream `README.third_party`

```
URL: https://github.com/googlei18n/region-flags/archive/743e1f4a92b7d2dac49d7e6af509af63a71f0b45.zip
Version: 743e1f4a92b7d2dac49d7e6af509af63a71f0b45
License: Public Domain
License File: LICENSE

Description:
A collection of flags for BCP 47 region codes.

Local Modifications:
The COPYING file is renamed LICENSE.

Only the flags themselves and the related legal files are included. The
scripts used for their downloading and manipulation are not included.
```

## Upstream `LICENSE`

```
== Copying ==

The flags in this package were downloaded from Wikipedia and checked to be in
Public Domain or otherwise exempt from Copyright.  In particular, the following
are not explicitly tagged as "public_domain" or were tagged according to some
national law which made them Public Domain in that nation (e.g. `{{PD-AM-exempt}}`)

	AM	https://commons.wikimedia.org/wiki/File:Flag_of_Armenia.svg
	AZ	https://commons.wikimedia.org/wiki/File:Flag_of_Azerbaijan.svg
	JE	https://commons.wikimedia.org/wiki/File:Flag_of_Jersey.svg
	KG	https://commons.wikimedia.org/wiki/File:Flag_of_Kyrgyzstan.svg
	KZ	https://commons.wikimedia.org/wiki/File:Flag_of_Kazakhstan.svg
	MD	https://commons.wikimedia.org/wiki/File:Flag_of_Moldova.svg
	MX	https://commons.wikimedia.org/wiki/File:Flag_of_Mexico.svg
	MY	https://commons.wikimedia.org/wiki/File:Flag_of_Malaysia.svg
	RS	https://commons.wikimedia.org/wiki/File:Flag_of_Serbia.svg
	YT	https://commons.wikimedia.org/wiki/File:Flag_of_Mayotte_(local).svg

	US-SD	https://commons.wikimedia.org/wiki/File:Flag_of_South_Dakota.svg
	US-UT	https://commons.wikimedia.org/wiki/File:Flag_of_Utah.svg

	MX-AGU	https://commons.wikimedia.org/wiki/File:Flag_of_Aguascalientes.svg
	MX-BCN	https://commons.wikimedia.org/wiki/File:Flag_of_Baja_California.svg
	MX-BCS	https://commons.wikimedia.org/wiki/File:Flag_of_Baja_California_Sur.svg
	MX-CAM	https://commons.wikimedia.org/wiki/File:Flag_of_Campeche.svg
	MX-CHH	https://commons.wikimedia.org/wiki/File:Flag_of_Chihuahua.svg
	MX-CHP	https://commons.wikimedia.org/wiki/File:Flag_of_Chiapas.svg
	MX-CMX	https://commons.wikimedia.org/wiki/File:Flag_of_Mexican_Federal_District.svg
	MX-COA	https://commons.wikimedia.org/wiki/File:Flag_of_Coahuila.svg
	MX-COL	https://commons.wikimedia.org/wiki/File:Flag_of_Colima.svg
	MX-DUR	https://commons.wikimedia.org/wiki/File:Flag_of_Durango.svg
	MX-GRO	https://commons.wikimedia.org/wiki/File:Flag_of_Guerrero.svg
	MX-GUA	https://commons.wikimedia.org/wiki/File:Flag_of_Guanajuato.svg
	MX-HID	https://commons.wikimedia.org/wiki/File:Flag_of_Hidalgo.svg
	MX-JAL	https://commons.wikimedia.org/wiki/File:Flag_of_Jalisco.svg
	MX-MEX	https://commons.wikimedia.org/wiki/File:Flag_of_México.svg
	MX-MIC	https://commons.wikimedia.org/wiki/File:Flag_of_Michoacan.svg
	MX-MOR	https://commons.wikimedia.org/wiki/File:Flag_of_Morelos.svg
	MX-NAY	https://commons.wikimedia.org/wiki/File:Flag_of_Nayarit.svg
	MX-NLE	https://commons.wikimedia.org/wiki/File:Flag_of_Nuevo_Leon.svg
	MX-OAX	https://commons.wikimedia.org/wiki/File:Flag_of_Oaxaca.svg
	MX-PUE	https://commons.wikimedia.org/wiki/File:Flag_of_Puebla.svg
	MX-QUE	https://commons.wikimedia.org/wiki/File:Flag_of_Queretaro.svg
	MX-ROO	https://commons.wikimedia.org/wiki/File:Flag_of_Quintana_Roo.svg
	MX-SIN	https://commons.wikimedia.org/wiki/File:Flag_of_Sinaloa.svg
	MX-SLP	https://commons.wikimedia.org/wiki/File:Flag_of_San_Luis_Potosi.svg
	MX-SON	https://commons.wikimedia.org/wiki/File:Flag_of_Sonora.svg
	MX-TAB	https://commons.wikimedia.org/wiki/File:Flag_of_Tabasco.svg
	MX-TAM	https://commons.wikimedia.org/wiki/File:Flag_of_Tamaulipas.svg
	MX-TLA	https://commons.wikimedia.org/wiki/File:Flag_of_Tlaxcala.svg
	MX-VER	https://commons.wikimedia.org/wiki/File:Flag_of_Veracruz.svg
	MX-YUC	https://commons.wikimedia.org/wiki/File:Flag_of_Yucatan.svg
	MX-ZAC	https://commons.wikimedia.org/wiki/File:Flag_of_Zacatecas.svg

For individual details, revision history, and information on contributors, see
files in `html/`.
```

> `lyra-flags` only ships the 249 country/territory-level flags (no `US-*`/`MX-*`
> subdivision flags), so most of the entries above don't apply to this package's
> content — the full text is reproduced verbatim for traceability.

## Upstream `AUTHORS`

```
Shervin Afshar
Behdad Esfahbod
Behnam Esfahbod
Roozbeh Pournader
```
