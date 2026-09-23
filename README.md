# Before You Print

A browser-local PDF checker for invitations, posters and labels. Minimal interface, real PDF analysis, page previews, manual review checklist and portable reports. No API keys, account or backend processing required.

## Run

Requires Node.js 22 or newer for development.

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4321/. Set PORT to change the port. The development server binds to loopback by default. The included dist directory is already built; `node server.mjs` alone serves it.

## Use

1. Optionally expand Print settings to choose project type, intended size, DPI and safety margin before selecting a file.
2. Choose a PDF of up to 20 MB and 20 pages, or choose “Can you spot the mistakes? Try a sample” for an interactive challenge.
3. Select a finding or a numbered marker to see its explanation. Image, selectable-text and locatable date warnings are marked on the preview. Whole-page warnings are listed underneath. Numbers are stable across filters. The sample uses its own standard settings without changing yours.
4. Filter by severity or check type. Filters never remove findings from the exported report.
5. Open detected destinations yourself and confirm the contents. No URLs are automatically visited.
6. Complete your own review checklist and add notes.
7. Download report opens a report preview. Save the self-contained HTML file or print/save it as PDF through the browser. If an embedded browser blocks downloads, open the site in Chrome, Safari or Firefox.

The sample contains five detectable issues: unembedded standard fonts, missing declared bleed, text near the cutting edge, a 138-DPI QR image, and a Friday label on Saturday 26 September 2026. The QR encodes https://example.com. It is a sample, not a real invitation.

## Checks and limits

- Page dimensions: PDF trim box compared with requested size, allowing rotated orientation and 1 mm tolerance. With no target selected, dimensions are only recorded.
- Bleed: explicit TrimBox and BleedBox plus available MediaBox area. Tests for 3 mm on all four edges. Does not prove artwork fills bleed.
- Image resolution: effective DPI at placed PDF size, including transforms and rotations. Image masks and unmeasurable operations are flagged for manual review. Clipping, skew and complex graphics can produce approximate results.
- Text margins: estimated bounds of selectable horizontal text. Outlined, vertical and image text need manual review. Optional local English OCR reads the rendered page, including image and outlined text. OCR results and uncertainty remain visible. Text clipping is not fully modelled, so edge findings can include hidden or clipped content.
- Dates: English day–month–year or month–day–year with optional weekday; invalid dates and weekday mismatches flagged. Numeric dates are flagged as ambiguous. Multiple dates need human confirmation. Other formats may not be recognised. Date problems extracted by OCR are human-review findings, not certain errors.
- QR codes: attempts up to six per page, rendered at a maximum of 1,800 pixels on the longest side and 2.4 million pixels total. Small, unusual, low-contrast or crowded codes can be missed. Decodable does not mean correct or reachable. Only HTTP(S) destinations become clickable; external sites are opened by the user.
- PDF links: safe web links from PDF annotations are listed separately from QR codes.
- Spelling: British English Hunspell dictionary through nspell. Flags up to 15 unique unrecognised words per page and suggests alternatives. Supplied correct names and approved words are excluded. This is not grammar checking; real-word mistakes and omissions can be missed. OCR suggestions use words outside native text bounds with engine confidence of at least 65 to reduce duplicate false positives.
- Reference comparison: users supply up to eight correct full names, venue, event date and eight exact details. Normalised phrase presence in selectable text is a match; OCR matches and missing/close matches require confirmation. Presence anywhere does not verify placement, factual truth or absence of contradictory details. Numeric dates are treated as ambiguous. All comparisons stay local.
- Fonts: checks referenced page, form and annotation-appearance resources for font-program streams; supports composite descendants and Type 3 glyph data. Presence is not a validity, licensing or glyph-completeness check. Unused resources can be reported.
- Colours: identifies explicit source operators and declared colour spaces in content and resources (including images and forms). Flags RGB when CMYK is requested and reports output-profile presence. Does not validate ICC profiles, colour accuracy, spot-colour separations or physical output. Inline images/unsupported streams yield a partial-inspection notice.
- No ink-limit check, overprint check, barcode validation or PDF/X compliance certification.

