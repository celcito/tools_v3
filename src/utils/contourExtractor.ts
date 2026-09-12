import * as THREE from 'three';

export interface Point2D {
  x: number;
  y: number;
}

export interface PolygonContour {
  points: Point2D[];
  isHole: boolean;
}

/**
 * Douglas-Peucker line simplification
 */
export function simplifyPolygon(points: Point2D[], tolerance: number): Point2D[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPolygon(points.slice(0, index + 1), tolerance);
    const right = simplifyPolygon(points.slice(index), tolerance);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [start, end];
  }
}

function perpendicularDistance(p: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(p.x - lineStart.x, p.y - lineStart.y);
  return Math.abs(dy * p.x - dx * p.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

/**
 * Calculate signed area of polygon (positive = clockwise, negative = counter-clockwise)
 */
export function polygonArea(points: Point2D[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

/**
 * Check if point is inside polygon
 */
export function isPointInsidePolygon(point: Point2D, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Extracts vector contours from ImageData alpha channel using border-following (Suzuki & Abe / Moore-Neighbor)
 */
export function extractContoursFromImageData(
  imageData: ImageData,
  mmPerPixel: number,
  offsetX: number,
  offsetY: number,
  simplifyToleranceMm: number = 0.35
): { outer: Point2D[][]; holes: Point2D[][] } {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);

  // Helper to check pixel inside (alpha > 120)
  const isSolid = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return data[(y * width + x) * 4 + 3] > 120;
  };

  const rawContours: Point2D[][] = [];

  // Moore neighborhood directions (clockwise starting from top)
  const dirs: [number, number][] = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1]
  ];

  // Scan image for borders
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (!isSolid(x, y) || visited[idx] === 1) continue;

      // Check if it's a boundary pixel (any neighbor is transparent)
      let isBoundary = false;
      for (const [dx, dy] of dirs) {
        if (!isSolid(x + dx, y + dy)) {
          isBoundary = true;
          break;
        }
      }

      if (!isBoundary) continue;

      // Trace boundary
      const contour: Point2D[] = [];
      let cx = x;
      let cy = y;
      let dirIndex = 0;
      const startX = cx;
      const startY = cy;
      let steps = 0;
      const maxSteps = width * height;

      do {
        contour.push({
          x: (cx - offsetX) * mmPerPixel,
          y: -(cy - offsetY) * mmPerPixel, // invert Y for standard 3D cartesian
        });
        visited[cy * width + cx] = 1;

        // Find next boundary pixel
        let foundNext = false;
        // Start search direction
        const searchStart = (dirIndex + 5) % 8;
        for (let i = 0; i < 8; i++) {
          const checkDir = (searchStart + i) % 8;
          const nx = cx + dirs[checkDir][0];
          const ny = cy + dirs[checkDir][1];

          if (isSolid(nx, ny)) {
            cx = nx;
            cy = ny;
            dirIndex = checkDir;
            foundNext = true;
            break;
          }
        }

        if (!foundNext) break;
        steps++;
      } while ((cx !== startX || cy !== startY) && steps < maxSteps);

      // Only keep contours with a minimum perimeter/area to avoid micro-noise
      if (contour.length >= 8) {
        // Close polygon
        contour.push({ ...contour[0] });
        const simplified = simplifyPolygon(contour, simplifyToleranceMm);
        if (simplified.length >= 4 && Math.abs(polygonArea(simplified)) > 0.8) {
          rawContours.push(simplified);
        }
      }
    }
  }

  // Separate into outer contours and holes based on winding / enclosure
  const outer: Point2D[][] = [];
  const holes: Point2D[][] = [];

  for (const poly of rawContours) {
    const area = polygonArea(poly);
    // Determine if it is a hole: count how many other polygons enclose a test point of this polygon
    const testPoint = poly[0];
    let enclosureCount = 0;

    for (const other of rawContours) {
      if (other !== poly && isPointInsidePolygon(testPoint, other)) {
        enclosureCount++;
      }
    }

    if (enclosureCount % 2 === 1) {
      // It is an interior hole
      holes.push(poly);
    } else {
      // It is an exterior boundary
      outer.push(poly);
    }
  }

  return { outer, holes };
}

/**
 * Converts extracted outer boundaries and holes into Three.js Shapes
 */
export function buildThreeShapes(
  outerContours: Point2D[][],
  holesContours: Point2D[][]
): THREE.Shape[] {
  const shapes: THREE.Shape[] = [];

  for (const outer of outerContours) {
    if (outer.length < 3) continue;

    const shape = new THREE.Shape();
    shape.moveTo(outer[0].x, outer[0].y);
    for (let i = 1; i < outer.length; i++) {
      shape.lineTo(outer[i].x, outer[i].y);
    }
    shape.closePath();

    // Check which holes belong inside this outer shape
    for (const hole of holesContours) {
      if (hole.length < 3) continue;
      if (isPointInsidePolygon(hole[0], outer)) {
        const holePath = new THREE.Path();
        holePath.moveTo(hole[0].x, hole[0].y);
        for (let j = 1; j < hole.length; j++) {
          holePath.lineTo(hole[j].x, hole[j].y);
        }
        holePath.closePath();
        shape.holes.push(holePath);
      }
    }

    shapes.push(shape);
  }

  return shapes;
}
