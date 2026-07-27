import { getNodesBounds, getViewportForBounds } from "@xyflow/react";
import type { AppNode } from "../types";

const THUMB_WIDTH = 800;
const THUMB_HEIGHT = 500;

// Kopiert alle berechneten Styles rekursiv vom Original in den Klon
function inlineStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  let cssText = "";
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    cssText += `${prop}:${computed.getPropertyValue(prop)};`;
  }
  (target as HTMLElement).style.cssText = cssText;

  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length; i++) {
    inlineStyles(sourceChildren[i], targetChildren[i]);
  }
}

async function domToBlob(
  node: HTMLElement,
  options: {
    width: number;
    height: number;
    backgroundColor?: string;
    scale?: number;
  },
): Promise<Blob | null> {
  const { width, height, backgroundColor = "#fff", scale = 1 } = options;

  // 1. Klonen + Styles inlinen
  const clone = node.cloneNode(true) as HTMLElement;
  inlineStyles(node, clone);
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = "0";

  // 2. In SVG foreignObject verpacken
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("xmlns", svgNS);
  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);

  const foreignObject = document.createElementNS(svgNS, "foreignObject");
  foreignObject.setAttribute("width", "100%");
  foreignObject.setAttribute("height", "100%");
  foreignObject.setAttribute("x", "0");
  foreignObject.setAttribute("y", "0");

  // xhtml-Namespace ist Pflicht, sonst rendert der Browser das foreignObject nicht
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  foreignObject.appendChild(clone);
  svg.appendChild(foreignObject);

  const svgString = new XMLSerializer().serializeToString(svg);
  const svgDataUrl =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

  // 3. Als Image laden und auf Canvas zeichnen
  const img = new Image();
  img.width = width;
  img.height = height;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = svgDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export async function captureFlowThumbnail(
  nodes: AppNode[],
): Promise<Blob | null> {
  if (nodes.length === 0) return null;

  const flowEl = document.querySelector<HTMLElement>(".react-flow");
  if (!flowEl) return null;

  const viewport = flowEl.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) return null;

  const bounds = getNodesBounds(nodes);
  const { x, y, zoom } = getViewportForBounds(
    bounds,
    THUMB_WIDTH,
    THUMB_HEIGHT,
    0.2,
    2,
    0.1,
  );

  // Transform am echten Element setzen, damit inlineStyles() ihn übernimmt
  const prevTransform = viewport.style.transform;
  viewport.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;

  let blob: Blob | null = null;
  try {
    blob = await domToBlob(flowEl, {
      width: THUMB_WIDTH,
      height: THUMB_HEIGHT,
      backgroundColor: "#14161a",
      scale: 2,
    });
  } finally {
    viewport.style.transform = prevTransform;
  }

  return blob;
}