An automated pass is never approval to print. Confirm production specifications with the printer and review a physical proof. Checklist confirmations are made by the user, not a professional reviewer. All warning findings remain in the report when acknowledged.

## Privacy

The browser reads local PDF bytes directly. No file uploads, analytics, remote AI calls, third-party fonts or automatic destination requests. All browser libraries, the English OCR model and the British English dictionary are bundled locally. The OCR worker uses no persistent recognition cache. The browser may cache static engine/model assets; PDF content and results remain in memory. Findings, artwork previews and notes exist in memory until refresh/close/reset. Exported reports include findings, extracted snippets, decoded destinations and notes; treat them as private documents.

The server only serves static files. It has no PDF upload endpoint, user database or payment service. It is a local preview server, not a production application server.

## Deploy manually

Upload **the contents of `dist/`** to a static host. Keep all of `vendor/` (including ocr/ and spelling/) and `samples/` intact. OCR requires its worker, WebAssembly binaries and eng.traineddata.gz. Serve .wasm as application/wasm where possible; serve .gz as a normal compressed asset without adding a second Content-Encoding layer. The app uses relative URLs and supports a repository subpath. Serve `.mjs` as JavaScript. Use HTTPS on a public site. Opening index.html with `file://` does not support the PDF worker reliably.

To use GitHub Pages, upload the contents of dist to the publishing branch's root (or a docs folder configured for Pages). Merely uploading the full source repository does not select the dist folder as a Pages source. No hosting account has been configured or deployment made.

## Commercial status

This is a working local beta. It has no checkout, paid-review queue, reviewer account, payment verification, email delivery or customer storage. The proposed ₹149 human-reviewed pilot is not being sold or fulfilled by this code. Before charging, arrange a qualified reviewer and connect a real payment and delivery workflow. Never market this limited checker as professional prepress certification.

## Development and verification

```sh
npm test
node scripts/sample.mjs
```

Fifteen tests cover the five known sample defects, actual QR decoding, valid multi-page rotated PDFs, size mismatches, invalid PDFs, page limits, date calculations, physical DPI transforms, bleed bounds, text margins and escaping/URL safety. Tests generate a fictional two-page fixture under tests/fixtures.

Source: dist/index.html, style.css, app.js, analyzer.js, checks.js, advanced.js, preflight.js and content-checks.js. Vendor rebuild: scripts/vendor.mjs. Third-party licences are retained in dist/vendor. PDF.js and Tesseract use Apache 2.0; pdf-lib, nspell and jsQR use MIT. The British English dictionary includes its own licence file in vendor/spelling/. Preserve every bundled licence. Test rendering uses the PDF.js optional @napi-rs/canvas dependency.

Modern browsers are required. Files with very complex graphics can take longer or exceed device memory despite file/page limits. The application is not hardened for untrusted production-scale workloads.

## Optional browser-agent support

If supported, a read-only WebMCP tool `read_print_findings` exposes the current findings and manual confirmation count. It cannot open files, approve documents or visit links. Valid and invalid filter cases were checked during development.

## Additional verification

The OCR integration test creates a raster-only invitation with a misspelled word, an incorrect surname and a weekday/date mismatch. It runs the real local Tesseract engine, verifies spelling suggestions, distinguishes OCR-based reference matches from selectable-text matches, and verifies the CMYK requirement warning for an RGB image. Additional tests cover font stream and output-profile presence, content-token parsing and coordinate mapping.

English OCR defaults on. It can be disabled separately from spelling for faster checks. A 90-second bound applies to each OCR operation; failures are reported explicitly and other checks continue. Decorative/low-resolution text and non-English scripts can be missed or misread.
