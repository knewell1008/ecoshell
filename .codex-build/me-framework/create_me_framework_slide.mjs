import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "C:\\Users\\Sisters\\Documents\\Ecoshell\\Site";
const SKILL_DIR = "C:\\Users\\Sisters\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.909.12148\\skills\\presentations";
const TMP_DIR = path.join(workspaceDir, ".codex-build", "me-framework");
const FINAL_PPTX = path.join(workspaceDir, ".codex-output", "monitoring-evaluation-framework-v2.pptx");
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
const navy2 = "#082246";
const cream = "#F8F5EF";
const gold = "#8C6B2E";
const gold2 = "#C4A15B";
const grey = "#526071";
const line = "#D9C791";
const white = "#FFFFFF";

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
    fontSize: style.fontSize ?? 22,
    bold: style.bold ?? false,
    italic: style.italic ?? false,
    color: style.color || navy,
    autoFit: "none",
    marginLeft: style.marginLeft ?? 0,
    marginRight: style.marginRight ?? 0,
    marginTop: style.marginTop ?? 0,
    marginBottom: style.marginBottom ?? 0,
    alignment: align,
  };
  return box;
}

function addRect(slide, position, fill, outline = "none", radius = "roundRect") {
  return slide.shapes.add({
    geometry: radius,
    position,
    fill: { type: "solid", color: fill },
    line: outline === "none"
      ? { style: "solid", fill: "none", width: 0 }
      : outline,
  });
}

function addArrow(slide, left, top, width, height, flip = false) {
  slide.shapes.add({
    geometry: "rightArrow",
    position: { left, top, width, height },
    fill: { type: "solid", color: gold2 },
    line: { style: "solid", fill: "none", width: 0 },
    ...(flip ? { rotation: 180 } : {}),
  });
}

function addStep(slide, step, left, top, width, height) {
  addRect(slide, { left, top, width, height: 70 }, navy, "none", "roundRect");
  addText(slide, String(step.n), { left: left + 16, top: top + 17, width: 30, height: 30 }, {
    typeface: font,
    fontSize: 21,
    bold: true,
    color: "#F1DDA4",
  });
  addText(slide, step.title, { left: left + 52, top: top + 14, width: width - 66, height: 48 }, {
    typeface: font,
    fontSize: 18,
    bold: true,
    color: white,
  });

  const bodyTop = top + 82;
  addRect(slide, { left, top: bodyTop, width, height: height - 74 }, cream, {
    style: "solid",
    fill: line,
    width: 1.2,
  }, "roundRect");

  const itemTop = bodyTop + 18;
  step.items.forEach((item, idx) => {
    addText(slide, item, { left: left + 22, top: itemTop + idx * 42, width: width - 44, height: 28 }, {
      typeface: font,
      fontSize: 17,
      bold: idx === 0,
      color: navy,
    });
  });

  addRect(slide, { left: left + 18, top: bodyTop + height - 150, width: width - 36, height: 58 }, cream, {
    style: "dash",
    fill: gold2,
    width: 1,
  }, "rect");
  addText(slide, step.example, { left: left + 30, top: bodyTop + height - 137, width: width - 60, height: 36 }, {
    typeface: font,
    fontSize: 14,
    italic: true,
    color: grey,
  });
}

const slide = presentation.slides.add();
slide.background.fill = cream;

addText(slide, "HOW WE DELIVER IMPACT PROGRAMS", { left: 70, top: 48, width: 520, height: 24 }, {
  typeface: serif,
  fontSize: 17,
  bold: true,
  color: gold,
});
addText(slide, "Monitoring and Evaluation Framework", { left: 70, top: 88, width: 1120, height: 54 }, {
  typeface: font,
  fontSize: 40,
  bold: false,
  color: navy,
});
addText(slide, "Measurement is designed upfront, then used through delivery to guide management decisions.", { left: 72, top: 140, width: 850, height: 30 }, {
  typeface: font,
  fontSize: 18,
  color: grey,
});

