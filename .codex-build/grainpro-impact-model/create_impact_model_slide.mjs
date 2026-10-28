import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "C:\\Users\\Sisters\\Documents\\Ecoshell\\Site";
const SKILL_DIR = "C:\\Users\\Sisters\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.909.12148\\skills\\presentations";
const TMP_DIR = path.join(workspaceDir, ".codex-build", "grainpro-impact-model");
const FINAL_PPTX = path.join(workspaceDir, ".codex-output", "grainpro-working-impact-model.pptx");
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
const paleGold = "#EAD7A4";
const line = "#D9C791";
const grey = "#526071";
const white = "#FFFFFF";

const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = presentation.slides.add();
slide.background.fill = cream;

function addText(text, position, style = {}, align = "left") {
  const box = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = {
    typeface: style.typeface || font,
    fontSize: style.fontSize ?? 20,
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

function addRect(position, fill, outline = "none", geometry = "rect") {
  return slide.shapes.add({
    geometry,
    position,
    fill: { type: "solid", color: fill },
    line: outline === "none" ? { style: "solid", fill: "none", width: 0 } : outline,
  });
}

function addCard(title, items, left, top, width, height, dark = false) {
  addRect({ left, top, width, height }, dark ? navy : "#FFFDF8", {
    style: "solid",
    fill: dark ? navy : line,
    width: 1.2,
  });
  addRect({ left, top, width, height: 58 }, dark ? paleGold : navy);
  addText(title, { left: left + 18, top: top + 15, width: width - 36, height: 30 }, {
    typeface: serif,
    fontSize: 17,
    bold: true,
    color: dark ? navy : paleGold,
  });
  items.forEach((item, idx) => {
    addText(item, { left: left + 22, top: top + 82 + idx * 45, width: width - 44, height: 35 }, {
      fontSize: 18,
      color: dark ? white : grey,
    });
  });
}

function arrow(left, top) {
  slide.shapes.add({
    geometry: "rightArrow",
    position: { left, top, width: 24, height: 18 },
    fill: { type: "solid", color: "#C4A15B" },
    line: { style: "solid", fill: "none", width: 0 },
  });
}

addText("MEASURING SOCIAL IMPACT", { left: 78, top: 58, width: 500, height: 28 }, {
  typeface: serif,
  fontSize: 17,
  bold: true,
  color: gold,
});
addText("Our Working View of GrainPro's Impact Model", { left: 78, top: 100, width: 1040, height: 58 }, {
  fontSize: 39,
  color: navy,
});
addText("A starting point for discussion: what is right, what is missing, and what matters most", { left: 82, top: 158, width: 980, height: 28 }, {
  fontSize: 18,
  color: grey,
});

addCard("WHAT GRAINPRO ENABLES", [
  "Hermetic storage technology",
  "Distribution through partners",
  "Training on correct use",
], 78, 220, 284, 260);
arrow(381, 339);

addCard("WHAT CHANGES FOR USERS", [
  "Lower storage losses",
  "Better crop quality and prices",
  "More choice on when to sell",
  "Reduced pesticide use",
], 430, 220, 330, 260);
arrow(779, 339);

addCard("WHAT THIS CAN SUPPORT", [
  "Smallholder income and food security",
  "Avoided emissions from lost food",
  "Reduced plastic waste",
], 828, 220, 374, 260, true);

addRect({ left: 78, top: 514, width: 1124, height: 78 }, navy, "none", "roundRect");
addText("Questions for discussion", { left: 104, top: 532, width: 280, height: 28 }, {
  fontSize: 22,
  bold: true,
  color: white,
});
addText("Which outcomes matter most? Where is the evidence already strong? Where is measurement difficult? What story would help GrainPro commercially or strategically?", { left: 392, top: 528, width: 760, height: 44 }, {
  fontSize: 17,
  color: "#D7E0EA",
});

addText("THRUSHCROSS", { left: 82, top: 660, width: 150, height: 20 }, {
  typeface: serif,
  fontSize: 14,
  bold: true,
  color: "#151515",
});
addText("Advisory Services", { left: 122, top: 679, width: 82, height: 12 }, {
  typeface: serif,
  fontSize: 7,
  italic: true,
  color: gold,
});
addText("GrainPro  |  Impact conversation  ·  3", { left: 910, top: 664, width: 292, height: 24 }, {
  fontSize: 17,
  color: "#7D8897",
}, "right");

slide.speakerNotes.textFrame.setText("Created as a less technical alternative to a Theory of Change slide. The slide frames Thrushcross's understanding as a working view for discussion.");

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
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  fontPolicy: { basis: "design", families: [font, serif] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, ".codex-finalizer", "grainpro-working-impact-model.validation.json"),
});

console.log(JSON.stringify({
  finalPath: FINAL_PPTX,
  previewPath: path.join(TMP_DIR, "preview.png"),
  warnings: result.warnings || [],
}, null, 2));
