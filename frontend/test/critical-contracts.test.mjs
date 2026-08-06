import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  formatDateOnly,
  getDefaultReceivedAt,
  getPeriodEnd,
  isValidDateRange,
  toDateOnly,
} from "../src/utils/dateUtils.ts";
import { INTERNAL_STAFF_PERMISSIONS } from "../src/constants/permissions.ts";
import { resolveUserPermissions } from "../src/utils/permissionPolicy.ts";
import {
  getRepairImagePreviewStateAfterRemoval,
  getRepairImageReference,
  removeRepairImageReference,
  resolveRepairImageUrlWithBase,
} from "../src/utils/imageReference.ts";

test("date-only values stay in the selected calendar period", () => {
  assert.equal(toDateOnly("2026-08-01T00:00:00.000Z"), "2026-08-01");
  assert.equal(formatDateOnly("2026-08-01T00:00:00.000Z"), "01/08/2026");
  assert.equal(toDateOnly(getPeriodEnd(2, 2024)), "2024-02-29");
  assert.equal(toDateOnly(getDefaultReceivedAt(1, 2000)), "2000-01-01");
  assert.equal(isValidDateRange("2026-08-10", "2026-08-10"), true);
  assert.equal(isValidDateRange("2026-08-10", "2026-08-09"), false);
});

test("permission fallback is explicit and never grants an empty or anonymous account", () => {
  const expected = [
    "dashboard.view",
    "repair_orders.view",
    "repair_orders.create",
    "repair_orders.update",
    "repair_orders.delete",
    "repair_orders.export",
    "repair_images.upload",
    "customers.view",
    "customers.create",
    "customers.update",
    "customers.delete",
  ];
  assert.deepEqual([...INTERNAL_STAFF_PERMISSIONS], expected);
  assert.deepEqual(resolveUserPermissions(null, INTERNAL_STAFF_PERMISSIONS), []);
  assert.deepEqual(resolveUserPermissions({ permissions: [] }, INTERNAL_STAFF_PERMISSIONS), []);
  assert.deepEqual(resolveUserPermissions({ permissions: ["customers.view"] }, INTERNAL_STAFF_PERMISSIONS), [
    "customers.view",
  ]);
  assert.deepEqual(resolveUserPermissions({ username: "legacy" }, INTERNAL_STAFF_PERMISSIONS), expected);
});

test("image persistence prefers stable object keys and resolves them through the API", () => {
  const image = {
    objectKey: "repair-orders/order 1/before.jpg",
    url: "https://legacy.example/before.jpg",
  };
  assert.equal(getRepairImageReference(image), image.objectKey);
  assert.equal(
    resolveRepairImageUrlWithBase(image, "/api/"),
    "/api/repair-orders/stream/repair-orders%2Forder%201%2Fbefore.jpg",
  );
  assert.equal(
    resolveRepairImageUrlWithBase("https://legacy.example/before.jpg", "/api"),
    "https://legacy.example/before.jpg",
  );
});

test("persisted image removal filters only the selected stable reference", () => {
  const originalImages = [
    { objectKey: "repair-orders/order-1/before-a.jpg", stage: "before" },
    { objectKey: "repair-orders/order-1/before-b.jpg", stage: "before" },
    "repair-orders/order-1/before-a.jpg",
  ];

  const remainingImages = removeRepairImageReference(originalImages, originalImages[0]);

  assert.deepEqual(remainingImages, [originalImages[1]]);
  assert.equal(originalImages.length, 3);
  assert.deepEqual(removeRepairImageReference(originalImages, { objectKey: "" }), originalImages);
});

test("image preview moves forward, falls back to the previous image, or closes after removal", () => {
  assert.deepEqual(getRepairImagePreviewStateAfterRemoval(0, 2), { current: 0, visible: true });
  assert.deepEqual(getRepairImagePreviewStateAfterRemoval(1, 2), { current: 1, visible: true });
  assert.deepEqual(getRepairImagePreviewStateAfterRemoval(2, 2), { current: 1, visible: true });
  assert.deepEqual(getRepairImagePreviewStateAfterRemoval(0, 0), { current: 0, visible: false });
});

test("image preview stays open while a compact delete confirmation owns the mobile interaction", () => {
  const source = readFileSync(
    new URL("../src/modules/repair-orders/components/CustomerRepairExcelTable.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(source.includes("Modal.confirm({"), false);
  assert.equal(source.includes("actions.onClose();"), false);
  assert.equal(source.includes("pendingImageRemoval"), false);
  assert.match(source, /<Popconfirm/);
  assert.match(source, /title="Xóa ảnh này\?"/);
  assert.match(source, /visible: previewState\.visible/);
  assert.match(source, /onConfirm=\{\(\) => handlePreviewImageRemoval\(currentImg, current\)\}/);
  assert.match(source, /await flushOrderUpdate\(orderId, \{ images: updatedImageList \}\);/);
  assert.match(source, /clearLocalOverrideField\(orderId, "images", updatedImageList\);/);
  assert.match(source, /aria-label="Xóa ảnh đang xem"/);
});
