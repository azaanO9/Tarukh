import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";
import {registerServiceWorker} from '../lib/registerServiceWorker';

createRoot(document.getElementById("root")!).render(<Home />);
registerServiceWorker();
