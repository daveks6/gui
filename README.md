# KISS ULTRA GUI

The KISS ULTRA GUI is the crossplatform/web configuration tool for the Kiss Ultra flight controller.

It runs as an app within Google Chrome, standalone application or web gui and allows you to configure the flight controller

## ℹ️ About This Fork

This Android/PWA port is an **independent, community project**, built to make it easy to adjust flight controller settings (PIDs, rates, and everything else this GUI exposes) directly from your phone in the field — for anyone who'd rather not dig through OSD on-screen menus to change a setting between packs.

**This is not an official KISS Ultra / Flyduino project.** It was built independently by [@daveks6](https://github.com/daveks6), with development assistance from Claude (Anthropic), on top of the original open-source KISS ULTRA GUI. It is not reviewed, endorsed, or supported by the KISS Ultra team or Alexander Fedorov.

**Found a bug, or the app won't connect?** Please [open an issue on this repository](https://github.com/daveks6/gui/issues) — this is an unofficial fork, so problems with it should come here, not to Alexander Fedorov or the KISS Ultra team, since it isn't their code to support.

**Hardware disclaimer:** this software connects directly to your flight controller and can change its configuration. Use it at your own risk — I am not responsible for any damage to your FC, ESCs, motors, or aircraft resulting from its use, on any platform (Android, PWA, or desktop). Always double-check settings before flying.

**License:** this project is licensed under **GPL-3.0**, the same license as the original KISS ULTRA GUI. In practice that means:
- Full source for everything in this fork is right here in this repository, as GPL-3.0 requires.
- Original authorship (Flyduino, Alexander Fedorov, Felix Niessen, Max Levine) is preserved and credited throughout — this fork builds on their work, it doesn't replace or claim it.
- You're free to use, modify, and redistribute this code yourself under the same terms.
- The software is provided **with no warranty of any kind**, as GPL-3.0 requires — see [LICENSE](./LICENSE) for the full legal text.

## 📦 Native Android App (recommended)

A native Android app is available for more reliable USB connectivity than the browser can offer on some phones (Android Chrome's WebUSB/Web Serial support can be inconsistent depending on device and Chrome version — the native app talks to the FC directly instead).

**➡️ [Download the latest Android app release](https://github.com/daveks6/gui/releases/latest)**

**To install:**
1. Open the release link above on your Android phone and download the `.apk` file
2. Tap the downloaded file to open it — Android will prompt you to allow installing from that source (Chrome/Files) if you haven't already
3. Confirm the install
4. Open the app, plug in your KISS ULTRA FC over USB, and tap **Connect** — this uses Android's own USB permission dialog, not a browser picker

This is a self-signed build (not distributed through the Play Store), which is normal for an independent open-source project like this one — Android will simply ask you to confirm you trust the install source.

## 📱 Android (browser / PWA)

The GUI can also be used straight from your phone's browser as a Progressive Web App (PWA), with no install required — useful for a quick look, though the native app above is the more reliable option for actually connecting to your FC.

**➡️ [Open the KISS ULTRA GUI on Android](https://daveks6.github.io/gui/)**

**To add it to your home screen:**
1. Open the link above in **Chrome** on your Android phone
2. Tap the **⋮** menu (top right) and choose **Add to Home screen** (Chrome may also show an install banner automatically — tap that instead if you see it)
3. Confirm the install — the app icon appears on your home screen like any other app
4. Open it, plug in your KISS ULTRA FC over USB, and tap **Connect**

If Connect doesn't find your FC, tap the **Diagnose USB** link next to it — it shows exactly what your phone sees on the USB bus, which helps narrow down connection issues.

## Installation (Desktop)

Depending on target operating system, _KISS ULTRA GUI_ is distributed as _standalone_ application or Chrome App.

Web gui accessible at [Kiss Ultra WEB GUI](https://kiss-ultra.com/gui/) with latest Chrome and Edge browsers.

## Supported Hardware

- KISS FCFC ULTRA

## Required Tools &Driver

- KISS FCFC ULTRA
 * [STM Virtual Comport Driver](http://www.st.com/en/development-tools/stsw-stm32102.html)

Most likely the STM driver already installed on your system.
