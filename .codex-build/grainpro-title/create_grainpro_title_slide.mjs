import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "C:\\Users\\Sisters\\Documents\\Ecoshell\\Site";
const SKILL_DIR = "C:\\Users\\Sisters\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.909.12148\\skills\\presentations";
const TMP_DIR = path.join(workspaceDir, ".codex-build", "grainpro-title");
const FINAL_PPTX = path.join(workspaceDir, ".codex-output", "grainpro-impact-conversation-title.pptx");
const RUNTIME_PYTHON = "C:\\Users\\Sisters\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
process.env.RUNTIME_NODE_MODULES = "C:\\Users\\Sisters\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules";

const { resolvePresentationFont, finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools", "artifact_tool_utils.mjs")).href,
);

await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });
await fs.mkdir(path.join(workspaceDir, ".codex-finalizer"), { recursive: true });

const font = resolvePresentationFont({ fontFamily: "Aptos" });
const serif = resolvePresentationFont({ fontFamily: "Georgia" });
const navy = "#00152D";
const cream = "#F8F5EF";
const gold = "#8C6B2E";
const muted = "#526071";

const presentation = Presentation.create({
  slideSize: { width: 1280, height: 720 },
});

function addText(slide, text, position, style = {}, align = "left") {
  const box = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = {
    typeface: style.typeface || font,
    fontSize: style.fontSize ?? 24,
    bold: style.bold ?? false,
    italic: style.italic ?? false,
    color: style.color || navy,
    alignment: align,
    autoFit: "none",
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    marginBottom: 0,
  };
  return box;
}

function addRect(slide, position, fill, line = "none", geometry = "rect") {
  return slide.shapes.add({
    geometry,
    position,
    fill: { type: "solid", color: fill },
    line: line === "none" ? { style: "solid", fill: "none", width: 0 } : line,
  });
}

const slide = presentation.slides.add();
slide.background.fill = cream;

addRect(slide, { left: 0, top: 0, width: 1280, height: 160 }, navy);
addRect(slide, { left: 0, top: 560, width: 1280, height: 160 }, navy);
addRect(slide, { left: 0, top: 160, width: 1280, height: 2 }, navy);
addRect(slide, { left: 0, top: 558, width: 1280, height: 2 }, navy);

addText(slide, "THRUSHCROSS ADVISORY SERVICES", { left: 72, top: 68, width: 480, height: 28 }, {
  typeface: serif,
  fontSize: 16,
  bold: true,
  color: "#D9C791",
});
addText(slide, "Prepared for GrainPro", { left: 72, top: 104, width: 360, height: 24 }, {
  typeface: font,
  fontSize: 16,
  color: "#C8D2DF",
});

addRect(slide, { left: 72, top: 240, width: 86, height: 4 }, gold);
addText(slide, "A Conversation on", { left: 72, top: 276, width: 700, height: 62 }, {
  typeface: font,
  fontSize: 42,
  color: navy,
});
addText(slide, "GrainPro's Impact Journey", { left: 72, top: 330, width: 930, height: 72 }, {
  typeface: font,
  fontSize: 46,
  bold: true,
  color: navy,
});
addText(slide, "Exploring where measurement, delivery and decision-making can support the next stage", { left: 76, top: 420, width: 880, height: 42 }, {
  typeface: font,
  fontSize: 21,
  color: muted,
});

addText(slide, "Working session", { left: 76, top: 496, width: 220, height: 26 }, {
  typeface: font,
  fontSize: 16,
  color: gold,
  bold: true,
});
addText(slide, "September 2026", { left: 300, top: 496, width: 220, height: 26 }, {
  typeface: font,
  fontSize: 16,
  color: muted,
});

addText(slide, "THRUSHCROSS", { left: 924, top: 622, width: 260, height: 34 }, {
  typeface: serif,
  fontSize: 24,
  bold: true,
  color: "#FFFFFF",
}, "right");
addText(slide, "Advisory Services", { left: 1006, top: 654, width: 175, height: 20 }, {
  typeface: serif,
  fontSize: 12,
  italic: true,
  color: "#D9C791",
}, "right");

slide.speakerNotes.textFrame.setText("Standalone title slide created from the user's requested collaborative positioning for the GrainPro impact conversation.");

const candidatePath = path.join(TMP_DIR, "candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
const preview = await presentation.export({ slide, format: "png", scale: 1 });
await fs.writeFile(path.join(TMP_DIR, "preview.png"), new Uint8Array(await preview.arrayBuffer()));

const result = await finalizePresentation({
  explicitTotalSlideCount: 1,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "12192000,6858000",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
  ],
  fontPolicy: { basis: "design", families: [font, serif] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, ".codex-finalizer", "grainpro-impact-conversation-title.validation.json"),
});

console.log(JSON.stringify({
  finalPath: FINAL_PPTX,
  previewPath: path.join(TMP_DIR, "preview.png"),
  warnings: result.warnings || [],
}, null, 2));
