# grabbr

> **The intelligent, glassmorphic content extractor for the modern web.**

[![Version](https://img.shields.io/badge/version-1.5-blue?style=for-the-badge)](https://github.com/) 
[![Theme](https://img.shields.io/badge/theme-adaptive-zinc?style=for-the-badge)](https://github.com/)
[![Mode](https://img.shields.io/badge/transparency-ultra-ghost?style=for-the-badge)](https://github.com/)

**grabbr** is a high-performance Chrome extension designed for students, researchers, and power users who need to bridge the gap between web content and their knowledge management systems (Obsidian, Notion, Anki).

---

## Key Features

### Intelligent Extraction Engine
- **Full Page Sequence**: Capture entire documents in strict visual order.
- **Smart Question Mode**: Drills down into quiz layouts to extract Question-Choice pairings automatically.
- **Study Mode**: Identified answers are hidden by default to let you test yourself. Reveal them with a single toggle.
- **Image Context**: Automatically grabs `alt` text and ARIA labels near content to provide visual context in your notes.

### Visual Immersion
- **Adaptive UI**: Matches the host page's brightness—automatically switching between Zinc Light and Dark themes.
- **Ultra-Transparency (Ghost Mode)**: A 15% opacity overlay allows you to see the source page perfectly through the extension for a truly immersive scanning experience.
- **Glassmorphic Design**: Built with high-fidelity blurs, subtle borders, and a clean typography palette inspired by Shadcn/UI.

### Power-User Workflow
- **Markdown Export**: Direct-to-Markdown export optimized for Obsidian and Notion.
- **CSV Export**: Formatted specifically for Anki deck imports and Quizlet.
- **Search in Preview**: Real-time filtering to find specific items within large scans.
- **Auto-Copy**: Bypass the UI and send grabb'd content straight to your clipboard.

---

## Installation

1.  Clone this repository or download the source.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** (top right).
4.  Click **Load unpacked** and select the extension folder.
5.  Pin **grabbr** to your toolbar for instant access.

---

## Tech Stack

- **Logic**: Vanilla JavaScript (Modern ES6+)
- **Styling**: Vanilla CSS (Custom Variable Architecture)
- **Icons**: SVG-native for infinite scaling
- **Design System**: Zinc / Glassmorphism

---

## How to Use

1. **Select Mode**: Choose your target format (Standard or Formatted).
2. **Scan**: Hit `Scan` to see a live preview of what the engine has grabb'd.
3. **Refine**: Use the search bar to filter or toggle Study Mode to reveal answers.
4. **Export**: Copy directly or export to `.md`/`.csv` for your favorite notes app.

---

<div align="center">
  <sub>Built for the curious. Powered by grabbr.</sub>
</div>
