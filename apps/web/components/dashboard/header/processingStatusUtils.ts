export type ProcessingTaskKind =
  | "crawling"
  | "tagging"
  | "summarizing"
  | "importing";

export type ProcessingTask = {
  kind: ProcessingTaskKind;
  count: number;
};

export type ProcessingStatus = {
  total: number;
  tasks: ProcessingTask[];
};

export function getProcessingBreakdown(processing: ProcessingStatus) {
  const countFor = (kind: ProcessingTaskKind) =>
    processing.tasks.find((task) => task.kind === kind)?.count ?? 0;
  const backgroundTasks = processing.tasks.filter(
    (task) => task.kind === "tagging" || task.kind === "summarizing",
  );

  return {
    preparingCount: countFor("crawling"),
    importingCount: countFor("importing"),
    backgroundTotal: backgroundTasks.reduce(
      (total, task) => total + task.count,
      0,
    ),
    backgroundTasks,
  };
}

export function getProcessingRefreshInterval(processing: ProcessingStatus) {
  return getProcessingBreakdown(processing).preparingCount > 0 ? 1000 : 15_000;
}
