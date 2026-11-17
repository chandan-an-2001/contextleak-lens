# ContextLeak Lens

**See what your screenshots reveal before the world does.**

A browser-local screenshot privacy studio. Real English OCR locates visible private text; deterministic detectors and relationship rules explain possible exposure; an image editor replaces sensitive pixels with solid masks; verification scans the actual flattened PNG again.

No API keys, paid services, cloud OCR, database, application accounts, analytics, or image-upload endpoint. All example screenshots are original fictional data and go through real OCR.

## Run locally

Node.js 24 LTS is recommended. Node 22.12+ is also supported by the selected Vite release.

```sh
npm install
npm run dev
```

Open the printed local URL. For reproducible installs after cloning, use `npm ci`. Installation copies the OCR worker, all WebAssembly variants, and English language data from installed packages into `public/ocr`. No remote OCR or language downloads are needed at scan time. The initial OCR asset download can take a few seconds; image processing stays on the device.

```sh
npm test             # deterministic unit tests
npm run typecheck    # strict TypeScript verification
npm run lint         # TypeScript verification alias; no ESLint configured
npm run build        # type-check and production static build
npm run preview      # serve dist locally
npm run test:browser # actual OCR, editor, PNG verification, safe reports, upload and mobile tests
```

Browser tests automatically use system Chrome on Windows when available, otherwise the installed Playwright Chromium. Set PLAYWRIGHT_EXECUTABLE_PATH to another browser executable or PLAYWRIGHT_CHANNEL to a supported installed channel. Browser installation is not needed by the web application itself. Run the production build before browser tests. Screenshots and synthetic test downloads go to ignored test-results/.

## Validation

Validated on November 17, 2026: the production build and strict TypeScript check passed; all 68 unit tests and all five real-browser workflow tests passed. Browser checks cover real OCR for all three demos and a synthetic WhatsApp-style contact image, real PNG uploads, cancellation and retry, evidence graph selection, custom masks, movement/resizing and history, full-resolution export, opaque output pixels, fresh verification, values-free JSON, session clearing, mobile layout, and appearance settings. The contact workflow checks that both names and both phones are detected, the date is excluded from phone findings, and the exported name area contains solid opaque replacement pixels. The complete workflow also checks for third-party requests and uncaught browser errors.

The latest browser checks served the actual production assets from disk through a test-only Playwright request fixture because this execution environment restricts local TCP ports. Image decoding, OCR workers, detection, redaction, verification, and downloaded-file checks execute in the browser. The hosted publication requires its own deployment verification. Name candidates still require visual review; these synthetic checks do not establish a general precision or recall rate across real-world screenshots.

The production policy permits same-origin assets and local `blob:` image reads. The latter is necessary for Tesseract to read in-memory screenshots; it does not permit remote image uploads or third-party service requests.

## Working product features

- A responsive dark-first landing dashboard with an original focus/shield identity, interactive fictional example, upload area, three demonstrations, contextual-privacy explanation, FAQ, and privacy notice.
- Upload with drag/drop, file picker, and paste where supported. PNG, JPEG, and WebP signatures, MIME, size, decoding, dimensions, and pixel counts are validated. Limits: 20 MB, 24 megapixels, and 16,000 pixels on either edge.
- Pre-analysis image preview, replace, explicit scan/retry/cancel, progress, errors, and a manual editor that remains usable if OCR fails.
- Real Tesseract.js 7 worker OCR, locally served language and core assets, text/line/word coordinates, OCR confidence, and job cancellation. Newer uploads cannot be overwritten by stale jobs.
- Detectors for email, contact numbers, UPI candidates, Luhn-valid card candidates, labeled names and birth dates, contact-name candidates near phone numbers or in supported contact-list layouts, labeled bank-account candidates, transaction/order references, credential shapes and labels, JWT-shaped tokens, URL secrets, internal hosts, meeting links, labeled locations/schedules/browser titles, social handles, and organization-domain candidates. Recognizable calendar dates and explicit date/time/identifier fields are excluded from phone-number detection.
- Findings include severity, source coordinates, explanation, recommendations, method, and OCR confidence. The findings panel never reveals extracted values in full. Manual review is recorded without reducing risk.
- Five possible exposure relationships: identity/workplace, person/meeting/schedule, credential/account context, payment/identity, and location/identity. Every connection has evidence references, uncertainty wording, and an action. Interactive graph nodes focus corresponding image regions.
- Explainable 0–100 product-specific exposure scoring with severity and connection contributions, before/after comparison, coverage count, category summaries, and severity filters.
- Suggested opaque masks, individual redaction, custom rectangles, move, resize, delete, black/custom colors, 50-step undo/redo, zoom, fit, original preview, overlay toggle, panning, and keyboard operations. Touch drawing uses the same pointer-coordinate mapping.
- New full-resolution flattened PNG exports with opaque pixel replacement, no hidden original layers, and no copied original metadata.
- Fresh verification of the actual encoded/decoded PNG, with new OCR, new detection, remaining evidence, honest status wording, and stale-result invalidation when masks change.
- Safe JSON report, printable report/PDF via the browser, severity/category summaries, exposure scenarios, recommended actions, coverage estimate, and actual verification status. No raw OCR, detected values, original filename, or original screenshot is embedded in reports.
- Light/dark/system appearance, reduced motion, larger text, configurable mask padding and detection categories, mobile navigation, accessible labels/focus, live status, confirmation before clearing, and end-session cleanup.

