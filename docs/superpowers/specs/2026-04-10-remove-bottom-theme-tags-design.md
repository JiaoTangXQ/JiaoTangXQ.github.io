# Remove Bottom Theme Tags Design

## Goal

Remove the bottom-left theme tag strip from the cosmos homepage so the lower UI is cleaner.

## Scope

- Remove the `ThemeLens` control from the homepage viewport.
- Keep the bottom-right `GalaxyCompass`.
- Keep existing top-bar actions such as search and reset.
- Do not change article data, routing, or scene rendering behavior beyond removing the visible tag control.

## Approach

Apply the smallest possible change in `CosmosViewport`:

- Stop importing and rendering `ThemeLens`.
- Remove the theme-tag state and handlers that only existed to support that control.
- Continue passing no active theme to the scene.

## Verification

- Add a focused regression test that fails if `CosmosViewport` still references `ThemeLens`.
- Run the focused test.
- Run a production build to ensure the UI change does not break the app.
