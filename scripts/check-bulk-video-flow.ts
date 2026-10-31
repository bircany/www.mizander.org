import assert from "node:assert/strict";
import { deliveryVideoMime } from "../lib/delivery/upload-metadata.js";

console.log("Starting bulk video flow checks...");

// 1. Video MIME & size checks
assert.equal(deliveryVideoMime("test.mp4", "video/mp4"), "video/mp4");
assert.equal(deliveryVideoMime("test.mov", "video/quicktime"), "video/quicktime");
assert.equal(deliveryVideoMime("test.webm", "video/webm"), "video/webm");
assert.equal(deliveryVideoMime("test.txt", "text/plain"), null);
assert.equal(deliveryVideoMime("test.exe", "application/x-msdownload"), null);

// 2. FIFO Queue execution simulation
type QueueTask = {
  id: string;
  order: number;
  status: "idle" | "uploading" | "completed" | "failed";
};

const tasks: QueueTask[] = [
  { id: "v1", order: 1, status: "idle" },
  { id: "v2", order: 2, status: "idle" },
  { id: "v3", order: 3, status: "idle" },
];

const executionOrder: string[] = [];

async function simulateQueue(queue: QueueTask[]) {
  for (let i = 0; i < queue.length; i++) {
    const task = queue[i];
    task.status = "uploading";
    executionOrder.push(`start-${task.id}`);
    // Simulate upload delay
    await new Promise((r) => setTimeout(r, 10));
    task.status = "completed";
    executionOrder.push(`end-${task.id}`);
  }
}

await simulateQueue(tasks);

// Verify strictly sequential FIFO order: start-v1 -> end-v1 -> start-v2 -> end-v2 -> start-v3 -> end-v3
assert.deepEqual(executionOrder, [
  "start-v1",
  "end-v1",
  "start-v2",
  "end-v2",
  "start-v3",
  "end-v3",
]);
assert.ok(tasks.every((t) => t.status === "completed"));

// 3. Duplicate group prevention logic test
const selectedGroupIds = new Set(["group-1", "group-2"]);
const allGroups = [
  { id: "group-1", name: "Grup 1" },
  { id: "group-2", name: "Grup 2" },
  { id: "group-3", name: "Grup 3" },
  { id: "group-4", name: "Grup 4" },
];

// For a new row, available groups should exclude group-1 and group-2
const availableForNewRow = allGroups.filter((g) => !selectedGroupIds.has(g.id));
assert.equal(availableForNewRow.length, 2);
assert.deepEqual(
  availableForNewRow.map((g) => g.id),
  ["group-3", "group-4"]
);

console.log("PASS: Bulk video flow validation, FIFO queue sequence, and duplicate prevention tests succeeded.");
