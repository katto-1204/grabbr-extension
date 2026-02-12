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
- **True Ghost Mode (Floating UI)**: Bypasses Chrome popup window limitations by injecting the UI directly into the webpage. This allows for a genuine 15% opacity floating overlay that you can drag and move anywhere on your screen.
- **Glassmorphic Design**: Built with high-fidelity blurs, subtle borders, and a clean typography palette inspired by Shadcn/UI.

### Power-User Workflow
- **Markdown Export**: Direct-to-Markdown export optimized for Obsidian and Notion.
- **CSV Export**: Formatted specifically for Anki deck imports and Quizlet.
- **Search in Preview**: Real-time filtering to find specific items within large scans.
- **Auto-Copy**: Bypass the UI and send grabb'd content straight to your clipboard.

---

## Installation Guide

### 1. Download the Source
Clone the repository to your local machine:
```bash
git clone https://github.com/katto-1204/grabbr-extension.git
```
*Alternatively, download the Zip file from the "Code" button and extract it.*

### 2. Load into Chrome
1.  Open your Chrome browser and navigate to `chrome://extensions`.
2.  In the top right corner, toggle **Developer mode** to ON.
3.  Click the **Load unpacked** button that appears.
4.  Select the `smart-copier` folder (inside the project directory).

### 3. Pin for Quick Access
1.  Click the **Puzzle piece icon** (Extensions) in your Chrome toolbar.
2.  Find **grabbr** and click the **Pin icon**.
3.  Click the **grabbr icon** anytime to start grabbing content!

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
