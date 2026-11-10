# Pathology Logs

Pathology sample register for Orange, Bowral and Parkes Dermatology.

Open `index.html` in a browser (or host the folder on any static host, e.g. GitHub Pages). No build step is needed.

## Features
- **Clinic menu** (☰, top left) to switch between Orange, Bowral and Parkes Dermatology. The title and the list change to match the selected clinic.
- Log samples with patient name, patient number, **DOB**, **clinic**, **doctor**, specimen/site, date taken, date received and notes
- Pick the doctor from a dropdown; choose "＋ Add new doctor…" to add a name to the list
- Statuses: **Received** and **Actioned**. You can change a sample's status from its card.
- Filters: name, number, doctor and progress, including **Received > 2 weeks**
- A banner and counter show samples that have been on Received for 2+ weeks

## Overdue notifications
Click **Enable Notifications** in the header and allow notifications in the browser. A sample left on **Received** triggers a notification at 2 weeks, then again every week after that (3, 4, 5 weeks…) until it is marked **Actioned**. If a sample is moved back to Received, or its received date is edited, the count starts over.

Notifications are checked when the page opens, when you switch back to its tab, and every hour while it is open. **The site must be open in a browser tab** (it can be in the background) for notifications to be sent.

## Data storage
Records are saved in the browser's `localStorage`, so they stay on that one browser and device. They are not shared between computers. Clearing the browser's site data deletes them.
