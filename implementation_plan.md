# Enhance AI Symptom Checker with Searchable Symptom Bar

## Goal Description

Implement a modern, searchable symptom input component for the **Patient Symptom Checker** page. This component will provide:
- An auto‑suggest dropdown with a library of 200+ symptoms.
- Chip/tag UI for selected symptoms.
- Ability for users to type custom symptoms, which are parsed via a lightweight NLP extractor and added as chips.
- Dark/Light mode styling consistent with the existing dashboard.
- Integration with the existing prediction payload while preserving all current UI elements (vital sliders, AI model selector, diagnostics panel, recent triages).

## User Review Required

> [!IMPORTANT]
> Confirm the following design choices before we proceed:
> - **UI framework**: Should we use plain CSS with React components, or a component library such as Material‑UI (MUI) for the autocomplete and chips?
> - **Data storage**: Store the 200+ symptom list as a static JSON file in the frontend (`src/data/symptoms.json`) or fetch from an API endpoint?
> - **Custom symptom NLP**: Use a simple keyword extraction (split on commas) or integrate a small client‑side NLP library (e.g., `compromise`)?
> - **Performance**: Any concerns about loading the large symptom list on mobile devices?

## Open Questions

> [!WARNING]
> - Do you want the symptom search bar to appear **above** the existing "Select Clinical Signs / Symptoms" section (as requested) with a search icon and rounded box?
> - Should the auto‑suggest suggestions be limited to **10** items per keystroke to improve performance?
> - How should duplicate symptom entries be handled (e.g., selecting a symptom both from list and typing manually)?
> - Do you need the symptom list to be **filterable by category** (Respiratory, General, etc.) in the dropdown?

## Proposed Changes

---
### Component Updates

#### [MODIFY] [PatientSymptomChecker.jsx](file:///C:/Users/lnaga/OneDrive/Desktop/.gemini/antigravity/scratch/LifePulse/frontend/src/pages/patient/PatientSymptomChecker.jsx)
- Import and render a new `SearchableSymptomInput` component.
- Replace the static `SYMPTOMS` constant with a dynamic import of `symptoms.json`.
- Merge selected chips from the new component with existing `selectedSymptoms` state before calling `handlePredict`.

#### [NEW] [SearchableSymptomInput.jsx](file:///C:/Users/lnaga/OneDrive/Desktop/.gemini/antigravity/scratch/LifePulse/frontend/src/components/SearchableSymptomInput.jsx)
- Uses React state to manage input value, suggestion list, and selected chips.
- Utilizes MUI `Autocomplete` (if approved) or a custom dropdown.
- Supports dark/light mode via CSS variables.
- Handles custom entry: on `Enter` key, runs a lightweight NLP parse and adds resulting tokens as chips.

#### [NEW] [symptoms.json](file:///C:/Users/lnaga/OneDrive/Desktop/.gemini/antigravity/scratch/LifePulse/frontend/src/data/symptoms.json)
- JSON array of symptom objects `{ "name": "Cough", "category": "Respiratory" }`.
- Contains at least 200 entries covering the categories listed in the request.

---
### Styling

#### [MODIFY] [PatientSymptomChecker.module.css](file:///C:/Users/lnaga/OneDrive/Desktop/.gemini/antigravity/scratch/LifePulse/frontend/src/pages/patient/PatientSymptomChecker.module.css)
- Add styles for the rounded search box, search icon, and chip layout.
- Ensure styles adapt to dark and light themes using CSS variables.

---
### Backend (minimal)

No backend changes required; all symptom data is client‑side. If an API endpoint is preferred, a stub endpoint can be added later.

## Verification Plan

### Automated Tests
- Run existing unit tests (`npm test`) to ensure no regressions.
- Add a new test suite for `SearchableSymptomInput` checking:
  - Auto‑suggest appears with correct matches.
  - Selecting a suggestion adds a chip.
  - Custom symptom entry produces chips via NLP.
  - Payload sent to `predictionApi.predict` includes both static and custom symptoms.

### Manual Verification
- Open the **Patient Symptom Checker** page.
- Verify the search bar appears above the symptom grid with correct styling.
- Type various strings and ensure suggestions are relevant and limited to 10 items.
- Select multiple symptoms and see chips appear.
- Enter a free‑form symptom phrase (e.g., "sharp chest pain and shortness of breath") and confirm chips are generated.
- Click **Predict** and observe the payload includes all selected symptoms.
- Switch between dark and light mode to confirm UI consistency.

---
