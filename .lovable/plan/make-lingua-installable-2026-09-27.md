# Make Lingua installable

## What will change
- Use the supplied neon Lingua logo in the translator header.
- Create properly sized app icons from the logo for phones, tablets, and computers.
- Add install information so supported browsers offer “Add to Home Screen” or “Install app”.
- Keep the existing online text, voice, and photo translator unchanged.

## Technical details
- Add a web app manifest with standalone display, Lingua branding, and 192px/512px icons.
- Add Apple touch icon, favicon, theme color, and manifest links to the document head.
- Store the full logo through the project asset service and use its served URL in the interface.
- Do not add offline caching; translation requires an internet connection.
- Verify the manifest, icon rendering, mobile layout, and current diagnostics.
