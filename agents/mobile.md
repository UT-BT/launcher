# Mobile

The manual iPhone checklist and how to back each result with a diagnostic report. Run it on a
real iPhone after a wave of mobile work lands: it covers what Playwright's emulation can't
reproduce. Responsive layout rules are in [web-target.md](web-target.md).

## Capturing a diagnostic report

The diagnostic overlay shows what the app thinks is happening on the device: the
`visualViewport` scale, offsets and size, `innerHeight` and `innerWidth`, the window and shell
scroll positions, orientation, standalone mode, touch and below-`lg`, the safe-area insets,
the open modal count, the scroll-lock count (`n/a` until the counted scroll lock exists), the
active view and the path. It is part of the production build and sends nothing anywhere.

1. Turn it on:
   - in Safari, open any page with `?debug=mobile` (for example `https://utbt.net/?debug=mobile`);
   - in the Home Screen app, or anywhere without a URL bar, long-press the logo in the top bar
     (on desktop, the sidebar logo) for about half a second. A normal tap on the logo does what
     it always did.
2. Reproduce the problem. The values update live; **Move down** / **Move up** moves the panel out
   of the way.
3. Tap **Copy report** while the broken state is on screen and paste the text into the bug report.
   If the copy fails, the report appears in a text box below the buttons to select by hand.
4. Long-press the logo again, or tap **Close**, to hide it.

## iPhone checklist

Run each check in the Home Screen app unless it says otherwise. When a check fails, capture a
report in the broken state and attach it.

- [ ] **Standalone launch and status bar, both themes.** Add the site to the Home Screen and open
      it: it launches full-screen with the right name and icon, and the report says
      `Standalone: yes`. The status bar clock and battery are readable in the Classic theme and
      in the Light theme.
- [ ] **Safe areas, both orientations.** In portrait and in landscape (notch on either side), the
      top bar, drawer, modals and page edges stay clear of the notch or Dynamic Island, the
      rounded corners and the home indicator. The report's `Safe area` row shows non-zero
      insets on the notch side.
- [ ] **Pinch zoom in and out.** Pinch-zoom a page in, pan around, then zoom back out to normal:
      `Viewport scale` returns to 1, `Window scroll` returns to `0, 0`, and the top bar, menu and
      page scrolling all work.
- [ ] **Rotation during a modal.** Open a modal (for example Compare runs on a cap page), rotate
      to landscape and back: the modal still fits, its close button is visible and works, and
      the page scrolls afterwards.
- [ ] **Rotation during video.** Start a replay video, rotate to landscape and back: the video
      stays inside the page and the layout recovers.
- [ ] **Keyboard inside a sheet.** Focus a text field inside a modal: the page does not zoom, the
      field stays visible above the keyboard, and closing the keyboard leaves the layout as it
      was.
- [ ] **Edge swipe back.** Navigate to a detail page, then swipe in from the left screen edge:
      the app goes back one page. Note whether the swipe works in the Home Screen app.