## Architecture and files

| Path | Responsibility |
| --- | --- |
| `src/App.tsx` | In-memory session, screen navigation, job cancellation, ingestion, orchestration and cleanup |
| `src/types.ts` | Typed OCR, geometry, finding, inference, score, mask, image and verification contracts |
| `src/features/ocr.ts` | Local worker lifecycle, progress, timeout, cancellation, real line/word extraction |
| `src/features/detection.ts` | Transparent detector rules, masking policy, Luhn check and severity weights |
| `src/features/contactNames.ts` | Candidate contact names from nearby phone numbers and supported repeated contact layouts |
| `src/features/phoneNumbers.ts` | Calendar-date exclusion and phone-candidate context checks with preserved text offsets |
| `src/features/inference.ts` | Evidence-backed connections, scoring and optional future provider contract |
| `src/features/image.ts` | Validation, image decoding, opaque original-resolution rendering and PNG encoding |
| `src/features/report.ts` | Values-free report generation and limitation statements |
| `src/lib/geometry.ts` | Canonical image coordinates, clamp/padding, union coverage and verification signature |
| `src/hooks/useHistory.ts` | Immutable bounded history with undo, redo and branching |
| `src/components/` | Brand, sidebar, interactive image editor, findings panel and evidence graph |
| `src/pages/` | Dashboard/landing, report, settings and help/privacy screens |
| `src/data/demos.ts` | Canvas-generated fictional developer, meeting and job-offer screenshots |
| `src/styles/` | Responsive design system, studio, settings/help/report and print styles |
| `src/features/core.test.ts` | Deterministic detection, inference, scoring, geometry, history, report and input tests |
| `tests/workflow.spec.ts` | End-to-end OCR, upload, editor, re-verification, downloaded pixels, reports and mobile checks |
| `scripts/copy-ocr-assets.mjs` | Same-origin OCR assets generated during installation |
| `.github/workflows/pages.yml` | Unit-test, build and GitHub Pages deployment workflow |

Data flow: decoded screenshot → browser OCR worker → detector rules → evidence relationships → exposure score → opaque image-coordinate masks → newly encoded PNG → fresh OCR/detection/inference → values-free report and user-directed downloads.

Custom CSS replaces Tailwind/Motion because the interface needs no additional runtime styling or animation dependency. Lucide supplies consistent icons. All fonts use a local system stack. A production Content Security Policy restricts asset/worker/network origins; development removes that meta policy only to allow Vite's local refresh preamble. The app contains no backend.

## Rules and scoring

Critical = 25 points, high = 12, medium = 6, low = 2. Same-category overlapping findings contribute once at the highest severity. Each supported contextual scenario adds 8 points. The total is capped at 100. Weights are exported in `detection.ts`; relationship rules live in `inference.ts`. The score is an exposure estimate for this product, never a security certification or probability.

After masks change, findings are considered geometrically covered only if their complete detected box is covered by the union of masks. Partial coverage never resolves a finding. This is a coverage estimate; independent verification scans freshly encoded output pixels and can find different results. Verification is marked stale after any mask geometry/color/history change. Manual review does not remove a visible exposure.

Rule confidence is qualitative and based on the minimum OCR quality of supporting evidence. OCR percentages measure text recognition quality, not risk likelihood. Non-public-mail domains suggest a possible organization affiliation; no organization is looked up or verified. Card checksums and labels identify candidates, not real accounts or active credentials.

