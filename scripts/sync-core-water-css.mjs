import { readFile, writeFile } from "node:fs/promises";
import { CANVAS_CREATION_WATER_PRESENTATION_CSS } from "../vendor/whiteboat-core/lib/index.js";

const file = new URL("../styles.css", import.meta.url);
const marker = "/* Generated core water presentation. Do not edit this block. */";
const endMarker = "/* End generated core water presentation. */";
const current = await readFile(file, "utf8");
const start = current.indexOf(marker);
const end = current.indexOf(endMarker, start);
const host = start < 0 ? current.trimEnd() : current.slice(0, start).trimEnd();
const suffix = end < 0 ? "" : current.slice(end + endMarker.length).trim();
const next = `${host}\n\n${marker}\n${CANVAS_CREATION_WATER_PRESENTATION_CSS.trim()}\n${endMarker}\n${suffix ? `\n${suffix}\n` : ""}`;
if (current !== next) await writeFile(file, next);
