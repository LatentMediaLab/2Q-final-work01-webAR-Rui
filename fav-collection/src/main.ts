import "./styles.css";
import { App } from "./app/App";

const root = document.querySelector<HTMLElement>("#app");

if (root === null) {
  throw new Error("Application root element was not found.");
}

const app = new App(root, window.location.search);
app.start();

let disposed = false;
const disposeApp = (): void => {
  if (disposed) {
    return;
  }
  disposed = true;
  app.dispose();
};

window.addEventListener("pagehide", disposeApp, { once: true });
window.addEventListener("beforeunload", disposeApp, { once: true });
window.addEventListener("pageshow", (event) => {
  if (event.persisted && disposed) {
    window.location.reload();
  }
});