const steps = [
  {
    n: 1,
    title: "Impact Strategy",
    items: ["Stakeholder priorities", "Theory of change", "Goals and governance"],
    example: "Materiality, targets and program logic",
  },
  {
    n: 2,
    title: "Collection of Information",
    items: ["Baseline diagnostic", "Survey and field data", "Partner and admin data"],
    example: "Sampling plans, field tools and source data",
  },
  {
    n: 3,
    title: "Dashboard and IT Tools",
    items: ["Indicator framework", "Reporting dashboard", "Mobile and web channels"],
    example: "Web dashboard, WhatsApp channel and data model",
  },
  {
    n: 4,
    title: "Implementation",
    items: ["Program rollout", "Project management", "Training and coordination"],
    example: "Pilot rollout and operating rhythm",
  },
  {
    n: 5,
    title: "Management Feedback Loops",
    items: ["Performance reviews", "Course corrections", "Funding and strategy decisions"],
    example: "Evidence used in steering and investment decisions",
  },
];

const cardW = 218;
const gap = 22;
const startX = 70;
const top = 196;
const height = 348;

steps.forEach((step, i) => {
  const x = startX + i * (cardW + gap);
  addStep(slide, step, x, top, cardW, height);
  if (i < steps.length - 1) {
    addArrow(slide, x + cardW + 3, top + 169, 18, 18);
  }
});

addRect(slide, { left: 70, top: 570, width: 1140, height: 56 }, navy, "none", "roundRect");
addText(slide, "Feedback loop", { left: 94, top: 586, width: 180, height: 28 }, {
  typeface: font,
  fontSize: 22,
  bold: true,
  color: white,
});
addText(slide, "Management reviews convert monitoring data into decisions on delivery, resources and strategy", { left: 292, top: 588, width: 790, height: 28 }, {
  typeface: font,
  fontSize: 18,
  color: "#D7E0EA",
});
addText(slide, "returns to steps 1 and 4", { left: 1040, top: 590, width: 145, height: 24 }, {
  typeface: font,
  fontSize: 13,
  italic: true,
  color: "#F1DDA4",
}, "right");

slide.shapes.add({
  geometry: "line",
  position: { left: 178, top: 545, width: 952, height: 25 },
  fill: "none",
  line: { style: "dash", fill: gold2, width: 2 },
  tail: { type: "arrow", width: "med", length: "med" },
});

addText(slide, "THRUSHCROSS", { left: 72, top: 665, width: 150, height: 20 }, {
  typeface: serif,
  fontSize: 14,
  bold: true,
  color: "#151515",
});
addText(slide, "Advisory Services", { left: 112, top: 684, width: 82, height: 12 }, {
  typeface: serif,
  fontSize: 7,
  italic: true,
  color: gold,
});
addText(slide, "GrainPro  |  Impact conversation  ·  4", { left: 940, top: 668, width: 270, height: 24 }, {
  typeface: font,
  fontSize: 17,
  color: "#7D8897",
}, "right");

slide.speakerNotes.textFrame.setText("Created from the user's reference slide and requested five-part Monitoring and Evaluation Framework structure.");

const candidatePath = path.join(TMP_DIR, "candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const preview = await presentation.export({ slide, format: "png", scale: 1 });
await fs.writeFile(path.join(TMP_DIR, "preview.png"), new Uint8Array(await preview.arrayBuffer()));

const requirements = {
  explicitTotalSlideCount: 1,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
};
const fontPolicy = { basis: "design", families: [font, serif] };
const expectedSlideSizeEmu = "12192000,6858000";

const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", expectedSlideSizeEmu,
    "--validate-bullet-geometry",
    "--validate-heading-fit",
  ],
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, ".codex-finalizer", "monitoring-evaluation-framework-v2.validation.json"),
});

console.log(JSON.stringify({
  finalPath: FINAL_PPTX,
  candidatePath,
  previewPath: path.join(TMP_DIR, "preview.png"),
  warnings: result.warnings || [],
}, null, 2));
