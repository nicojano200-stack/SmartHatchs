# SmartHatch

Mobile app prototype for **The Development of IoT Home Base Egg Incubator** (BSCpE, STI College Kalibo).

Pure HTML, CSS and JavaScript. No build step, no dependencies.

## Files
- `index.html` structure and screens
- `style.css` design, animations, dark mode
- `app.js` app logic and the simulated incubator

## How the prototype works
1. The app starts empty and **locked**. Home, Control, Database and Reports show nothing.
2. Press the **power button** (center of the bottom bar) to connect to the incubator. Data appears and the live simulation starts.
3. Press it again to disconnect. Everything is hidden again.
4. Start a batch on Home, then use **Settings > Demo tools** to simulate a power outage, Wi-Fi loss, or skip a day.

All data is simulated in memory. Nothing is saved or sent anywhere.

## Run it
Open `index.html` in a browser, or publish with **GitHub Pages**:
Settings > Pages > Deploy from branch > `main` / root.

## Connecting the real incubator (next step)
- ESP32 writes readings to Firebase Realtime Database under `/incubators/INC-001/...`
- Replace the simulation in `tick()` and the actions in `app.js` with Firebase reads and writes
- Use Firebase Authentication for the login screen (email, Google, Facebook)
