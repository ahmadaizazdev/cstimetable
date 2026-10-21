<div align="center">

<!-- Animated Header Wave -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=4f46e5&height=200&section=header&text=AIOU%20Timetable%20Manager&fontSize=50&fontColor=ffffff&animation=fadeIn&fontAlignY=35" width="100%" />

<h3>🎓 Department of Computer Science | Allama Iqbal Open University</h3>

<p>
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
  <img src="https://img.shields.io/badge/status-active-success.svg" alt="Status" />
</p>

<p>
  <b>A modern, interactive, and admin-only web application designed to replace the cumbersome Excel-based timetable workflow.</b>
</p>

### 🌐 [Live Preview: ahmadaizazdev.github.io/cstimetable](https://ahmadaizazdev.github.io/cstimetable/)

</div>

---

## 📖 Overview

Managing university timetables via spreadsheets is error-prone, messy, and difficult to distribute. This system provides a beautiful, interactive, and conflict-free interface for department administrators to build, manage, and export timetables. 

It runs **entirely in the browser** (No backend, no database required) and is hosted for free on GitHub Pages.

---

## ✨ Key Features

<table>
  <tr>
    <td width="50%">
      <h3>⚡ Interactive Builder</h3>
      <p>Click-to-add sessions with a clean, modern UI. Drag-and-drop ready layout.</p>
    </td>
    <td width="50%">
      <h3>🛡️ Conflict Detection</h3>
      <p>Instantly detects if a teacher, room, or section is double-booked.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h3>🔍 Smart Autocomplete</h3>
      <p>Quickly find courses and teachers with built-in search dropdowns.</p>
    </td>
    <td>
      <h3>📤 Multi-Level Export</h3>
      <p>Export a section, semester, or program as <b>PNG</b>, <b>JPEG</b>, or <b>Excel</b>.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h3>☕ "Free Period" Support</h3>
      <p>Easily block out free slots for students with a beautiful coffee cup icon.</p>
    </td>
    <td>
      <h3>💾 Saved Timetables</h3>
      <p>Save specific semesters to your browser and load them later for editing.</p>
    </td>
  </tr>
</table>

---

## 🛠️ Tech Stack

<div align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/GitHub%20Pages-121013?style=for-the-badge&logo=github&logoColor=white" />
</div>

- **Frontend:** Vanilla HTML, CSS, JavaScript (No frameworks).
- **Hosting:** GitHub Pages.
- **Storage:** LocalStorage (Browser) + JSON Import/Export for manual backups.
- **Libraries (via CDN):**
  - [html-to-image](https://github.com/bubkoo/html-to-image) for PNG/JPEG generation.
  - [SheetJS (xlsx)](https://sheetjs.com/) for Excel generation.
  - [FontAwesome](https://fontawesome.com/) for icons.
  - [Google Fonts](https://fonts.google.com/) (Inter).

---

## 🚀 How to Use

1. **Setup Entities:**
   - Go to **Programs**, **Teachers**, **Courses**, and **Rooms** to add your department's data.
2. **Build Timetable:**
   - Go to **Timetable Builder**.
   - Select a Program, Semester, and Section from the top bar.
   - Click any empty cell to add a session (Course, Teacher, Room, Time).
3. **Save & Export:**
   - Click **Save View** to save the current section to your browser.
   - Go to **Export Studio** to generate a beautiful PNG or Excel file to share on WhatsApp or print.

---

## 💾 Data Management (No Backend)

Because GitHub Pages cannot save files directly, this app uses a **manual save workflow**:

1. **Auto-save:** Your progress is instantly saved to your browser's `localStorage`. If you close the tab and come back, your data is still there.
2. **Backup:** Use the **Export JSON** button (top right) to download a backup file.
3. **Restore:** Use the **Import JSON** button to upload a previous backup.
4. **Publish to GitHub:** To update the live site for everyone, replace the `timetable.json` file in the repository with your newly exported JSON file.

---

## 👨‍💻 Author

**Ahmad Aizaz**
Department of Computer Science
Allama Iqbal Open University (AIOU)

---

<div align="center">
  
<!-- Animated Footer Wave -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=4f46e5&height=100&section=footer&animation=twinkling" width="100%" />

</div>