## Privacy and lifecycle

Image content, OCR results, original values and undo state stay in memory. Browser storage contains only one non-sensitive preferences record; OCR IndexedDB caching is disabled. The app does not persist analysis history. End-session aborts outstanding jobs, invalidates late async work, clears application state and history, releases image URLs, and terminates workers. Export and verification canvases are cleared after use. Downloaded files intentionally saved by the user are not deleted.

No screenshot, OCR text, report, credential, or personal detail is transmitted by the app. The host may log normal requests for HTML, scripts, language data, and WebAssembly; these paths do not carry screenshot data. There are no telemetry/error-reporting SDKs, remote fonts, external image requests, account lookups, face recognition or sensitive-trait inference. React renders text safely; recognized text is never injected as HTML or executed.

## Known limitations and future work

- Automated detection cannot guarantee privacy. Small, blurred, stylized, handwritten, rotated and non-English text can be missed. The UI always asks for manual review.
- Faces, QR/barcodes, unlabeled browser tabs/titles, sophisticated address formats, and contextual clues without a supported rule are not recognized automatically. Unlabeled names are checked near phone numbers or in repeated contact rows with a supported contact-list heading. These are layout-based candidates, including nicknames and organization labels, not verified identities. Other layouts, emoji-heavy names, and OCR errors may be missed; cover these manually. There is no deskew/orientation preprocessing, automatic face detection, PDF input, cloud model, or LLM inference.
- English OCR assets are bundled. Other languages and optional local model providers are future extensions, not current functionality. The future provider interface is deliberately unused.
- No offline service worker is installed. Once application/OCR assets are loaded, calculations are local; reopening without network may require a local static server.
- Original screenshots are visible while reviewing. Extensions, screen recordings, operating-system access, downloaded copies, and device/browser memory management are outside the app's control.
- Browser printing controls PDF creation; there is no server-side PDF generator. Clipboard paste depends on browser/OS support, with file upload always available.
- Future improvements: multilingual language selection, measured OCR preprocessing, tiled OCR for very large images, a clearer crop workflow, regression screenshots, full contrast/assistive-technology audits, and opt-in local model evaluation with explicit consent. None is presented as implemented.

## GitHub publishing

1. Create a GitHub repository, push this directory as its root, and use `main` as the default branch. Do not commit `node_modules`, generated `public/ocr`, or test screenshots.
2. In repository **Settings → Pages**, choose **GitHub Actions** as the source.
3. Push to `main` or run the supplied workflow. It runs `npm ci`, unit tests, a production build, and publishes `dist`.
4. The workflow sets `VITE_BASE_PATH` to `/<repository-name>/`. For a user/organization-root site, set it to `/`. For custom static hosting, the default relative base works.
5. Do not use a history-router rewrite; screen navigation is local React state, so static hosting and refresh work without routing configuration.

No environment secrets or API credentials are needed. For manual production serving, run `npm run build` and serve the complete `dist/` directory, including `ocr/`, over HTTP/HTTPS. Opening `index.html` directly with `file://` is not supported by module/worker security rules.

## 90-second demonstration

**0–15s:** “A screenshot can expose more than a secret. ContextLeak Lens shows what its details may reveal together. Images stay in the browser.” Open the developer demo.

**15–30s:** Show real OCR progress. Click the email, name and credential findings. Point to their actual image overlays and masked panel values.

**30–45s:** Open Connections. Click the identity/workplace graph node. Explain that this is a deterministic possible connection, not a verified identity or a simulated LLM answer.

**45–60s:** Apply suggested redactions. Draw one extra mask with R, move it with V and drag its corner. Show the before/after score and original-preview toggle. Explain that masks replace pixels; blur is not offered.

**60–75s:** Select Verify output. Explain that the app creates a new PNG and OCRs that PNG again. Read the remaining-detections result and the manual-review reminder.

**75–90s:** Export the PNG, then download the values-free JSON report. End the session to clear the image, findings and undo state. “Three differentiators: connected evidence, irreversible full-resolution masks, and verification of actual output pixels.”

## Third-party notices

Application code is MIT-licensed. React/React DOM, Vite, TypeScript, Lucide, Vitest, and their dependencies retain their own licenses. Tesseract.js, Tesseract.js-core and bundled English OCR model data retain their upstream licenses (see installed package LICENSE files). Lucide icons are ISC-licensed. No proprietary company branding is used as this app's identity.
