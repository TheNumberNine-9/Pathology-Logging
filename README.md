# Pathology Logs

Pathology sample register for Orange and Bowral Dermatology.

Open `index.html` in a browser (or host the folder on any static host, e.g. GitHub Pages). No build step is needed.

## Features
- Log samples by patient name and patient number, with specimen/site, date taken and notes
- Status on each card: **Not Sent Off**, **Sent Off**, **Closed**. You can change it from the card.
- Cards are laid out in a responsive grid
- Filter by name, number and progress (status); sort by date, name or number
- Status summary counts

## Data storage
Records are saved in the browser's `localStorage`, so they stay on that one browser and device. They are not shared between computers. Clearing the browser's site data deletes them.
